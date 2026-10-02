import type { WorkerDiscountUsage } from "@/domain/entities/worker";
import { round2 } from "@/domain/value-objects/money";
import { storeDateKey } from "@/domain/value-objects/store-time";
import { verifyPin } from "@/infrastructure/security/pin-hash";
import { getOfflineDb } from "./db";
import type { CachedWorker, WorkerSnapshotRecord } from "./types";
import { submitWorkerOp } from "./worker-ops";

// Offline brute-force guard: after this many wrong PINs on this device the
// DNI is locked for a while. Every failure is also reported to the server.
const OFFLINE_MAX_FAILURES = 3;
const OFFLINE_LOCK_MS = 5 * 60 * 1000;

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

// After a PIN change the worker must wait for approval. Applied locally at
// once so the old PIN stops working on this tablet even before syncing.
export async function markWorkerPendingLocally(workerId: number) {
  const db = await getOfflineDb();
  const snapshot = await db.get("workerSnapshot", "current");
  if (!snapshot) return;
  await db.put("workerSnapshot", {
    ...snapshot,
    workers: snapshot.workers.map((w) =>
      w.id === workerId ? { ...w, status: "pending", pinHash: null } : w,
    ),
  });
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
// so the caps hold even during a long outage.
export async function localDiscountUsage(
  worker: CachedWorker,
): Promise<WorkerDiscountUsage> {
  const db = await getOfflineDb();
  const pending = await db.getAll("pendingSales");
  const today = storeDateKey(new Date());
  const month = today.slice(0, 7);

  let discountedSalesToday = worker.usage.discountedSalesToday;
  let discountThisMonth = worker.usage.discountThisMonth;
  for (const sale of pending) {
    if (sale.workerId !== worker.id || !sale.discountTotal) continue;
    const key = storeDateKey(new Date(sale.clientCreatedAt));
    if (key === today) discountedSalesToday++;
    if (key.startsWith(month)) discountThisMonth += sale.discountTotal;
  }

  return { discountedSalesToday, discountThisMonth: round2(discountThisMonth) };
}

export type OfflinePinResult =
  | { ok: true }
  | { ok: false; attemptsLeft: number }
  | { ok: false; lockedMinutes: number };

export async function getOfflinePinLock(dni: string) {
  const db = await getOfflineDb();
  const record = await db.get("pinAttempts", dni);
  if (record?.lockedUntil && record.lockedUntil > Date.now()) {
    return Math.ceil((record.lockedUntil - Date.now()) / 60_000);
  }
  return 0;
}

export async function verifyPinOffline(
  worker: CachedWorker,
  pin: string,
): Promise<OfflinePinResult> {
  const lockedMinutes = await getOfflinePinLock(worker.dni);
  if (lockedMinutes > 0) return { ok: false, lockedMinutes };

  const db = await getOfflineDb();
  if (worker.pinHash && (await verifyPin(pin, worker.pinHash))) {
    await db.delete("pinAttempts", worker.dni);
    return { ok: true };
  }

  const record = (await db.get("pinAttempts", worker.dni)) ?? {
    dni: worker.dni,
    failures: 0,
    lockedUntil: null,
  };
  const failures = record.failures + 1;
  const locked = failures >= OFFLINE_MAX_FAILURES;
  await db.put("pinAttempts", {
    dni: worker.dni,
    failures: locked ? 0 : failures,
    lockedUntil: locked ? Date.now() + OFFLINE_LOCK_MS : null,
  });

  // Leave a trace for the audit report, even without internet.
  const occurredAt = new Date().toISOString();
  await submitWorkerOp({
    id: crypto.randomUUID(),
    op: "pin_failed",
    data: { uuid: crypto.randomUUID(), workerId: worker.id, occurredAt },
    label: `Clave incorrecta de ${worker.dni}`,
  });

  return locked
    ? { ok: false, lockedMinutes: Math.ceil(OFFLINE_LOCK_MS / 60_000) }
    : { ok: false, attemptsLeft: OFFLINE_MAX_FAILURES - failures };
}
