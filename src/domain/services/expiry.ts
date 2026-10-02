import { ValidationError } from "../errors";

// Expiry dates are calendar days ("YYYY-MM-DD", store time zone): a soda
// that expires on the 5th is still sellable on the 5th, expired on the 6th.

export type ExpiryStatus = "expired" | "soon" | "ok";

export interface ExpiryInfo {
  status: ExpiryStatus;
  // Negative once expired (−1 = expired yesterday).
  daysLeft: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round(
    (Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) /
      DAY_MS,
  );
}

// "soon" = inside the category's warning window (e.g. 30 days for Bebidas).
export function expiryInfo(
  expiresAt: string,
  todayKey: string,
  warningDays: number,
): ExpiryInfo {
  const daysLeft = daysBetween(todayKey, expiresAt);
  const status = daysLeft < 0 ? "expired" : daysLeft <= warningDays ? "soon" : "ok";
  return { status, daysLeft };
}

// A product follows its category unless it was set explicitly (e.g. a
// keychain inside Snacks, or a candy inside Adornos).
export function tracksExpiry(
  productOverride: boolean | null,
  categoryTracks: boolean,
): boolean {
  return productOverride ?? categoryTracks;
}

export interface LotBalance {
  id: number;
  expiresAt: string;
  quantity: number;
}

// FEFO ("first expired, first out"): the till doesn't know which lot it sold,
// so units leave from the lot that expires first — what a shelf-stocker does
// by putting the oldest in front. Units beyond the dated lots come from
// undated stock (`fromUndated`).
export function consumeFefo(
  lots: LotBalance[],
  quantity: number,
): { taken: { id: number; expiresAt: string; quantity: number }[]; fromUndated: number } {
  const ordered = [...lots]
    .filter((lot) => lot.quantity > 0)
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt) || a.id - b.id);

  const taken: { id: number; expiresAt: string; quantity: number }[] = [];
  let remaining = quantity;
  for (const lot of ordered) {
    if (remaining <= 0) break;
    const take = Math.min(lot.quantity, remaining);
    taken.push({ id: lot.id, expiresAt: lot.expiresAt, quantity: take });
    remaining -= take;
  }
  return { taken, fromUndated: Math.max(0, remaining) };
}

export interface CountedLot {
  expiresAt: string;
  quantity: number;
}

// Lots typed in a count: every unit counted needs its date, and two lines
// with the same date are merged (one lot per product, place and date).
export function normalizeCountedLots(
  counted: number,
  lots: CountedLot[],
): CountedLot[] {
  const byDate = new Map<string, number>();
  for (const lot of lots) {
    if (!Number.isInteger(lot.quantity) || lot.quantity <= 0) {
      throw new ValidationError("Cada lote debe tener al menos 1 unidad");
    }
    byDate.set(lot.expiresAt, (byDate.get(lot.expiresAt) ?? 0) + lot.quantity);
  }
  const total = [...byDate.values()].reduce((sum, q) => sum + q, 0);
  if (total !== counted) {
    throw new ValidationError(
      `Los lotes suman ${total} unidades, pero contaste ${counted}. Revisa las cantidades por fecha.`,
    );
  }
  return [...byDate]
    .map(([expiresAt, quantity]) => ({ expiresAt, quantity }))
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
}
