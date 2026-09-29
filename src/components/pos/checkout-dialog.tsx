"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PaymentType } from "@/domain/entities/sale";
import { formatSoles } from "@/lib/money";

const PAYMENT_OPTIONS: { value: PaymentType; label: string }[] = [
  { value: "cash", label: "Efectivo" },
  { value: "yape_plin", label: "Yape / Plin" },
  { value: "card", label: "Tarjeta (POS)" },
];

export function CheckoutDialog({
  open,
  total,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  total: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: (paymentType: PaymentType) => void;
}) {
  const [paymentType, setPaymentType] = useState<PaymentType>("cash");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cobrar {formatSoles(total)}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-2">
          {PAYMENT_OPTIONS.map((option) => (
            <Button
              key={option.value}
              size="lg"
              variant={paymentType === option.value ? "default" : "outline"}
              onClick={() => setPaymentType(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button size="lg" onClick={() => onConfirm(paymentType)}>
            Confirmar venta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
