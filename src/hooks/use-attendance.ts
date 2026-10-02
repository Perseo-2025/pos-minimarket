"use client";

import { useCallback, useEffect, useState } from "react";
import type { AttendanceTodayState } from "@/domain/entities/attendance";
import {
  clockIn,
  clockOut,
  getLocalAttendance,
  markAnswered,
  mergeServerState,
  refreshFromServer,
  requestClockOutCorrection,
} from "@/infrastructure/offline/attendance-ops";
import { runSync, startSyncEngine } from "@/infrastructure/offline/sync-engine";
import type { LocalAttendance } from "@/infrastructure/offline/types";

// The person's attendance on this device (IndexedDB, so it survives reloads
// and works without internet), merged with what the server knows when there
// is a connection.
export function useAttendance(userId: number, initial: AttendanceTodayState | null) {
  const [state, setState] = useState<LocalAttendance | null>(null);

  const reload = useCallback(async () => {
    setState(await getLocalAttendance(userId));
  }, [userId]);

  useEffect(() => {
    let active = true;
    // Marks queued in the warehouse must sync too (the till already starts
    // the engine; it only runs once).
    startSyncEngine();
    void (async () => {
      const merged = initial
        ? await mergeServerState(userId, initial)
        : await getLocalAttendance(userId);
      if (active) setState(merged);
      const fresh = await refreshFromServer(userId);
      if (active && fresh) setState(fresh);
    })();
    return () => {
      active = false;
    };
  }, [userId, initial]);

  return {
    state,
    loading: state === null,
    clockIn: async () => {
      const current = await clockIn(userId);
      await reload();
      void runSync();
      return current;
    },
    clockOut: async () => {
      await clockOut(userId);
      await reload();
      void runSync();
    },
    requestCorrection: async (attendanceUuid: string, newValue: string, reason: string) => {
      await requestClockOutCorrection(userId, attendanceUuid, newValue, reason);
      await reload();
      void runSync();
    },
    skipCorrection: async (attendanceUuid: string) => {
      await markAnswered(userId, attendanceUuid);
      await reload();
    },
  };
}

export type AttendanceController = ReturnType<typeof useAttendance>;
