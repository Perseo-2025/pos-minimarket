"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PAYMENT_TYPE_LABELS, type PaymentType } from "@/domain/entities/sale";
import type { SalePricing } from "@/domain/services/sale-pricing";
import { formatSoles } from "@/lib/money";
import { PAYMENT_TYPE_ICONS } from "./pos-icons";

// Final confirmation only — the payment method is chosen in the cart, before
// "Cobrar", so the cashier sees it at all times.
export function CheckoutDialog({
  open,
  pricing,
  workerName,
  paymentType,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  pricing: SalePricing;
  workerName: string | null;
  paymentType: PaymentType;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const Icon = PAYMENT_TYPE_ICONS[paymentType];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl">Confirmar cobro</DialogTitle>
          <DialogDescription>
            Verifica el monto y el método de pago antes de registrar la venta.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 rounded-xl border bg-muted/30 py-6">
          <span className="text-4xl font-bold tracking-tight tabular-nums">
            {formatSoles(pricing.total)}
          </span>
          {(pricing.discountTotal > 0 || pricing.giftTotal > 0) && (
            <span className="flex flex-col items-center text-sm text-muted-foreground tabular-nums">
              <s>{formatSoles(pricing.subtotal)}</s>
              {pricing.discountTotal > 0 && (
                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                  −{formatSoles(pricing.discountTotal)} de descuento trabajador
                </span>
              )}
              {pricing.giftTotal > 0 && (
                <span className="font-medium text-brand-orange">
                  −{formatSoles(pricing.giftTotal)} regalo de cumpleaños 🎂
                </span>
              )}
            </span>
          )}
          <span className="flex items-center gap-2 text-base font-medium text-muted-foreground">
            <Icon className="size-5" aria-hidden />
            {PAYMENT_TYPE_LABELS[paymentType]}
          </span>
          {workerName && (
            <span className="text-sm text-muted-foreground">
              Trabajador: <strong className="text-foreground">{workerName}</strong>
            </span>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            className="h-12 text-base"
            onClick={() => onOpenChange(false)}
          >
            Volver
          </Button>
          <Button
            className="h-12 text-base font-semibold"
            autoFocus
            onClick={onConfirm}
          >
            Confirmar venta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
