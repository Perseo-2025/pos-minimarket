import { ValidationError } from "../errors";
import type { StockMovementType } from "../entities/inventory";

export interface StockCountPlan {
  type: Extract<StockMovementType, "opening" | "count_adjustment">;
  delta: number;
}

// A physical count never edits the stock: it records the difference between
// what the system expected and what was counted. The first count of a
// product at a location is its opening stock; any later difference is an
// adjustment and must say why, so a missing unit is never silently erased.
export function planStockCount(input: {
  current: number;
  counted: number;
  hasMovements: boolean;
  note?: string | null;
}): StockCountPlan | null {
  const { current, counted, hasMovements } = input;

  if (!Number.isInteger(counted) || counted < 0) {
    throw new ValidationError("La cantidad contada debe ser un entero mayor o igual a 0");
  }

  const delta = counted - current;

  if (!hasMovements) return { type: "opening", delta };
  if (delta === 0) return null;
  if (!input.note?.trim()) {
    throw new ValidationError(
      "Indica el motivo del ajuste: el conteo no coincide con el sistema",
    );
  }
  return { type: "count_adjustment", delta };
}

// A sale can list the same product on several lines (e.g. one paid, one
// given away as the birthday gift): both leave the shelf, so stock moves once per
// product with the summed quantity.
export function aggregateQuantities<K>(
  items: { productId: K; quantity: number }[],
): Map<K, number> {
  const totals = new Map<K, number>();
  for (const item of items) {
    totals.set(item.productId, (totals.get(item.productId) ?? 0) + item.quantity);
  }
  return totals;
}
