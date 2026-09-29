import { getOfflineDb } from "./db";
import type { PendingWorkerOp, WorkerOpType } from "./types";

// A request the server rejected on purpose (duplicate DNI, invalid data…).
// Retrying won't help; the message is safe to show the cashier.
export class WorkerOpRejectedError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "WorkerOpRejectedError";
  }
}

export class SessionRejectedError extends Error {}

async function postOp(op: WorkerOpType, data: Record<string, unknown>) {
  const response = await fetch("/api/sync/worker-ops", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op, data }),
  });

  if (response.ok) return;
  if (response.status === 401) throw new SessionRejectedError();

  const body = await response.json().catch(() => null);
  if (response.status >= 400 && response.status < 500) {
    throw new WorkerOpRejectedError(
      body?.error ?? "Operación rechazada",
      body?.code ?? "invalid",
    );
  }
  throw new Error(`Worker op failed with status ${response.status}`);
}

// Sends the operation right away when possible, so the cashier gets instant
// feedback (e.g. "DNI already registered"). Without internet — or if the
// request fails for network reasons — it is queued and synced later.
export async function submitWorkerOp(
  op: Omit<PendingWorkerOp, "status" | "createdAt">,
): Promise<"sent" | "queued"> {
  if (navigator.onLine) {
    try {
      await postOp(op.op, op.data);
      return "sent";
    } catch (error) {
      if (error instanceof WorkerOpRejectedError) throw error;
      // Network/server/session problem: fall through to the queue.
    }
  }

  const db = await getOfflineDb();
  await db.put("pendingWorkerOps", {
    ...op,
    createdAt: new Date().toISOString(),
    status: "pending",
  });
  return "queued";
}

export async function listPendingWorkerOps() {
  const db = await getOfflineDb();
  return db.getAllFromIndex("pendingWorkerOps", "by-created");
}

export async function countPendingWorkerOps() {
  const db = await getOfflineDb();
  return db.count("pendingWorkerOps");
}

// Replays queued operations in order. Returns how many were synced.
export async function syncWorkerOps() {
  const db = await getOfflineDb();
  const pending = await db.getAllFromIndex("pendingWorkerOps", "by-created");
  let synced = 0;

  for (const op of pending) {
    if (op.status === "error") continue;
    try {
      await postOp(op.op, op.data);
      await db.delete("pendingWorkerOps", op.id);
      synced++;
    } catch (error) {
      if (error instanceof SessionRejectedError) throw error;
      if (error instanceof WorkerOpRejectedError) {
        // e.g. the DNI was registered from another till meanwhile.
        await db.put("pendingWorkerOps", {
          ...op,
          status: "error",
          errorMessage: error.message,
        });
        continue;
      }
      // Network/server error: keep it, the next run retries.
      break;
    }
  }

  return synced;
}
