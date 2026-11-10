import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isValidTopupAmount, isValidWithdrawAmount } from "./wallet";

const TOSS_API = "https://api.tosspayments.com/v1";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function balanceOf(db: any, userId: string): Promise<number> {
  const { data } = await db.from("wallets").select("balance").eq("user_id", userId).maybeSingle();
  return data?.balance ?? 0;
}

// 잔액 + 최근 내역
export const getWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: w } = await supabase.from("wallets").select("balance").eq("user_id", userId).maybeSingle();
    const { data: tx } = await supabase
      .from("wallet_transactions")
      .select("id, type, amount, balance_after, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    const { data: wd } = await supabase
      .from("wallet_withdrawals")
      .select("id, amount, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);
    return { balance: w?.balance ?? 0, transactions: tx ?? [], withdrawals: wd ?? [] };
  });

// 충전 주문 생성 → 브라우저에서 토스 계좌이체 결제창
export const createTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { amount: number }) => {
    const amount = Number(input?.amount);
    if (!isValidTopupAmount(amount)) throw new Error("충전 금액은 1만원 단위, 최대 100만원까지 입력해 주세요.");
    return { amount };
  })
  .handler(async ({ data, context }) => {
    const clientKey = process.env["TOSS_CLIENT_KEY"];
    if (!clientKey || !process.env["TOSS_SECRET_KEY"]) throw new Error("결제 설정이 완료되지 않았습니다.");
    const db = await admin();
    const orderId = `TOPUP-${crypto.randomUUID()}`;
    const { error } = await db.from("wallet_topups").insert({ user_id: context.userId, order_id: orderId, amount: data.amount });
    if (error) throw new Error("충전 주문 생성에 실패했습니다.");
    const { data: profile } = await context.supabase.from("profiles").select("name").eq("id", context.userId).maybeSingle();
    return {
      orderId,
      amount: data.amount,
      orderName: `IMTAM 선불 충전 ${data.amount.toLocaleString()}원`,
      customerKey: context.userId,
      customerName: profile?.name ?? undefined,
      clientKey,
    };
  });

export const confirmTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { paymentKey: string; orderId: string; amount: number }) => {
    if (!input?.paymentKey || !input.orderId) throw new Error("결제 정보가 올바르지 않습니다.");
    return { ...input, amount: Number(input.amount) };
  })
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: t } = await db.from("wallet_topups").select("*").eq("order_id", data.orderId).maybeSingle();
    if (!t || t.user_id !== context.userId) throw new Error("충전 내역을 찾을 수 없습니다.");
    if (t.status === "paid") return { amount: t.amount, balance: await balanceOf(db, t.user_id) };
    if (t.status !== "ready") throw new Error("이미 취소된 충전입니다.");
    if (t.amount !== data.amount) throw new Error("충전 금액이 주문 금액과 일치하지 않습니다.");

    const key = process.env["TOSS_SECRET_KEY"];
    if (!key) throw new Error("결제 설정이 완료되지 않았습니다.");
    const res = await fetch(`${TOSS_API}/payments/confirm`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${key}:`)}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `topup-${t.order_id}`,
      },
      body: JSON.stringify({ paymentKey: data.paymentKey, orderId: t.order_id, amount: t.amount }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`Toss topup confirm failed [${res.status}]: ${text}`);
      let msg = text;
      try { msg = JSON.parse(text).message ?? text; } catch { /* keep text */ }
      throw new Error(`토스페이먼츠 처리 실패: ${msg}`);
    }
    await db
      .from("wallet_topups")
      .update({ status: "paid", payment_key: data.paymentKey, approved_at: new Date().toISOString() })
      .eq("id", t.id);
    const { data: balance, error } = await db.rpc("wallet_apply", {
      _user_id: t.user_id, _delta: t.amount, _type: "topup", _booking_id: null as unknown as string, _ref: t.order_id,
    });
    if (error) throw new Error("잔액 반영에 실패했습니다. 고객센터로 문의해 주세요.");
    return { amount: t.amount, balance: balance as number };
  });

export const failTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string }) => input)
  .handler(async ({ data, context }) => {
    const db = await admin();
    await db.from("wallet_topups").update({ status: "failed" })
      .eq("order_id", data.orderId).eq("user_id", context.userId).eq("status", "ready");
    return { ok: true };
  });

// 잔액 환급·출금 신청: 즉시 잔액 차감 후 등록 계좌로 송금 처리
export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { amount: number }) => ({ amount: Number(input?.amount) }))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const balance = await balanceOf(db, context.userId);
    if (!isValidWithdrawAmount(data.amount, balance)) throw new Error("출금 금액이 잔액보다 많거나 올바르지 않습니다.");
    const { data: p } = await db.from("profiles").select("bank_name, bank_account").eq("id", context.userId).maybeSingle();
    if (!p?.bank_name || !p.bank_account) throw new Error("내정보에서 은행과 계좌번호를 먼저 등록해 주세요.");

    const { data: wd, error } = await db
      .from("wallet_withdrawals")
      .insert({ user_id: context.userId, amount: data.amount, bank_name: p.bank_name, bank_account: p.bank_account })
      .select("id")
      .single();
    if (error || !wd) throw new Error("출금 신청에 실패했습니다.");
    const { error: aErr } = await db.rpc("wallet_apply", {
      _user_id: context.userId, _delta: -data.amount, _type: "withdrawal", _booking_id: null as unknown as string, _ref: wd.id,
    });
    if (aErr) {
      await db.from("wallet_withdrawals").update({ status: "failed", error: "잔액 부족" }).eq("id", wd.id);
      throw new Error("잔액이 부족합니다.");
    }
    // 자동 송금은 토스 지급대행 계약 완료 후 연결. 그 전까지는 'requested'(송금 대기)로 남는다.
    return { ok: true, balance: balance - data.amount };
  });
