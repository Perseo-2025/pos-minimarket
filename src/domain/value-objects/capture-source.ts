// How a line's product was identified: fired with the barcode reader, or
// picked/typed by hand. Typing a code instead of scanning it is how someone
// skips the reader, so the admin sees the share of manual lines per person.
export const CAPTURE_SOURCES = ["scan", "manual"] as const;
export type CaptureSource = (typeof CAPTURE_SOURCES)[number];

export const CAPTURE_SOURCE_LABELS: Record<CaptureSource, string> = {
  scan: "Escaneado",
  manual: "Digitado",
};

// A line merged from several (same product twice) counts as scanned only
// when all of them were.
export function mergeCaptureSources(
  sources: (CaptureSource | null)[],
): CaptureSource | null {
  if (sources.length === 0 || sources.some((s) => s === null)) return null;
  return sources.every((s) => s === "scan") ? "scan" : "manual";
}
