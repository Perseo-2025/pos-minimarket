"use client";

import { ScanBarcodeIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { scanFailed, scanSucceeded } from "@/lib/scan-feedback";
import { cn } from "@/lib/utils";

// The ring falls asleep after a few idle minutes and its first trigger only
// wakes it up: past this, the badge asks for a test scan.
const READY_FOR_MS = 5 * 60 * 1000;

export function ScannerStatus({ lastScanAt }: { lastScanAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const ready = lastScanAt !== null && now - lastScanAt < READY_FOR_MS;
  return (
    <Badge
      variant="secondary"
      title={
        ready
          ? "El lector está conectado"
          : "Si no suena el bip al disparar, vuelve a disparar"
      }
      className={cn(
        "gap-1",
        ready && "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
      )}
    >
      <ScanBarcodeIcon className="size-3.5" aria-hidden />
      {ready ? "Lector listo" : "Sin bip = vuelve a disparar"}
    </Badge>
  );
}

// Brief green/red ring around the screen after each scan: on iOS (no
// vibration) it is the visual half of the feedback.
// Keyed by the scan's time: each scan remounts it and replays the fade.
export function ScanFlash({ flash }: { flash: { ok: boolean; at: number } | null }) {
  if (!flash) return null;
  return (
    <div
      key={flash.at}
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 z-50 border-[6px] animate-out fade-out duration-500 fill-mode-forwards",
        flash.ok ? "border-emerald-500" : "border-destructive",
      )}
    />
  );
}

// Beep/vibrate plus the on-screen flash, for one scan's outcome.
export function useScanFlash() {
  const [flash, setFlash] = useState<{ ok: boolean; at: number } | null>(null);
  return {
    flash,
    ok() {
      scanSucceeded();
      setFlash({ ok: true, at: Date.now() });
    },
    fail() {
      scanFailed();
      setFlash({ ok: false, at: Date.now() });
    },
  };
}

// Shown only when the catalog on screen is old: the page came from the
// device's cache (no internet), so products or codes added since are missing.
export function CatalogAge({ generatedAt }: { generatedAt: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  if (now === null) return null;
  const hours = Math.floor((now - new Date(generatedAt).getTime()) / 3_600_000);
  if (hours < 1) return null;
  return (
    <Badge
      variant="outline"
      title="Conéctate a internet y recarga para traer productos y códigos nuevos"
    >
      Catálogo de hace {hours < 24 ? `${hours} h` : `${Math.floor(hours / 24)} d`}
    </Badge>
  );
}

// Top of a warehouse screen: what to do with the reader, and its state.
export function ScanHint({
  lastScanAt,
  flash,
  children,
}: {
  lastScanAt: number | null;
  flash: { ok: boolean; at: number } | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed bg-muted/30 px-3 py-2 text-sm">
      <ScanFlash flash={flash} />
      <span className="flex items-center gap-2">
        <ScanBarcodeIcon className="size-5 shrink-0 text-primary" aria-hidden />
        {children}
      </span>
      <ScannerStatus lastScanAt={lastScanAt} />
    </div>
  );
}
