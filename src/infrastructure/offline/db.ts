import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  LocalShift,
  PendingSale,
  PendingShiftOp,
  PendingWorkerOp,
  PinAttemptRecord,
  WorkerSnapshotRecord,
} from "./types";

interface PosOfflineDB extends DBSchema {
  pendingSales: {
    key: string;
    value: PendingSale;
    indexes: { "by-status": string; "by-created": string };
  };
  // v2: airport-worker discount.
  workerSnapshot: {
    key: string;
    value: WorkerSnapshotRecord;
  };
  pendingWorkerOps: {
    key: string;
    value: PendingWorkerOp;
    indexes: { "by-created": string };
  };
  pinAttempts: {
    key: string;
    value: PinAttemptRecord;
  };
  // v3: till shifts, one open per cashier on this device.
  cashShifts: {
    key: number;
    value: LocalShift;
  };
  pendingShiftOps: {
    key: string;
    value: PendingShiftOp;
    indexes: { "by-created": string };
  };
}

let dbPromise: Promise<IDBPDatabase<PosOfflineDB>> | null = null;

export function getOfflineDb() {
  if (typeof window === "undefined") {
    throw new Error("getOfflineDb can only run in the browser");
  }

  if (!dbPromise) {
    dbPromise = openDB<PosOfflineDB>("pos-minimarket-offline", 3, {
      // Incremental: devices already on v1 keep their queued sales.
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const store = db.createObjectStore("pendingSales", {
            keyPath: "id",
          });
          store.createIndex("by-status", "status");
          store.createIndex("by-created", "clientCreatedAt");
        }
        if (oldVersion < 2) {
          db.createObjectStore("workerSnapshot", { keyPath: "key" });
          const ops = db.createObjectStore("pendingWorkerOps", {
            keyPath: "id",
          });
          ops.createIndex("by-created", "createdAt");
          db.createObjectStore("pinAttempts", { keyPath: "dni" });
        }
        if (oldVersion < 3) {
          db.createObjectStore("cashShifts", { keyPath: "cashierId" });
          const shiftOps = db.createObjectStore("pendingShiftOps", {
            keyPath: "id",
          });
          shiftOps.createIndex("by-created", "createdAt");
        }
      },
    });
  }

  return dbPromise;
}
