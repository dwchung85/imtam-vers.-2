import { describe, expect, it, vi } from "vitest";
import { runDismissiblePayment, type PaymentClose } from "./dismissiblePayment";

describe("Toss checkout cancellation", () => {
  it("X aborts the SDK request and cancels the unpaid order once", async () => {
    let rejectRequest: (error: unknown) => void = () => {};
    const request = new Promise<void>((_, reject) => { rejectRequest = reject; });
    let close: PaymentClose | null = null;
    const destroy = vi.fn(async () => { rejectRequest({ code: "PAYMENT_REQUEST_ABORTED" }); });
    const cancelOrder = vi.fn(async () => ({ ok: true }));
    const result = runDismissiblePayment({ destroy }, () => request, cancelOrder, (value) => { close = value; });
    const rejected = expect(result).rejects.toMatchObject({ code: "USER_CANCEL" });
    const dismiss = close as PaymentClose | null;
    if (!dismiss) throw new Error("Close callback missing");
    await Promise.all([dismiss(), dismiss()]);
    await rejected;
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(cancelOrder).toHaveBeenCalledExactlyOnceWith("USER_CANCEL");
    expect(close).toBeNull();
  });

  it("a successful request does not cancel the order", async () => {
    const cancelOrder = vi.fn();
    await runDismissiblePayment({ destroy: vi.fn() }, async () => {}, cancelOrder, () => {});
    expect(cancelOrder).not.toHaveBeenCalled();
  });

  it("an SDK error cleans up the order and allows another attempt", async () => {
    const cancelOrder = vi.fn(async () => ({ ok: true }));
    const onClose = vi.fn();
    await expect(runDismissiblePayment({ destroy: vi.fn() }, async () => { throw { code: "ERROR" }; }, cancelOrder, onClose)).rejects.toMatchObject({ code: "ERROR" });
    expect(cancelOrder).toHaveBeenCalledExactlyOnceWith("ERROR");
    expect(onClose).toHaveBeenLastCalledWith(null);
  });
});