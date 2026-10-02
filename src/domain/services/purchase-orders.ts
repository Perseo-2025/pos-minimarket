// A purchase order is what was asked of the supplier; receipts are what
// actually arrived. Status follows the units received per product.

export type PurchaseOrderStatus = "pending" | "partial" | "received" | "cancelled";

export function purchaseOrderStatus(
  ordered: Map<number, number>,
  received: Map<number, number>,
): Exclude<PurchaseOrderStatus, "cancelled"> {
  let anyReceived = false;
  let allReceived = true;
  for (const [productId, units] of ordered) {
    const got = received.get(productId) ?? 0;
    if (got > 0) anyReceived = true;
    if (got < units) allReceived = false;
  }
  if (allReceived && ordered.size > 0) return "received";
  return anyReceived ? "partial" : "pending";
}

// Units still to arrive, per product (never negative: extra units don't
// carry over).
export function remainingUnits(
  ordered: Map<number, number>,
  received: Map<number, number>,
): Map<number, number> {
  const remaining = new Map<number, number>();
  for (const [productId, units] of ordered) {
    const left = units - (received.get(productId) ?? 0);
    if (left > 0) remaining.set(productId, left);
  }
  return remaining;
}
