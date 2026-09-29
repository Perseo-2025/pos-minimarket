"use client";

import {
  BadgePercentIcon,
  GiftIcon,
  MinusIcon,
  PlusIcon,
  ShoppingBasketIcon,
  SparklesIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PaymentType } from "@/domain/entities/sale";
import type { SalePricing } from "@/domain/services/sale-pricing";
import { formatSoles } from "@/lib/money";
import type { CartItem } from "@/types";
import { PaymentMethodPicker } from "./payment-method-picker";
import type { AppliedWorker } from "./worker-discount-dialog";

export function CartPanel({
  items,
  pricing,
  worker,
  workerNotice,
  onAddWorker,
  onRemoveWorker,
  paymentType,
  onPaymentTypeChange,
  onIncrease,
  onDecrease,
  onRemove,
  onCheckout,
  onToggleCourtesy,
  courtesy,
  onRequestCourtesyApproval,
  showTitle = true,
}: {
  items: CartItem[];
  pricing: SalePricing;
  // Airport worker attached to this sale (staff discount), if any.
  worker: AppliedWorker | null;
  // Why the worker's discount doesn't apply in full (daily/monthly cap).
  workerNotice: string | null;
  onAddWorker: () => void;
  onRemoveWorker: () => void;
  paymentType: PaymentType;
  onPaymentTypeChange: (paymentType: PaymentType) => void;
  onIncrease: (productId: string) => void;
  onDecrease: (productId: string) => void;
  onRemove: (productId: string) => void;
  onCheckout: () => void;
  onToggleCourtesy: (productId: string) => void;
  // Admin approval state of the courtesy lines in this cart.
  courtesy: { approvedBy: string | null; needsApproval: boolean };
  onRequestCourtesyApproval: () => void;
  // The mobile Sheet already renders its own title.
  showTitle?: boolean;
}) {
  const units = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="flex h-full flex-col">
      {showTitle && (
        <div className="mb-3 flex items-center gap-2">
          <ShoppingBasketIcon className="size-5 text-brand-blue" aria-hidden />
          <h2 className="font-heading font-semibold">Cesta</h2>
          {units > 0 && (
            <Badge variant="secondary" className="ml-auto tabular-nums">
              {units} {units === 1 ? "unidad" : "unidades"}
            </Badge>
          )}
        </div>
      )}

      <div className="flex-1 space-y-2 overflow-y-auto">
        {items.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <ShoppingBasketIcon className="size-10 opacity-30" aria-hidden />
            Toca un producto para agregarlo
          </div>
        )}
        {items.map((item, index) => {
          // Same order as the cart: priceSale() prices line by line.
          const line = pricing.lines[index];
          return (
            <div
              key={item.productId}
              className="flex items-center justify-between gap-2 border-b pb-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.name}</p>
                {line?.isCourtesy ? (
                  <p className="text-xs tabular-nums">
                    <s className="text-muted-foreground">
                      {formatSoles(line.gross)}
                    </s>{" "}
                    <span className="font-semibold text-brand-orange">
                      Cortesía
                    </span>
                  </p>
                ) : line && line.discountAmount > 0 ? (
                  <p className="text-xs tabular-nums">
                    <span className="text-muted-foreground">
                      {formatSoles(item.unitPrice)} c/u ·{" "}
                    </span>
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">
                      −{line.discountPercent}% → {formatSoles(line.net)}
                    </span>
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatSoles(item.unitPrice)} c/u
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label={`Quitar una unidad de ${item.name}`}
                  onClick={() => onDecrease(item.productId)}
                >
                  <MinusIcon />
                </Button>
                <span className="w-6 text-center text-sm font-medium tabular-nums">
                  {item.quantity}
                </span>
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label={`Agregar una unidad de ${item.name}`}
                  onClick={() => onIncrease(item.productId)}
                >
                  <PlusIcon />
                </Button>
                <Button
                  size="icon-sm"
                  variant={item.isCourtesy ? "default" : "ghost"}
                  className={
                    item.isCourtesy
                      ? "bg-brand-orange text-white hover:bg-brand-orange/90"
                      : "text-brand-orange hover:bg-brand-orange/10 hover:text-brand-orange"
                  }
                  aria-label={
                    item.isCourtesy
                      ? `Quitar cortesía de ${item.name}`
                      : `Regalar ${item.name} (cortesía)`
                  }
                  aria-pressed={item.isCourtesy}
                  title={
                    item.isCourtesy ? "Quitar cortesía" : "Cortesía (regalar)"
                  }
                  onClick={() => onToggleCourtesy(item.productId)}
                >
                  <GiftIcon />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Eliminar ${item.name} de la cesta`}
                  onClick={() => onRemove(item.productId)}
                >
                  <Trash2Icon />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 space-y-4 border-t pt-4">
        {worker ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
            <div className="flex items-start gap-2">
              <BadgePercentIcon
                className="mt-0.5 size-5 shrink-0 text-emerald-600"
                aria-hidden
              />
              <div className="min-w-0 flex-1 leading-tight">
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  Trabajador del aeropuerto
                </p>
                <p className="truncate font-semibold">{worker.fullName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {worker.company}
                </p>
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Quitar trabajador de esta venta"
                onClick={onRemoveWorker}
              >
                <XIcon />
              </Button>
            </div>
            {workerNotice && (
              <p className="mt-2 rounded-lg bg-amber-500/15 px-2 py-1.5 text-xs text-amber-800 dark:text-amber-300">
                {workerNotice}
              </p>
            )}
          </div>
        ) : (
          <Button
            variant="outline"
            className="h-11 w-full justify-start gap-2 border-dashed"
            onClick={onAddWorker}
          >
            <BadgePercentIcon className="size-5 text-emerald-600" />
            <span className="flex flex-col items-start leading-tight">
              <span className="font-medium">Descuento Trabajador</span>
              <span className="text-xs text-muted-foreground">
                Aplicar descuento con DNI y clave
              </span>
            </span>
          </Button>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Método de pago
          </p>
          <PaymentMethodPicker
            value={paymentType}
            onChange={onPaymentTypeChange}
          />
        </div>

        {pricing.courtesyTotal > 0 &&
          (courtesy.needsApproval ? (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <GiftIcon
                className="size-5 shrink-0 text-amber-600"
                aria-hidden
              />
              <span className="flex-1 leading-tight text-amber-800 dark:text-amber-300">
                Falta que un administrador apruebe la cortesía.
              </span>
              <Button size="sm" onClick={onRequestCourtesyApproval}>
                Aprobar
              </Button>
            </div>
          ) : (
            <p className="flex items-center gap-2 rounded-xl border border-brand-orange/30 bg-brand-orange/10 p-3 text-sm">
              <GiftIcon
                className="size-5 shrink-0 text-brand-orange"
                aria-hidden
              />
              <span>
                Cortesía aprobada por <strong>{courtesy.approvedBy}</strong>
              </span>
            </p>
          ))}

        <div className="space-y-1">
          {(pricing.discountTotal > 0 || pricing.courtesyTotal > 0) && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">
                {formatSoles(pricing.subtotal)}
              </span>
            </div>
          )}
          {pricing.discountTotal > 0 && (
            <div className="flex justify-between text-sm font-medium text-emerald-700 dark:text-emerald-400">
              <span>
                Descuento trabajador
                {pricing.discountPercent > 0 &&
                  ` (${pricing.discountPercent}%)`}
              </span>
              <span className="tabular-nums">
                −{formatSoles(pricing.discountTotal)}
              </span>
            </div>
          )}
          {pricing.courtesyTotal > 0 && (
            <div className="flex justify-between text-sm font-medium text-brand-orange">
              <span>Cortesía</span>
              <span className="tabular-nums">
                −{formatSoles(pricing.courtesyTotal)}
              </span>
            </div>
          )}
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-semibold">Total a cobrar</span>
            <span className="text-3xl font-bold tracking-tight tabular-nums">
              {formatSoles(pricing.total)}
            </span>
          </div>
          {worker && pricing.pointsEarned > 0 && (
            <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
              <SparklesIcon
                className="size-3.5 text-brand-orange"
                aria-hidden
              />
              {worker.fullName.split(" ")[0]} gana{" "}
              <strong className="tabular-nums">+{pricing.pointsEarned}</strong>{" "}
              puntos
            </p>
          )}
        </div>

        <Button
          className="h-14 w-full text-lg font-semibold"
          disabled={items.length === 0 || courtesy.needsApproval}
          onClick={onCheckout}
        >
          Cobrar
        </Button>
      </div>
    </div>
  );
}
