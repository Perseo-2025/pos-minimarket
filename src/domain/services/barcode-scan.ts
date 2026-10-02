import type { CaptureSource } from "../value-objects/capture-source";

// A ring/gun reader in keyboard mode "types" the whole code in one burst
// (a few ms per key) and presses Enter; a person types far slower. Bluetooth
// readers are the slowest of the fast ones, hence the generous limits.
export const SCAN_MAX_AVERAGE_GAP_MS = 35;
export const SCAN_MAX_SINGLE_GAP_MS = 90;
export const MIN_CODE_LENGTH = 4;

// times: when each character of the code arrived, Enter excluded.
export function classifyKeyBurst(times: number[]): CaptureSource {
  if (times.length < MIN_CODE_LENGTH) return "manual";
  const gaps = times.slice(1).map((t, i) => t - times[i]);
  const average = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  const slowest = Math.max(...gaps);
  return average <= SCAN_MAX_AVERAGE_GAP_MS && slowest <= SCAN_MAX_SINGLE_GAP_MS
    ? "scan"
    : "manual";
}

// What a code stands for: the unit itself, or a box/display of it.
export type BarcodeTarget =
  | { kind: "unit"; productId: number }
  | { kind: "presentation"; productId: number; presentationId: number };

export function buildBarcodeIndex(entries: {
  units: { productId: number; barcode: string | null }[];
  presentations: { id: number; productId: number; barcode: string | null }[];
}): Map<string, BarcodeTarget> {
  const index = new Map<string, BarcodeTarget>();
  for (const p of entries.presentations) {
    if (p.barcode) {
      index.set(p.barcode, {
        kind: "presentation",
        productId: p.productId,
        presentationId: p.id,
      });
    }
  }
  // Codes are unique across both (enforced on save); units win if an old
  // duplicate slipped through, since selling is what must never fail.
  for (const u of entries.units) {
    if (u.barcode) index.set(u.barcode, { kind: "unit", productId: u.productId });
  }
  return index;
}

// Readers may add spaces or a leading/trailing symbol depending on setup.
export function normalizeScannedCode(raw: string): string {
  return raw.trim().replace(/\s+/g, "");
}
