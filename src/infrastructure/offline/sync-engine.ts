import { listPendingSales, markSaleStatus, markSaleSynced } from "./queue";

let syncing = false;
const listeners = new Set<() => void>();

export function subscribeSyncEngine(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
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
    const pending = await listPendingSales();
    for (const sale of pending) {
      if (sale.status === "error") continue;

      try {
        await markSaleStatus(sale.id, "syncing");
        await syncOne(sale.id, {
          id: sale.id,
          paymentType: sale.paymentType,
          items: sale.items,
          total: sale.total,
          clientCreatedAt: sale.clientCreatedAt,
        });
      } catch {
        await markSaleStatus(sale.id, "pending");
      }
    }
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
  void runSync();
}
