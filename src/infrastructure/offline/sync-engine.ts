import { syncAttendanceOps, touchDeviceClock } from "./attendance-ops";
import { listPendingSales, markSaleStatus, markSaleSynced } from "./queue";
import { syncShiftOps } from "./shift-ops";
import { refreshWorkerSnapshot } from "./worker-cache";
import { SessionRejectedError, syncWorkerOps } from "./worker-ops";

let syncing = false;
// Set when the server rejects the session itself (401). Sales stay queued —
// they are never discarded — and the UI asks the cashier to log in again.
let sessionInvalid = false;
const listeners = new Set<() => void>();

export function subscribeSyncEngine(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isSessionInvalid() {
  return sessionInvalid;
}

function notify() {
  for (const listener of listeners) listener();
}

async function syncOne(saleId: string, payload: unknown) {
  const response = await fetch("/api/sync/sales", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (response.ok) {
    await markSaleSynced(saleId);
    return;
  }

  if (response.status === 401) {
    // Every remaining sale would fail the same way — stop this run.
    throw new SessionRejectedError();
  }

  if (response.status === 403) {
    // Sale belongs to another cashier: keep it pending until that cashier
    // (or an admin) syncs it from this device.
    await markSaleStatus(saleId, "pending");
    return;
  }

  if (response.status === 400) {
    // Validation error — retrying blindly won't help, flag for review.
    const body = await response.json().catch(() => null);
    await markSaleStatus(saleId, "error", body?.error ?? "Validación falló");
    return;
  }

  // Network/server error — leave it pending, the caller will retry later.
  throw new Error(`Sync failed with status ${response.status}`);
}

export async function runSync() {
  if (syncing || typeof window === "undefined" || !navigator.onLine) return;
  syncing = true;

  try {
    sessionInvalid = false;
    // Till shifts first (a closing must follow its opening and movements),
    // then attendance marks (after the till: a clock-out must find the
    // drawer already closed), then worker registrations, then
    // the sales.
    try {
      await syncShiftOps();
      await syncAttendanceOps();
    } catch (error) {
      if (error instanceof SessionRejectedError) {
        sessionInvalid = true;
        return;
      }
    }
    let workerOpsSynced = 0;
    try {
      workerOpsSynced = await syncWorkerOps();
    } catch (error) {
      if (error instanceof SessionRejectedError) {
        sessionInvalid = true;
        return;
      }
    }

    const pending = await listPendingSales();
    let salesSynced = 0;

    for (const sale of pending) {
      if (sale.status === "error") continue;

      try {
        await markSaleStatus(sale.id, "syncing");
        await syncOne(sale.id, {
          uuid: sale.id,
          cashierId: sale.cashierId,
          shiftUuid: sale.shiftUuid,
          paymentType: sale.paymentType,
          items: sale.items,
          total: sale.total,
          clientCreatedAt: sale.clientCreatedAt,
          workerId: sale.workerId,
          workerVerification: sale.workerVerification,
          discountTotal: sale.discountTotal,
          policyId: sale.policyId,
        });
        salesSynced++;
      } catch (error) {
        await markSaleStatus(sale.id, "pending");
        if (error instanceof SessionRejectedError) {
          sessionInvalid = true;
          break;
        }
      }
    }

    // Keep the offline worker list and discount usage fresh: forced after
    // anything synced (usage changed), throttled otherwise.
    await refreshWorkerSnapshot({ force: salesSynced + workerOpsSynced > 0 });
  } finally {
    syncing = false;
    notify();
  }
}

let started = false;

export function startSyncEngine() {
  if (started || typeof window === "undefined") return;
  started = true;

  window.addEventListener("online", () => void runSync());
  setInterval(() => void runSync(), 30_000);
  // Also offline: notices the device clock being moved backwards.
  void touchDeviceClock();
  setInterval(() => void touchDeviceClock(), 30_000);
  void runSync();
}
