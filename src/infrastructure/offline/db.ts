import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  DeviceClockRecord,
  LocalAttendance,
  LocalShift,
  PendingAttendanceOp,
  PendingSale,
  PendingShiftOp,
  PendingWorkerOp,
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
  // v4: staff attendance, one record per person who used this device.
  attendance: {
    key: number;
    value: LocalAttendance;
  };
  pendingAttendanceOps: {
    key: string;
    value: PendingAttendanceOp;
    indexes: { "by-created": string };
  };
  deviceClock: {
    key: string;
    value: DeviceClockRecord;
  };
}

let dbPromise: Promise<IDBPDatabase<PosOfflineDB>> | null = null;

export function getOfflineDb() {
  if (typeof window === "undefined") {
    throw new Error("getOfflineDb can only run in the browser");
  }

  if (!dbPromise) {
    dbPromise = openDB<PosOfflineDB>("pos-minimarket-offline", 5, {
      // Incremental: devices already on v1 keep their queued sales.
      upgrade(db, oldVersion, _newVersion, transaction) {
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
        }
        if (oldVersion < 3) {
          db.createObjectStore("cashShifts", { keyPath: "cashierId" });
          const shiftOps = db.createObjectStore("pendingShiftOps", {
            keyPath: "id",
          });
          shiftOps.createIndex("by-created", "createdAt");
        }
        if (oldVersion < 4) {
          db.createObjectStore("attendance", { keyPath: "userId" });
          const attendanceOps = db.createObjectStore("pendingAttendanceOps", {
            keyPath: "id",
          });
          attendanceOps.createIndex("by-created", "createdAt");
          db.createObjectStore("deviceClock", { keyPath: "key" });
        }
        // v5: workers no longer have a PIN. The old snapshot carries PIN
        // hashes and the previous policy shape: drop it, the POS downloads
        // a new one.
        if (oldVersion < 5) {
          const stores = db.objectStoreNames as DOMStringList;
          if (stores.contains("pinAttempts")) {
            (db as unknown as IDBDatabase).deleteObjectStore("pinAttempts");
          }
          if (oldVersion >= 2) transaction.objectStore("workerSnapshot").clear();
        }
      },
    });
  }

  return dbPromise;
}
