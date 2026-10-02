"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Shown right after logging in, like a mobile app's splash:
//   0.0s – 0.8s  the logo drives in from the left with speed lines
//   0.8s – 2.2s  a glint sweeps the letters; "Preparando tu espacio…" with a
//                loading bar
//   ≥ 2.2s       the logo speeds off to the right and the screen fades out,
//                once the role's screen (caja, almacén, panel) is ready
// It lives in the root layout so it survives the navigation away from
// /login and can fade out over the new screen instead of cutting to it.

const STORAGE_KEY = "navexpress:splash";
const START_EVENT = "navexpress:splash";
const MIN_VISIBLE_MS = 2200;
const FADE_MS = 450;
const STALE_MS = 15_000;

type Phase = "hidden" | "visible" | "leaving";

export function startSplash() {
  try {
    sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // Private mode: the event below still shows it.
  }
  window.dispatchEvent(new Event(START_EVENT));
}

function readStart() {
  try {
    const value = Number(sessionStorage.getItem(STORAGE_KEY));
    // A leftover from a splash that never finished: ignore it.
    const fresh = Number.isFinite(value) && value > 0 && Date.now() - value < STALE_MS;
    return fresh ? value : null;
  } catch {
    return null;
  }
}

function clearStart() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function SplashScreen() {
  const pathname = usePathname();
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("hidden");

  // Started by the login form (or still running after a reload mid-splash).
  useEffect(() => {
    const begin = () => {
      const at = readStart() ?? Date.now();
      setStartedAt(at);
      setPhase("visible");
    };
    if (readStart()) begin();
    window.addEventListener(START_EVENT, begin);
    return () => window.removeEventListener(START_EVENT, begin);
  }, []);

  // Leave once the minimum time passed and we're off the login page.
  useEffect(() => {
    if (phase !== "visible" || startedAt === null || pathname === "/login") return;
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAt));
    const leave = setTimeout(() => setPhase("leaving"), wait);
    return () => clearTimeout(leave);
  }, [phase, startedAt, pathname]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const done = setTimeout(() => {
      clearStart();
      setPhase("hidden");
      setStartedAt(null);
    }, FADE_MS);
    return () => clearTimeout(done);
  }, [phase]);

  if (phase === "hidden") return null;

  // Brand orange, lighter in the middle and deeper at the edges; the logo's
  // navy outline and cream letters carry the rest of the palette.
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Cargando NAVEXPRESS"
      data-leaving={phase === "leaving" || undefined}
      className="splash-root fixed inset-0 z-100 flex flex-col items-center justify-center gap-10 overflow-hidden bg-[radial-gradient(ellipse_at_center,#FBB33A_0%,#F59E0B_45%,#D97706_100%)] px-6"
    >
      <div className="relative w-full max-w-88 sm:max-w-104">
        {/* "Express" speed lines that shoot past as the logo arrives. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <span className="splash-streak top-[22%] w-2/3 [animation-delay:0ms]" />
          <span className="splash-streak top-[48%] w-full [animation-delay:90ms]" />
          <span className="splash-streak top-[74%] w-1/2 [animation-delay:170ms]" />
        </div>
        <div className="splash-logo relative">
          <Image
            src="/navexpress.png"
            alt="NAVEXPRESS"
            width={876}
            height={211}
            priority
            className="h-auto w-full drop-shadow-[0_12px_18px_rgba(44,46,94,0.35)]"
          />
          {/* A glint sweeping across the letters (masked to the logo). */}
          <span aria-hidden className="splash-shine pointer-events-none absolute inset-0" />
        </div>
      </div>
      <div className="splash-loader relative flex w-56 flex-col items-center gap-3">
        <div className="h-2 w-full overflow-hidden rounded-full bg-[#2C2E5E]/20 ring-1 ring-[#2C2E5E]/25">
          <div className="splash-bar h-full rounded-full bg-[#2C2E5E]" />
        </div>
        <span className="text-sm font-semibold tracking-wide text-[#2C2E5E]">
          Preparando tu espacio…
        </span>
      </div>
    </div>
  );
}
