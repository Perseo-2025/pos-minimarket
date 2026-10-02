"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { countPendingAttendanceOps } from "@/infrastructure/offline/attendance-ops";
import { countPendingSales } from "@/infrastructure/offline/queue";
import { countPendingWorkerOps } from "@/infrastructure/offline/worker-ops";
import {
  isSessionInvalid,
  runSync,
  startSyncEngine,
  subscribeSyncEngine,
} from "@/infrastructure/offline/sync-engine";

function subscribeToConnectivity(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

// useSyncExternalStore renders `getServerSnapshot` for SSR and the initial
// client hydration pass, then re-syncs to the real `navigator.onLine` value
// right after — this is the pattern React recommends for browser-only APIs
// specifically to avoid the hydration mismatch a plain useState(() =>
// navigator.onLine) initializer would cause (server has no `navigator`).
export function useIsOnline() {
  return useSyncExternalStore(
    subscribeToConnectivity,
    () => navigator.onLine,
    () => true,
  );
}

export function useOnlineStatus() {
  const isOnline = useIsOnline();
  const [pendingCount, setPendingCount] = useState(0);
  const [sessionInvalid, setSessionInvalid] = useState(false);

  useEffect(() => {
    startSyncEngine();

    const refreshPendingCount = () => {
      // Sales, worker registrations and attendance marks
      // waiting to sync.
      void Promise.all([
        countPendingSales(),
        countPendingWorkerOps(),
        countPendingAttendanceOps(),
      ]).then(([sales, ops, marks]) => setPendingCount(sales + ops + marks));
    };
    refreshPendingCount();

    const handleOnline = () => void runSync();

    window.addEventListener("online", handleOnline);
    const unsubscribe = subscribeSyncEngine(() => {
      refreshPendingCount();
      setSessionInvalid(isSessionInvalid());
    });
    const interval = setInterval(refreshPendingCount, 5_000);

    return () => {
      window.removeEventListener("online", handleOnline);
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return { isOnline, pendingCount, sessionInvalid };
}
