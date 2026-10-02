"use client";

import { useCallback, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requiresAttendance } from "@/domain/entities/attendance";
import { useAttendanceContext } from "./attendance-provider";
import { ClockInDone, ClockInScreen } from "./clock-in-screen";

// Cashiers and warehouse keepers see their area only after "Marcar entrada".
// The admin is never blocked.
export function AttendanceGate({ children }: { children: React.ReactNode }) {
  const { state, role } = useAttendanceContext();
  const [justMarked, setJustMarked] = useState<string | null>(null);
  const done = useCallback(() => setJustMarked(null), []);

  if (!requiresAttendance(role)) return <>{children}</>;
  if (!state) {
    return (
      <div className="flex min-h-[calc(100dvh-57px-var(--app-footer-h))] items-center justify-center p-4">
        <Skeleton className="h-96 w-full max-w-md rounded-xl" />
      </div>
    );
  }
  if (justMarked) return <ClockInDone clockInAt={justMarked} onContinue={done} />;
  if (!state.current || state.forgotten.length > 0) {
    return <ClockInScreen onClockedIn={setJustMarked} />;
  }
  return <>{children}</>;
}
