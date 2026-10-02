import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import {
  productMargin,
  profitWithWorkerDiscount,
} from "@/domain/services/product-margin";
import { formatSoles } from "@/lib/money";
import { cn } from "@/lib/utils";

// Live "Utilidad" box in the product form: what is earned per unit, and
// what is left when an airport worker buys it with their discount.
export function ProfitPreview({
  priceSale,
  priceCost,
  workerDiscountPercent,
}: {
  priceSale: number;
  priceCost: number | null;
  workerDiscountPercent: number;
}) {
  const margin = productMargin(priceSale, priceCost);
  if (!margin) {
    return (
      <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        Escribe el precio de compra y el de venta para ver cuánto ganas por
        unidad.
      </p>
    );
  }

  const loses = margin.profit < 0;
  const withDiscount =
    workerDiscountPercent > 0
      ? profitWithWorkerDiscount(priceSale, priceCost, workerDiscountPercent)
      : null;

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border p-3 text-sm",
        loses
          ? "border-destructive/30 bg-destructive/5"
          : "border-emerald-500/30 bg-emerald-500/5",
      )}
    >
      <div className="flex items-center gap-2 font-medium">
        {loses ? (
          <TrendingDownIcon className="size-4 text-destructive" />
        ) : (
          <TrendingUpIcon className="size-4 text-emerald-600" />
        )}
        {loses ? "Pierdes" : "Ganas"} {formatSoles(Math.abs(margin.profit))} por
        unidad
      </div>
      <p className="text-xs text-muted-foreground">
        {formatSoles(priceSale)} − {formatSoles(priceCost!)} ={" "}
        {formatSoles(margin.profit)} · {margin.markupPercent}% sobre el costo ·{" "}
        {margin.marginPercent}% del precio de venta
      </p>
      {withDiscount !== null && (
        <p
          className={cn(
            "text-xs",
            withDiscount < 0
              ? "font-medium text-destructive"
              : "text-muted-foreground",
          )}
        >
          Con el {workerDiscountPercent}% de descuento a trabajadores:{" "}
          {withDiscount < 0
            ? `pierdes ${formatSoles(Math.abs(withDiscount))} por unidad`
            : `ganas ${formatSoles(withDiscount)} por unidad`}
        </p>
      )}
    </div>
  );
}
