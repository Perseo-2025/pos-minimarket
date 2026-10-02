import { getOfflineDb } from "./db";
import type { LocalShift, PendingShiftOp, ShiftOpType } from "./types";
import { SessionRejectedError, WorkerOpRejectedError } from "./worker-ops";

// Till shifts live on the device first ("Abrir caja" works without
// internet) and reach the server through this ordered queue.

async function postOp(op: ShiftOpType, data: Record<string, unknown>) {
  const response = await fetch("/api/sync/shift-ops", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op, data }),
  });
  if (response.ok) return;
  if (response.status === 401) throw new SessionRejectedError();
  const body = await response.json().catch(() => null);
  if (response.status >= 400 && response.status < 500) {
    throw new WorkerOpRejectedError(body?.error ?? "Operación rechazada", body?.code ?? "invalid");
  }
  throw new Error(`Shift op failed with status ${response.status}`);
}

// Sent at once when online and nothing older is waiting (order matters: a
// closing can't reach the server before its opening). Otherwise queued.
async function submit(op: ShiftOpType, data: Record<string, unknown>) {
  const db = await getOfflineDb();
  const waiting = await db.count("pendingShiftOps");
  if (navigator.onLine && waiting === 0) {
    try {
      await postOp(op, data);
      return;
    } catch (error) {
      if (error instanceof WorkerOpRejectedError) throw error;
      // Network/server/session problem: fall through to the queue.
    }
  }
  const record: PendingShiftOp = {
    id: crypto.randomUUID(),
    op,
    data,
    createdAt: new Date().toISOString(),
    status: "pending",
  };
  await db.put("pendingShiftOps", record);
}

export async function getLocalShift(cashierId: number) {
  const db = await getOfflineDb();
  return (await db.get("cashShifts", cashierId)) ?? null;
}

export async function openShift(cashierId: number, openingCash: number) {
  const shift: LocalShift = {
    cashierId,
    uuid: crypto.randomUUID(),
    openedAt: new Date().toISOString(),
    openingCash,
    salesCount: 0,
  };
  await submit("open", {
    uuid: shift.uuid,
    openingCash,
    openedAt: shift.openedAt,
  });
  const db = await getOfflineDb();
  await db.put("cashShifts", shift);
  return shift;
}

export async function recordCashMovement(
  shift: LocalShift,
  type: "in" | "out",
  amount: number,
  reason: string,
) {
  await submit("movement", {
    uuid: crypto.randomUUID(),
    shiftUuid: shift.uuid,
    type,
    amount,
    reason,
    occurredAt: new Date().toISOString(),
  });
}

// Counted at the till; the expected amounts are never computed here.
export async function closeShift(
  shift: LocalShift,
  counted: { cash: number; yape: number; card: number },
  note: string,
) {
  await submit("close", {
    uuid: shift.uuid,
    closedAt: new Date().toISOString(),
    countedCash: counted.cash,
    countedYape: counted.yape,
    countedCard: counted.card,
    note,
    reportedSales: shift.salesCount,
  });
  const db = await getOfflineDb();
  await db.delete("cashShifts", shift.cashierId);
}

export async function countSaleInShift(cashierId: number) {
  const db = await getOfflineDb();
  const shift = await db.get("cashShifts", cashierId);
  if (shift) await db.put("cashShifts", { ...shift, salesCount: shift.salesCount + 1 });
}

// Replays queued operations in order; stops at the first network error so
// the order is kept. Returns how many were synced.
export async function syncShiftOps() {
  const db = await getOfflineDb();
  const pending = await db.getAllFromIndex("pendingShiftOps", "by-created");
  let synced = 0;
  for (const op of pending) {
    if (op.status === "error") continue;
    try {
      await postOp(op.op, op.data);
      await db.delete("pendingShiftOps", op.id);
      synced++;
    } catch (error) {
      if (error instanceof SessionRejectedError) throw error;
      if (error instanceof WorkerOpRejectedError) {
        await db.put("pendingShiftOps", {
          ...op,
          status: "error",
          errorMessage: error.message,
        });
        continue;
      }
      break;
    }
  }
  return synced;
}
