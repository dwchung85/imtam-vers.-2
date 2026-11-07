import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeSettlement, computeTourAmount } from "./settlement";

const TOSS_API = "https://api.tosspayments.com/v1";

function tossAuthHeader(): string {
  const key = process.env["TOSS_SECRET_KEY"];
  if (!key) throw new Error("결제 설정이 완료되지 않았습니다. (시크릿 키 없음)");
  return `Basic ${btoa(`${key}:`)}`;
}

async function tossPost(path: string, body: unknown, idempotencyKey?: string) {
  const headers: Record<string, string> = {
    Authorization: tossAuthHeader(),
    "Content-Type": "application/json",
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const res = await fetch(`${TOSS_API}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    console.error(`Toss request failed [${res.status}]: ${text}`);
    const msg = typeof json.message === "string" ? json.message : text;
    throw new Error(`토스페이먼츠 처리 실패: ${msg}`);
  }
  return json;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// 1) 예약 생성 + 결제 대기 주문 생성
export const createTourPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { houseId: string; visitDate: string; visitTimeSlot: string; totalVisitors: number }) => {
      if (!input?.houseId || !input.visitDate || !input.visitTimeSlot) throw new Error("예약 정보가 올바르지 않습니다.");
      const n = Number(input.totalVisitors);
      if (!Number.isInteger(n) || n < 1 || n > 20) throw new Error("방문자 수가 올바르지 않습니다.");
      return { ...input, totalVisitors: n };
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const clientKey = process.env["TOSS_CLIENT_KEY"];
    if (!clientKey || !process.env["TOSS_SECRET_KEY"]) throw new Error("결제 설정이 완료되지 않았습니다.");

    const { data: house, error: hErr } = await supabase
      .from("houses")
      .select("id, title, image_url, price_per_visit, host_id, approval_status")
      .eq("id", data.houseId)
      .maybeSingle();
    if (hErr || !house) throw new Error("매물을 찾을 수 없습니다.");

    const { data: profile } = await supabase.from("profiles").select("name").eq("id", userId).maybeSingle();
    const amount = computeTourAmount(house.price_per_visit, data.totalVisitors);
    if (amount <= 0) throw new Error("투어 비용이 올바르지 않습니다.");

    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .insert({
        house_id: house.id,
        house_title: house.title,
        house_image: house.image_url,
        house_price_per_visit: house.price_per_visit,
        guest_id: userId,
        guest_name: profile?.name ?? "",
        visit_date: data.visitDate,
        visit_time_slot: data.visitTimeSlot,
        total_visitors: data.totalVisitors,
        total_price: amount,
        status: "pending",
      })
      .select("id")
      .single();
    if (bErr || !booking) throw new Error(bErr?.message || "예약 생성에 실패했습니다.");

    const orderId = `IMTAM-${booking.id}`;
    const db = await admin();
    const { error: pErr } = await db.from("payments").insert({
      booking_id: booking.id,
      guest_id: userId,
      host_id: house.host_id,
      order_id: orderId,
      amount,
      status: "ready",
    });
    if (pErr) {
      await db.from("bookings").update({ status: "cancelled", payment_status: "failed" }).eq("id", booking.id);
      throw new Error("결제 주문 생성에 실패했습니다.");
    }

    return {
      bookingId: booking.id,
      orderId,
      amount,
      orderName: `${house.title} 투어`.slice(0, 100),
      customerKey: userId,
      customerName: profile?.name ?? undefined,
      clientKey,
    };
  });

// 2) 결제창 인증 후 최종 승인 (IMTAM 계좌로 100% 입금)
export const confirmTourPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { paymentKey: string; orderId: string; amount: number }) => {
    if (!input?.paymentKey || !input.orderId) throw new Error("결제 정보가 올바르지 않습니다.");
    return { ...input, amount: Number(input.amount) };
  })
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: pay } = await db.from("payments").select("*").eq("order_id", data.orderId).maybeSingle();
    if (!pay || pay.guest_id !== context.userId) throw new Error("결제 내역을 찾을 수 없습니다.");
    if (pay.status === "paid") return { ok: true, amount: pay.amount };
    if (pay.status !== "ready") throw new Error("이미 처리되었거나 취소된 결제입니다.");
    if (pay.amount !== data.amount) throw new Error("결제 금액이 주문 금액과 일치하지 않습니다.");

    const result = await tossPost(
      "/payments/confirm",
      { paymentKey: data.paymentKey, orderId: data.orderId, amount: pay.amount },
      `confirm-${data.orderId}`,
    );

    const now = new Date().toISOString();
    await db
      .from("payments")
      .update({
        status: "paid",
        payment_key: data.paymentKey,
        method: typeof result.method === "string" ? result.method : "계좌이체",
        approved_at: typeof result.approvedAt === "string" ? result.approvedAt : now,
        updated_at: now,
      })
      .eq("id", pay.id);
    await db.from("bookings").update({ payment_status: "paid" }).eq("id", pay.booking_id);
    return { ok: true, amount: pay.amount };
  });

// 3) 결제창에서 취소·실패한 경우 예약 해제
export const failTourPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; reason?: string }) => {
    if (!input?.orderId) throw new Error("주문번호가 없습니다.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: pay } = await db.from("payments").select("*").eq("order_id", data.orderId).maybeSingle();
    if (!pay || pay.guest_id !== context.userId) return { ok: false };
    if (pay.status !== "ready") return { ok: true };
    const now = new Date().toISOString();
    await db
      .from("payments")
      .update({ status: "failed", cancel_reason: (data.reason ?? "").slice(0, 200), updated_at: now })
      .eq("id", pay.id);
    await db.from("bookings").update({ status: "cancelled", payment_status: "failed" }).eq("id", pay.booking_id);
    return { ok: true };
  });

async function loadBookingForCaller(
  context: { supabase: any; userId: string },
  bookingId: string,
) {
  // RLS: 게스트 본인 또는 해당 매물 호스트만 조회 가능
  const { data: booking } = await context.supabase
    .from("bookings")
    .select("id, guest_id, house_id, status, payment_status")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) throw new Error("예약을 찾을 수 없습니다.");
  const { data: house } = await context.supabase.from("houses").select("host_id").eq("id", booking.house_id).maybeSingle();
  const isHost = house?.host_id === context.userId;
  const isGuest = booking.guest_id === context.userId;
  return { booking, isHost, isGuest };
}

// 4) 취소·거절 → 결제된 경우 100% 자동 환불
export const cancelTourBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bookingId: string }) => {
    if (!input?.bookingId) throw new Error("예약 정보가 없습니다.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { booking, isHost, isGuest } = await loadBookingForCaller(context, data.bookingId);
    if (!isHost && !isGuest) throw new Error("권한이 없습니다.");
    if (booking.status === "cancelled") return { ok: true, refunded: false };
    if (booking.status === "completed") throw new Error("완료된 투어는 취소할 수 없습니다.");

    const db = await admin();
    const { data: pay } = await db.from("payments").select("*").eq("booking_id", booking.id).maybeSingle();
    let refunded = false;
    const now = new Date().toISOString();

    if (pay && pay.status === "paid" && pay.payment_key) {
      const reason = isHost ? "호스트 예약 거절" : "게스트 예약 취소";
      await tossPost(`/payments/${encodeURIComponent(pay.payment_key)}/cancel`, { cancelReason: reason }, `cancel-${pay.id}`);
      await db
        .from("payments")
        .update({ status: "refunded", refunded_at: now, cancel_reason: reason, updated_at: now })
        .eq("id", pay.id);
      refunded = true;
    } else if (pay && pay.status === "ready") {
      await db.from("payments").update({ status: "failed", updated_at: now }).eq("id", pay.id);
    }

    const paymentStatus = refunded ? "refunded" : booking.payment_status === "paid" ? "paid" : booking.payment_status;
    await db.from("bookings").update({ status: "cancelled", payment_status: paymentStatus }).eq("id", booking.id);
    return { ok: true, refunded };
  });

// 5) 투어 완료 → 호스트 80% / IMTAM 20% 정산 대기 등록
export const completeTourBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bookingId: string }) => {
    if (!input?.bookingId) throw new Error("예약 정보가 없습니다.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { booking, isHost } = await loadBookingForCaller(context, data.bookingId);
    if (!isHost) throw new Error("호스트만 투어 완료 처리할 수 있습니다.");
    if (booking.status !== "confirmed") throw new Error("확정된 투어만 완료 처리할 수 있습니다.");

    const db = await admin();
    const now = new Date().toISOString();
    const { data: pay } = await db.from("payments").select("*").eq("booking_id", booking.id).maybeSingle();
    if (pay && pay.status === "paid" && pay.payout_status === "none") {
      const { hostAmount, platformAmount } = computeSettlement(pay.amount);
      // 실제 호스트 송금은 토스 지급대행 계약 후 활성화. 지금은 정산 대기로 기록.
      await db
        .from("payments")
        .update({
          host_payout_amount: hostAmount,
          platform_fee_amount: platformAmount,
          payout_status: "pending",
          payout_requested_at: now,
          updated_at: now,
        })
        .eq("id", pay.id);
    }
    await db.from("bookings").update({ status: "completed" }).eq("id", booking.id);
    return { ok: true };
  });
