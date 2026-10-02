"use client";

import { useEffect, useRef, useState } from "react";
import {
  classifyKeyBurst,
  MIN_CODE_LENGTH,
  normalizeScannedCode,
  SCAN_MAX_SINGLE_GAP_MS,
} from "@/domain/services/barcode-scan";
import type { CaptureSource } from "@/domain/value-objects/capture-source";
import { primeScanFeedback } from "@/lib/scan-feedback";

// A gap this long starts a new code: whatever was typed before is dropped.
const RESET_GAP_MS = 1500;

function isEditable(el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  );
}

// Puts back what a field had before the reader typed into it, through the
// native setter so React's onChange sees it.
function restoreValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

// Listens to the whole page for the ring reader (Bluetooth keyboard mode,
// Enter suffix).
// - Nothing focused: every code + Enter is handed over, flagged "scan" when
//   it came in a burst or "manual" when typed by hand.
// - A field focused (quantity, search): a burst is taken away from it and
//   handed over as a scan; normal typing in the field is left alone.
// - Fields marked data-scanner="off" (the barcode field of a product, PINs)
//   keep everything.
export function useScanner(
  onScan: (code: string, source: CaptureSource) => void,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const [lastScanAt, setLastScanAt] = useState<number | null>(null);
  const handler = useRef(onScan);
  useEffect(() => {
    handler.current = onScan;
  });

  useEffect(() => {
    if (!enabled) return;
    let chars: string[] = [];
    let times: number[] = [];
    // The focused field's value when the current code started.
    let fieldBefore: { el: HTMLInputElement | HTMLTextAreaElement; value: string } | null = null;

    function reset() {
      chars = [];
      times = [];
      fieldBefore = null;
    }

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("[data-scanner='off']")) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const now = performance.now();
      if (times.length > 0 && now - times[times.length - 1] > RESET_GAP_MS) reset();

      if (event.key === "Enter") {
        const code = normalizeScannedCode(chars.join(""));
        const source = classifyKeyBurst(times);
        const before = fieldBefore;
        reset();
        if (code.length < MIN_CODE_LENGTH) return;
        // Typing in a field and pressing Enter is just using the field.
        if (isEditable(target) && source === "manual") return;
        event.preventDefault();
        event.stopPropagation();
        if (before && isEditable(target)) restoreValue(before.el, before.value);
        setLastScanAt(Date.now());
        handler.current(code, source);
        return;
      }

      if (event.key.length !== 1) return;
      // A slow key in the middle breaks the burst: start over from it.
      if (
        isEditable(target) &&
        times.length > 0 &&
        now - times[times.length - 1] > SCAN_MAX_SINGLE_GAP_MS
      ) {
        reset();
      }
      if (chars.length === 0 && isEditable(target) && !target.isContentEditable) {
        fieldBefore = { el: target, value: target.value };
      }
      chars.push(event.key);
      times.push(now);
    }

    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("pointerdown", primeScanFeedback, { once: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("pointerdown", primeScanFeedback);
    };
  }, [enabled]);

  return { lastScanAt };
}
