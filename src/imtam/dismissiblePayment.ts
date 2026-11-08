export type PaymentClose = () => Promise<void>;

// Keep the SDK request and order cleanup together, including SDK aborts.
export async function runDismissiblePayment(
  payment: { destroy: () => Promise<void> },
  request: () => Promise<unknown>,
  cancelOrder: (reason: string) => Promise<unknown>,
  onCloseAvailable: (close: PaymentClose | null) => void,
) {
  let closing: Promise<void> | undefined;
  let dismissed = false;
  const pending = request();
  onCloseAvailable(() => {
    if (!closing) {
      dismissed = true;
      closing = payment.destroy().catch((error) => {
        dismissed = false;
        closing = undefined;
        throw error;
      });
    }
    return closing;
  });
  try {
    await pending;
  } catch (error) {
    const code = dismissed ? "USER_CANCEL" : (error as { code?: string })?.code ?? "";
    await cancelOrder(code);
    if (dismissed) throw Object.assign(new Error("USER_CANCEL"), { code: "USER_CANCEL" });
    throw error;
  } finally {
    onCloseAvailable(null);
  }
}