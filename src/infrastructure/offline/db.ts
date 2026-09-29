import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  PendingSale,
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
}

let dbPromise: Promise<IDBPDatabase<PosOfflineDB>> | null = null;

export function getOfflineDb() {
  if (typeof window === "undefined") {
    throw new Error("getOfflineDb can only run in the browser");
  }

  if (!dbPromise) {
    dbPromise = openDB<PosOfflineDB>("pos-minimarket-offline", 2, {
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
      },
    });
  }

  return dbPromise;
}
