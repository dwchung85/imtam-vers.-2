import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PaymentClose } from "../dismissiblePayment";
import { T } from "../strings";

export default function PaymentCloseButton({ close }: { close: PaymentClose }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    // A manual popover stays above provider iframes without modifying their DOM.
    ref.current?.showPopover();
  }, []);
  return createPortal(
    <div ref={ref} popover="manual" className="payment-close-control">
      <Button
        variant="outline"
        size="icon"
        className="h-11 w-11 rounded-lg bg-background text-foreground shadow-none"
        aria-label={T.payment.closeLabel}
        title={T.payment.closeLabel}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(false);
          try { await close(); }
          catch { setError(true); setBusy(false); }
        }}
      >
        <X className="size-5" />
      </Button>
      {error && <p role="alert" className="mt-2 max-w-60 rounded-lg border bg-background p-3 text-sm text-destructive">{T.payment.closeError}</p>}
    </div>,
    document.body,
  );
}