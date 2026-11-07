import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { confirmTourPayment } from "@/lib/payments.functions";

type Search = { paymentKey?: string; orderId?: string; amount?: string };

export const Route = createFileRoute("/payment/success")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    paymentKey: typeof s.paymentKey === "string" ? s.paymentKey : undefined,
    orderId: typeof s.orderId === "string" ? s.orderId : undefined,
    amount: s.amount != null ? String(s.amount) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "결제 완료 | IMTAM" },
      { name: "description", content: "IMTAM 투어 예약 결제 결과를 확인합니다." },
      { property: "og:title", content: "결제 완료 | IMTAM" },
      { property: "og:description", content: "IMTAM 투어 예약 결제 결과를 확인합니다." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaymentSuccess,
});

function PaymentSuccess() {
  const { paymentKey, orderId, amount } = Route.useSearch();
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [message, setMessage] = useState("");
  const [paid, setPaid] = useState<number>(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!paymentKey || !orderId || !amount) {
      setState("error");
      setMessage("결제 정보가 올바르지 않습니다.");
      return;
    }
    confirmTourPayment({ data: { paymentKey, orderId, amount: Number(amount) } })
      .then((r) => {
        setPaid(r.amount);
        setState("done");
      })
      .catch((e: unknown) => {
        setState("error");
        setMessage(e instanceof Error ? e.message : "결제 승인에 실패했습니다.");
      });
  }, [paymentKey, orderId, amount]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-50 p-6">
      <div className="w-full max-w-sm bg-white border border-neutral-200 rounded-[10px] p-6 text-center space-y-4">
        {state === "loading" && (
          <>
            <Loader2 className="w-10 h-10 mx-auto animate-spin text-[#008000]" />
            <h1 className="text-lg font-black text-neutral-900">결제를 확인하고 있습니다</h1>
          </>
        )}
        {state === "done" && (
          <>
            <CheckCircle className="w-10 h-10 mx-auto text-[#008000]" />
            <h1 className="text-lg font-black text-neutral-900">투어 예약 신청이 완료되었습니다</h1>
            <p className="text-sm text-neutral-600">
              ₩{paid.toLocaleString()} 결제가 완료되었습니다. 호스트가 확정하면 예약 내역에서 확인할 수 있습니다.
            </p>
          </>
        )}
        {state === "error" && (
          <>
            <AlertCircle className="w-10 h-10 mx-auto text-red-600" />
            <h1 className="text-lg font-black text-neutral-900">결제를 완료하지 못했습니다</h1>
            <p className="text-sm text-neutral-600">{message}</p>
          </>
        )}
        {state !== "loading" && (
          <Link
            to="/"
            className="inline-block w-full py-2.5 rounded-[10px] border border-[#008000] text-[#008000] font-bold text-sm"
          >
            홈으로 돌아가기
          </Link>
        )}
      </div>
    </main>
  );
}
