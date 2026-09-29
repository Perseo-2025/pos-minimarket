import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { PendingSale } from "./types";

interface PosOfflineDB extends DBSchema {
  pendingSales: {
    key: string;
    value: PendingSale;
    indexes: { "by-status": string; "by-created": string };
  };
}

let dbPromise: Promise<IDBPDatabase<PosOfflineDB>> | null = null;

export function getOfflineDb() {
  if (typeof window === "undefined") {
    throw new Error("getOfflineDb can only run in the browser");
  }

  if (!dbPromise) {
    dbPromise = openDB<PosOfflineDB>("pos-minimarket-offline", 1, {
      upgrade(db) {
        const store = db.createObjectStore("pendingSales", {
          keyPath: "id",
        });
        store.createIndex("by-status", "status");
        store.createIndex("by-created", "clientCreatedAt");
      },
    });
  }

  return dbPromise;
}
