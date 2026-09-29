"use client";

import { Button } from "@/components/ui/button";
import { formatSoles } from "@/lib/money";
import type { CartItem } from "@/types";

export function CartPanel({
  items,
  total,
  onIncrease,
  onDecrease,
  onRemove,
  onCheckout,
}: {
  items: CartItem[];
  total: number;
  onIncrease: (productId: string) => void;
  onDecrease: (productId: string) => void;
  onRemove: (productId: string) => void;
  onCheckout: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <h2 className="mb-2 font-semibold">Cesta</h2>
      <div className="flex-1 space-y-2 overflow-y-auto">
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Toca un producto para agregarlo
          </p>
        )}
        {items.map((item) => (
          <div
            key={item.productId}
            className="flex items-center justify-between gap-2 border-b pb-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatSoles(item.unitPrice)} c/u
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7"
                onClick={() => onDecrease(item.productId)}
              >
                -
              </Button>
              <span className="w-5 text-center text-sm">{item.quantity}</span>
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7"
                onClick={() => onIncrease(item.productId)}
              >
                +
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => onRemove(item.productId)}
              >
                Quitar
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t pt-3">
        <span className="font-semibold">Total</span>
        <span className="text-lg font-bold">{formatSoles(total)}</span>
      </div>
      <Button
        size="lg"
        className="mt-3"
        disabled={items.length === 0}
        onClick={onCheckout}
      >
        Cobrar
      </Button>
    </div>
  );
}
