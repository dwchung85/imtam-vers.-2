import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { AlertCircle } from "lucide-react";
import { failTourPayment } from "@/lib/payments.functions";

type Search = { code?: string; message?: string; orderId?: string };

export const Route = createFileRoute("/payment/fail")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    code: typeof s.code === "string" ? s.code : undefined,
    message: typeof s.message === "string" ? s.message : undefined,
    orderId: typeof s.orderId === "string" ? s.orderId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "결제 실패 | IMTAM" },
      { name: "description", content: "IMTAM 투어 예약 결제가 완료되지 않았습니다." },
      { property: "og:title", content: "결제 실패 | IMTAM" },
      { property: "og:description", content: "IMTAM 투어 예약 결제가 완료되지 않았습니다." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaymentFail,
});

function PaymentFail() {
  const { code, message, orderId } = Route.useSearch();
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !orderId) return;
    started.current = true;
    failTourPayment({ data: { orderId, reason: code } }).catch(() => {});
  }, [orderId, code]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-50 p-6">
      <div className="w-full max-w-sm bg-white border border-neutral-200 rounded-[10px] p-6 text-center space-y-4">
        <AlertCircle className="w-10 h-10 mx-auto text-red-600" />
        <h1 className="text-lg font-black text-neutral-900">결제가 완료되지 않았습니다</h1>
        <p className="text-sm text-neutral-600">{message || "결제가 취소되어 예약이 접수되지 않았습니다."}</p>
        <Link
          to="/"
          className="inline-block w-full py-2.5 rounded-[10px] border border-[#008000] text-[#008000] font-bold text-sm"
        >
          홈으로 돌아가기
        </Link>
      </div>
    </main>
  );
}
