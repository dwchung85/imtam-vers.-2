import { createTourPayment, failTourPayment, payTourWithWallet } from "@/lib/payments.functions";
import { createTopup, failTopup } from "@/lib/wallet.functions";

// 선불 잔액에서 투어 비용 결제. 실패 시 사유 반환.
export async function payTourFromWallet(input: {
  houseId: string;
  visitDate: string;
  visitTimeSlot: string;
  totalVisitors: number;
}): Promise<string | null> {
  try {
    await payTourWithWallet({ data: input });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "예약 요청에 실패했습니다.";
  }
}

// 선불 충전: 토스 계좌이체 결제창. 성공 시 /wallet/success 로 이동.
export async function startTopupCheckout(
  amount: number,
  onCloseAvailable: (close: PaymentClose | null) => void = () => {},
): Promise<string | null> {
  let order: Awaited<ReturnType<typeof createTopup>>;
  try {
    order = await createTopup({ data: { amount } });
  } catch (e) {
    return e instanceof Error ? e.message : "충전 요청에 실패했습니다.";
  }
  try {
    const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
    const toss = await loadTossPayments(order.clientKey);
    const payment = toss.payment({ customerKey: order.customerKey });
    const origin = window.location.origin;
    await runDismissiblePayment(payment, () => payment.requestPayment({
      method: "TRANSFER",
      amount: { currency: "KRW", value: order.amount },
      orderId: order.orderId,
      orderName: order.orderName,
      customerName: order.customerName,
      successUrl: `${origin}/wallet/success`,
      failUrl: `${origin}/payment/fail`,
      transfer: { cashReceipt: { type: "소득공제" }, useEscrow: false },
    }), () => failTopup({ data: { orderId: order.orderId } }), onCloseAvailable);
    return null;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err?.code === "USER_CANCEL") return "충전이 취소되었습니다.";
    await failTopup({ data: { orderId: order.orderId } }).catch(() => {});
    return err?.message || "결제창을 여는 중 문제가 발생했습니다.";
  }
}
import { runDismissiblePayment, type PaymentClose } from "./dismissiblePayment";
import { T } from "./strings";

// 예약 생성 후 토스페이먼츠 퀵계좌이체 결제창을 연다. 성공 시 /payment/success 로 이동.
export async function startTourCheckout(input: {
  houseId: string;
  visitDate: string;
  visitTimeSlot: string;
  totalVisitors: number;
}, onCloseAvailable: (close: PaymentClose | null) => void = () => {}): Promise<string | null> {
  let order: Awaited<ReturnType<typeof createTourPayment>>;
  try {
    order = await createTourPayment({ data: input });
  } catch (e) {
    return e instanceof Error ? e.message : "예약 요청에 실패했습니다.";
  }

  try {
    const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
    const toss = await loadTossPayments(order.clientKey);
    const payment = toss.payment({ customerKey: order.customerKey });
    const origin = window.location.origin;
    await runDismissiblePayment(payment, () => payment.requestPayment({
      method: "TRANSFER",
      amount: { currency: "KRW", value: order.amount },
      orderId: order.orderId,
      orderName: order.orderName,
      customerName: order.customerName,
      successUrl: `${origin}/payment/success`,
      failUrl: `${origin}/payment/fail`,
      transfer: { cashReceipt: { type: "소득공제" }, useEscrow: false },
    }), (reason) => failTourPayment({ data: { orderId: order.orderId, reason } }), onCloseAvailable);
    return null;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err?.code === "USER_CANCEL") return T.payment.cancelled;
    // Initialization can fail before the dismissible request starts.
    await failTourPayment({ data: { orderId: order.orderId, reason: err?.code ?? "" } }).catch(() => {});
    return err?.message || "결제창을 여는 중 문제가 발생했습니다.";
  }
}
