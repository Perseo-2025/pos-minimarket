import type { WorkerDiscountUsage } from "@/domain/entities/worker";
import { storeDateKey } from "@/domain/value-objects/store-time";
import { getOfflineDb } from "./db";
import type { CachedWorker, WorkerSnapshotRecord } from "./types";

let lastRefresh = 0;

// Pulls the latest workers + policy. Cheap to call often: it is throttled
// unless `force` is set (e.g. right after a sale or a registration synced).
export async function refreshWorkerSnapshot({ force = false } = {}) {
  if (typeof window === "undefined" || !navigator.onLine) return false;
  if (!force && Date.now() - lastRefresh < 60_000) return false;
  lastRefresh = Date.now();

  try {
    const response = await fetch("/api/sync/workers", { cache: "no-store" });
    if (!response.ok) return false;
    const snapshot = (await response.json()) as Omit<WorkerSnapshotRecord, "key">;
    const db = await getOfflineDb();
    await db.put("workerSnapshot", { key: "current", ...snapshot });
    return true;
  } catch {
    return false;
  }
}

export async function getWorkerSnapshot() {
  const db = await getOfflineDb();
  return (await db.get("workerSnapshot", "current")) ?? null;
}

export type LocalWorkerLookup =
  | { kind: "found"; worker: CachedWorker }
  // Registered from this tablet, still waiting to reach the server.
  | { kind: "queued"; dni: string }
  | { kind: "unknown" };

export async function findWorkerLocally(dni: string): Promise<LocalWorkerLookup> {
  const snapshot = await getWorkerSnapshot();
  const worker = snapshot?.workers.find((w) => w.dni === dni);
  if (worker) return { kind: "found", worker };

  const db = await getOfflineDb();
  const ops = await db.getAll("pendingWorkerOps");
  if (ops.some((op) => op.op === "register" && op.dni === dni)) {
    return { kind: "queued", dni };
  }
  return { kind: "unknown" };
}

// Usage from the snapshot plus this device's sales still waiting to sync,
// so the limits hold even during a long outage.
export async function localDiscountUsage(
  worker: CachedWorker,
): Promise<WorkerDiscountUsage> {
  const db = await getOfflineDb();
  const pending = await db.getAll("pendingSales");
  const today = storeDateKey(new Date());
  const year = today.slice(0, 4);

  let { discountedSalesToday, giftUsedThisYear } = worker.usage;
  for (const sale of pending) {
    if (sale.workerId !== worker.id) continue;
    const key = storeDateKey(new Date(sale.clientCreatedAt));
    if (sale.discountTotal && key === today) discountedSalesToday++;
    if (sale.giftTotal && key.startsWith(year)) giftUsedThisYear = true;
  }

  return { discountedSalesToday, giftUsedThisYear };
}
