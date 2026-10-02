import { daysBetween } from "./expiry";

// "Conteo del día": a handful of products to count at one location, so the
// whole store gets checked little by little without closing for inventory.

export interface CountCandidate {
  productId: number;
  // System balance at the location (may be negative after selling without
  // a recorded transfer).
  balance: number;
  // Last day it was counted there (YYYY-MM-DD), null if never.
  lastCountedOn: string | null;
  // Units that left this location in the last 7 days (sold / moved).
  unitsOutLastWeek: number;
  // Has a lot expired or inside its warning window here.
  hasExpiring: boolean;
  // Merchandise arrived here in the last 3 days.
  recentlyReceived: boolean;
}

// Why each product is suggested, shown to whoever counts.
export type CountReason =
  | "negative"
  | "never_counted"
  | "expiring"
  | "fast_moving"
  | "recently_received"
  | "not_counted_lately";

export const COUNT_REASON_LABELS: Record<CountReason, string> = {
  negative: "El sistema dice que no hay",
  never_counted: "Nunca se contó aquí",
  expiring: "Tiene unidades por vencer",
  fast_moving: "Se mueve mucho",
  recently_received: "Llegó mercadería hace poco",
  not_counted_lately: "Hace tiempo que no se cuenta",
};

export interface CountSuggestion {
  productId: number;
  score: number;
  reasons: CountReason[];
}

// Highest risk first: negative stock, never counted, expiring, fast movers,
// fresh receipts, and anything not counted for a long time.
export function suggestDailyCount(
  candidates: CountCandidate[],
  todayKey: string,
  limit = 10,
): CountSuggestion[] {
  return candidates
    .map((c) => {
      const reasons: CountReason[] = [];
      let score = 0;
      if (c.balance < 0) {
        score += 100;
        reasons.push("negative");
      }
      if (c.lastCountedOn === null) {
        score += 50;
        reasons.push("never_counted");
      }
      if (c.hasExpiring) {
        score += 30;
        reasons.push("expiring");
      }
      if (c.unitsOutLastWeek > 0) {
        // Up to 25 points: rotation matters, but never more than a red flag.
        score += Math.min(25, c.unitsOutLastWeek);
        if (c.unitsOutLastWeek >= 10) reasons.push("fast_moving");
      }
      if (c.recentlyReceived) {
        score += 20;
        reasons.push("recently_received");
      }
      if (c.lastCountedOn !== null) {
        const days = daysBetween(c.lastCountedOn, todayKey);
        // Counted today already: leave it for another day.
        if (days === 0) return { productId: c.productId, score: -1, reasons };
        score += Math.min(30, days);
        if (days >= 14) reasons.push("not_counted_lately");
      }
      return { productId: c.productId, score, reasons };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.productId - b.productId)
    .slice(0, limit);
}

// A count that matches the system closes on its own; a different one waits
// for the admin before touching the stock.
export function countOutcome(expected: number, counted: number) {
  return expected === counted ? "matched" : "pending";
}
