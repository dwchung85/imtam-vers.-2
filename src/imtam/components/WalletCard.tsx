import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { getWallet, requestWithdrawal } from "@/lib/wallet.functions";
import { startTopupCheckout } from "../tossCheckout";
import type { PaymentClose } from "../dismissiblePayment";
import PaymentCloseButton from "./PaymentCloseButton";

const TOPUP_PRESETS = [10000, 30000, 50000, 100000];
const TX_LABEL: Record<string, string> = {
  topup: "충전",
  tour_payment: "투어 결제",
  tour_refund: "투어 환불",
  tour_earning: "투어 정산 (80%)",
  withdrawal: "출금·환급",
  withdrawal_return: "출금 실패 반환",
};

type WalletData = Awaited<ReturnType<typeof getWallet>>;

export default function WalletCard() {
  const [data, setData] = useState<WalletData | null>(null);
  const [units, setUnits] = useState(1); // 만원 단위
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [close, setClose] = useState<PaymentClose | null>(null);

  const load = () => getWallet().then(setData).catch(() => {});
  useEffect(() => { load(); }, []);

  const topup = async () => {
    setBusy(true);
    setMsg("");
    const err = await startTopupCheckout(units * 10000, (c) => setClose(() => c));
    setClose(null);
    if (err) setMsg(err);
    setBusy(false);
  };

  const withdraw = async () => {
    const amount = Number(withdrawAmount.replace(/[^0-9]/g, ""));
    if (!amount) return setMsg("출금할 금액을 입력해 주세요.");
    if (!confirm(`₩${amount.toLocaleString()}을 등록된 계좌로 출금(환급) 신청하시겠습니까?`)) return;
    setBusy(true);
    setMsg("");
    try {
      await requestWithdrawal({ data: { amount } });
      setWithdrawAmount("");
      setMsg("출금 신청이 접수되었습니다.");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "출금 신청에 실패했습니다.");
    }
    setBusy(false);
  };

  return (
    <div className="bg-white rounded-[10px] border border-neutral-200 p-5 md:p-6 space-y-5">
      <div>
        <h4 className="font-bold text-neutral-900 text-sm md:text-base flex items-center gap-2">
          <Wallet className="w-4 h-4 text-[#008000]" />
          <span>임탐머니</span>
        </h4>
        <div className="mt-2 text-2xl md:text-3xl font-black text-neutral-900">
          ₩{(data?.balance ?? 0).toLocaleString()}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-[11px] font-semibold text-neutral-500 block">충전하기 (1만원 단위)</span>
        <div className="flex flex-wrap gap-2">
          {TOPUP_PRESETS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setUnits(v / 10000)}
              className={`px-3 h-9 rounded-[10px] border text-sm font-bold ${units * 10000 === v ? "border-[#008000] text-[#008000]" : "border-neutral-200 text-neutral-700"}`}
            >
              {v / 10000}만원
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={100}
            value={units}
            onChange={(e) => setUnits(Math.max(1, Math.min(100, Math.floor(Number(e.target.value) || 1))))}
            className="w-24 h-9 px-3 rounded-[10px] border border-neutral-200 text-sm font-bold text-right"
            aria-label="충전 금액(만원)"
          />
          <span className="text-sm text-neutral-600">만원</span>
          <button
            type="button"
            disabled={busy}
            onClick={topup}
            className="ml-auto h-9 px-4 shrink-0 whitespace-nowrap rounded-[10px] bg-white border border-[#008000] text-[#008000] hover:bg-[#008000] hover:text-white text-sm font-bold disabled:opacity-50"
          >
            ₩{(units * 10000).toLocaleString()} 충전
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-[11px] font-semibold text-neutral-500 block">출금·환급 (등록된 계좌로)</span>
        <div className="flex items-center gap-2">
          <input
            inputMode="numeric"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            placeholder="금액"
            className="flex-1 h-9 px-3 rounded-[10px] border border-neutral-200 text-sm font-bold text-right"
            aria-label="출금 금액"
          />
          <button
            type="button"
            disabled={busy}
            onClick={withdraw}
            className="h-9 px-4 shrink-0 whitespace-nowrap rounded-[10px] border border-[#008000] text-[#008000] text-sm font-bold disabled:opacity-50"
          >
            출금 신청
          </button>
        </div>
      </div>

      {msg && <p className="text-sm text-neutral-700">{msg}</p>}

      {data && data.transactions.length > 0 && (
        <div className="space-y-1">
          <span className="text-[11px] font-semibold text-neutral-500 block">최근 내역</span>
          <ul className="divide-y divide-neutral-100">
            {data.transactions.map((t) => (
              <li key={t.id} className="flex justify-between py-2 text-sm">
                <span className="text-neutral-700">
                  {TX_LABEL[t.type] ?? t.type}
                  <span className="ml-2 text-xs text-neutral-400">{new Date(t.created_at).toLocaleDateString("ko-KR")}</span>
                </span>
                <span className={`font-bold ${t.amount > 0 ? "text-[#008000]" : "text-neutral-900"}`}>
                  {t.amount > 0 ? "+" : ""}₩{t.amount.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {close && <PaymentCloseButton close={close} />}
    </div>
  );
}
