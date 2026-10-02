"use client";

import { useCallback, useEffect, useState } from "react";
import {
  closeShift,
  countSaleInShift,
  getLocalShift,
  openShift,
  recordCashMovement,
} from "@/infrastructure/offline/shift-ops";
import { runSync } from "@/infrastructure/offline/sync-engine";
import type { LocalShift } from "@/infrastructure/offline/types";

// The cashier's open till shift on this device (kept in IndexedDB, so it
// survives reloads and works without internet).
export function useCashShift(cashierId: number) {
  const [shift, setShift] = useState<LocalShift | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setShift(await getLocalShift(cashierId));
    setLoading(false);
  }, [cashierId]);

  useEffect(() => {
    let active = true;
    void getLocalShift(cashierId).then((current) => {
      if (!active) return;
      setShift(current);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [cashierId]);

  return {
    shift,
    loading,
    open: async (openingCash: number) => {
      setShift(await openShift(cashierId, openingCash));
    },
    move: async (type: "in" | "out", amount: number, reason: string) => {
      if (!shift) return;
      await recordCashMovement(shift, type, amount, reason);
    },
    close: async (counted: { cash: number; yape: number; card: number }, note: string) => {
      if (!shift) return;
      await closeShift(shift, counted, note);
      setShift(null);
      void runSync();
    },
    // Called after each sale charged in this shift.
    countSale: async () => {
      await countSaleInShift(cashierId);
      await reload();
    },
  };
}
