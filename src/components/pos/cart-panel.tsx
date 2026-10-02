"use client";

import {
  BadgePercentIcon,
  CakeIcon,
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
import type { LinePricing, SalePricing } from "@/domain/services/sale-pricing";
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
  gift,
  onToggleGift,
  showTitle = true,
}: {
  items: CartItem[];
  pricing: SalePricing;
  // Airport worker attached to this sale (staff discount), if any.
  worker: AppliedWorker | null;
  // Why the worker's discount doesn't apply in full (daily cap, units).
  workerNotice: string | null;
  onAddWorker: () => void;
  onRemoveWorker: () => void;
  paymentType: PaymentType;
  onPaymentTypeChange: (paymentType: PaymentType) => void;
  onIncrease: (productId: number) => void;
  onDecrease: (productId: number) => void;
  onRemove: (productId: number) => void;
  onCheckout: () => void;
  // Set on the worker's birthday while this year's gift is unused: products
  // up to maxAmount can be marked as the gift.
  gift: { maxAmount: number } | null;
  onToggleGift: (productId: number) => void;
  // The mobile Sheet already renders its own title.
  showTitle?: boolean;
}) {
  const units = items.reduce((sum, item) => sum + item.quantity, 0);
  const giftChosen = pricing.giftTotal > 0;

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
                <LinePrice item={item} line={line} />
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
                {(item.isGift || (gift && !giftChosen && item.unitPrice <= gift.maxAmount)) && (
                  <Button
                    size="icon-sm"
                    variant={item.isGift ? "default" : "ghost"}
                    className={
                      item.isGift
                        ? "bg-brand-orange text-white hover:bg-brand-orange/90"
                        : "text-brand-orange hover:bg-brand-orange/10 hover:text-brand-orange"
                    }
                    aria-label={
                      item.isGift
                        ? `Quitar regalo de cumpleaños de ${item.name}`
                        : `Regalar ${item.name} por su cumpleaños`
                    }
                    aria-pressed={item.isGift}
                    title={item.isGift ? "Quitar regalo" : "Regalo de cumpleaños"}
                    onClick={() => onToggleGift(item.productId)}
                  >
                    <CakeIcon />
                  </Button>
                )}
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
            {gift && !giftChosen && (
              <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-brand-orange/15 px-2 py-1.5 text-xs text-brand-orange">
                <CakeIcon className="size-3.5 shrink-0" aria-hidden />
                ¡Cumpleaños! Toca 🎂 en un producto de hasta {formatSoles(gift.maxAmount)} para regalárselo.
              </p>
            )}
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
                Escribe su DNI (fotocheck)
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

        <div className="space-y-1">
          {(pricing.discountTotal > 0 || pricing.giftTotal > 0) && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">
                {formatSoles(pricing.subtotal)}
              </span>
            </div>
          )}
          {pricing.discountTotal > 0 && (
            <div className="flex justify-between text-sm font-medium text-emerald-700 dark:text-emerald-400">
              <span>Descuento trabajador</span>
              <span className="tabular-nums">
                −{formatSoles(pricing.discountTotal)}
              </span>
            </div>
          )}
          {pricing.giftTotal > 0 && (
            <div className="flex justify-between text-sm font-medium text-brand-orange">
              <span>Regalo de cumpleaños</span>
              <span className="tabular-nums">
                −{formatSoles(pricing.giftTotal)}
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
          disabled={items.length === 0}
          onClick={onCheckout}
        >
          Cobrar
        </Button>
      </div>
    </div>
  );
}

// What the line costs, spelled out: "S/ 5.00 → S/ 4.00 c/u" when every unit
// has the discount, or "3 × S/ 4.00 + 2 × S/ 5.00" past the per-purchase
// limit. The gift unit shows apart.
function LinePrice({ item, line }: { item: CartItem; line: LinePricing | undefined }) {
  if (!line) return null;
  const paid = item.quantity - (line.isGift ? 1 : 0);
  const discounted = line.discountedQuantity;
  const discountedPrice = item.unitPrice - line.discountUnitAmount;

  return (
    <p className="text-xs tabular-nums">
      {line.isGift && (
        <span className="font-semibold text-brand-orange">
          🎂 1 de regalo{paid > 0 ? " · " : ""}
        </span>
      )}
      {discounted > 0 && discounted === paid ? (
        <>
          <s className="text-muted-foreground">{formatSoles(item.unitPrice)}</s>{" "}
          <span className="font-medium text-emerald-700 dark:text-emerald-400">
            → {formatSoles(discountedPrice)} c/u
          </span>
        </>
      ) : discounted > 0 ? (
        <>
          <span className="font-medium text-emerald-700 dark:text-emerald-400">
            {discounted} × {formatSoles(discountedPrice)}
          </span>
          <span className="text-muted-foreground">
            {" "}
            + {paid - discounted} × {formatSoles(item.unitPrice)}
          </span>
        </>
      ) : paid > 0 ? (
        <span className="text-muted-foreground">{formatSoles(item.unitPrice)} c/u</span>
      ) : null}
    </p>
  );
}
