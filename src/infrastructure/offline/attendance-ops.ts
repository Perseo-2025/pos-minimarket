import type { AttendanceTodayState } from "@/domain/entities/attendance";
import { SUSPICIOUS_CLOCK_MS } from "@/domain/entities/attendance";
import { storeDateKey } from "@/domain/value-objects/store-time";
import { getOfflineDb } from "./db";
import type { AttendanceOpType, LocalAttendance, PendingAttendanceOp } from "./types";
import { SessionRejectedError, WorkerOpRejectedError } from "./worker-ops";

// Staff attendance lives on the device first ("Marcar entrada" works without
// internet) and reaches the server through this ordered queue.

// A queued mark of another person: it waits for that person's session.
class OtherPersonError extends Error {}

// A workday open for longer than this is not "in progress" anymore.
const MAX_OPEN_MS = 16 * 60 * 60 * 1000;
// Small jitter of the clock is not "going backwards".
const CLOCK_SLACK_MS = 60 * 1000;

function emptyState(userId: number): LocalAttendance {
  return {
    userId,
    current: null,
    forgotten: [],
    lastClosed: null,
    answered: [],
    schedules: [],
    serverTime: null,
  };
}

export async function getLocalAttendance(userId: number) {
  const db = await getOfflineDb();
  return (await db.get("attendance", userId)) ?? emptyState(userId);
}

async function saveLocal(state: LocalAttendance) {
  const db = await getOfflineDb();
  await db.put("attendance", state);
}

// ---- Device clock ----

// Called on every mark and periodically: notices a clock moved backwards
// (someone setting the tablet earlier to fake an on-time arrival).
export async function touchDeviceClock() {
  const db = await getOfflineDb();
  const now = Date.now();
  const last = await db.get("deviceClock", "clock");
  const movedBack = Boolean(last?.movedBack) || (last ? now < last.lastSeenAt - CLOCK_SLACK_MS : false);
  await db.put("deviceClock", { key: "clock", lastSeenAt: now, movedBack });
  return { movedBack };
}

// The server answered: if the device clock agrees with it, it's trusted
// again.
async function checkClockAgainst(serverTime: string | undefined) {
  if (!serverTime) return;
  const offset = Math.abs(new Date(serverTime).getTime() - Date.now());
  if (offset > SUSPICIOUS_CLOCK_MS) return;
  const db = await getOfflineDb();
  await db.put("deviceClock", { key: "clock", lastSeenAt: Date.now(), movedBack: false });
}

// ---- Queue ----

async function postOp(op: AttendanceOpType, data: Record<string, unknown>, live: boolean) {
  const response = await fetch("/api/sync/attendance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // sentAt: lets the server measure how wrong this device's clock is.
    body: JSON.stringify({ op, data: { ...data, live, sentAt: new Date().toISOString() } }),
  });
  if (response.status === 401) throw new SessionRejectedError();
  if (response.status === 403) throw new OtherPersonError();
  const body = await response.json().catch(() => null);
  if (response.ok) {
    await checkClockAgainst(body?.serverTime);
    return body?.serverTime as string | undefined;
  }
  if (response.status >= 400 && response.status < 500) {
    throw new WorkerOpRejectedError(body?.error ?? "Marca rechazada", body?.code ?? "invalid");
  }
  throw new Error(`Attendance op failed with status ${response.status}`);
}

// Sent at once when online and nothing older is waiting (a clock-out can't
// reach the server before its clock-in). Otherwise queued. Returns the
// server time when it was sent live.
async function submit(op: AttendanceOpType, userId: number, data: Record<string, unknown>) {
  const db = await getOfflineDb();
  const waiting = await db.count("pendingAttendanceOps");
  const payload = { ...data, userId };
  if (navigator.onLine && waiting === 0) {
    try {
      return await postOp(op, payload, true);
    } catch (error) {
      if (error instanceof WorkerOpRejectedError) throw error;
      // Network/server/session problem: fall through to the queue.
    }
  }
  const record: PendingAttendanceOp = {
    id: crypto.randomUUID(),
    op,
    userId,
    data: payload,
    createdAt: new Date().toISOString(),
    status: "pending",
  };
  await db.put("pendingAttendanceOps", record);
  return undefined;
}

export async function countPendingAttendanceOps() {
  const db = await getOfflineDb();
  return db.count("pendingAttendanceOps");
}

async function hasPendingOps(userId: number) {
  const db = await getOfflineDb();
  const all = await db.getAll("pendingAttendanceOps");
  return all.some((op) => op.userId === userId);
}

// ---- Marks ----

export async function clockIn(userId: number) {
  const { movedBack } = await touchDeviceClock();
  const state = await getLocalAttendance(userId);
  const now = new Date();
  const current = {
    uuid: crypto.randomUUID(),
    workDate: storeDateKey(now),
    clockInAt: now.toISOString(),
  };
  const serverTime = await submit("clock_in", userId, {
    uuid: current.uuid,
    deviceAt: current.clockInAt,
    clockMovedBack: movedBack,
  });
  // A workday still open here was never closed.
  const forgotten = state.current ? [...state.forgotten, state.current] : state.forgotten;
  await saveLocal({
    ...state,
    current,
    forgotten,
    serverTime: serverTime ?? state.serverTime,
  });
  return current;
}

export async function clockOut(userId: number) {
  const state = await getLocalAttendance(userId);
  if (!state.current) return;
  const { movedBack } = await touchDeviceClock();
  const now = new Date().toISOString();
  const serverTime = await submit("clock_out", userId, {
    uuid: state.current.uuid,
    deviceAt: now,
    clockMovedBack: movedBack,
  });
  await saveLocal({
    ...state,
    current: null,
    lastClosed: {
      workDate: state.current.workDate,
      clockInAt: state.current.clockInAt,
      clockOutAt: now,
    },
    serverTime: serverTime ?? state.serverTime,
  });
}

// "Ayer no marcaste salida": the time the person says they left, sent to the
// admin for approval.
export async function requestClockOutCorrection(
  userId: number,
  attendanceUuid: string,
  newValue: string,
  reason: string,
) {
  await submit("correction", userId, {
    uuid: crypto.randomUUID(),
    attendanceUuid,
    field: "clock_out",
    newValue,
    reason,
  });
  await markAnswered(userId, attendanceUuid);
}

// "No recuerdo": not asked again; the admin sees the workday without exit.
export async function markAnswered(userId: number, attendanceUuid: string) {
  const state = await getLocalAttendance(userId);
  await saveLocal({
    ...state,
    forgotten: state.forgotten.filter((f) => f.uuid !== attendanceUuid),
    answered: [...state.answered, attendanceUuid].slice(-50),
  });
}

// ---- Server state ----

// Merges what the server knows (e.g. marked on another device). Ignored
// while this device has marks of the person still queued, or if it's older
// than what was already merged.
export async function mergeServerState(userId: number, server: AttendanceTodayState) {
  const state = await getLocalAttendance(userId);
  if (state.serverTime && server.serverTime <= state.serverTime) {
    // Older snapshot: only the schedule may be refreshed.
    return state;
  }
  if (await hasPendingOps(userId)) {
    const next = { ...state, schedules: server.schedules };
    await saveLocal(next);
    return next;
  }

  const serverNow = new Date(server.serverTime).getTime();
  const inProgress = server.open
    .filter((r) => serverNow - new Date(r.clockInAt).getTime() < MAX_OPEN_MS)
    .at(-1);
  const forgotten = server.open.filter(
    (r) => r.uuid !== inProgress?.uuid && !state.answered.includes(r.uuid),
  );
  const closed = server.closedToday.at(-1);

  const next: LocalAttendance = {
    ...state,
    schedules: server.schedules,
    current: inProgress ?? null,
    forgotten,
    lastClosed: closed
      ? { workDate: storeDateKey(new Date(closed.clockInAt)), ...closed }
      : state.lastClosed,
    serverTime: server.serverTime,
  };
  await saveLocal(next);
  return next;
}

export async function refreshFromServer(userId: number) {
  if (!navigator.onLine) return null;
  try {
    const response = await fetch("/api/sync/attendance", { cache: "no-store" });
    if (!response.ok) return null;
    const server = (await response.json()) as AttendanceTodayState;
    await checkClockAgainst(server.serverTime);
    return await mergeServerState(userId, server);
  } catch {
    return null;
  }
}

// Replays queued marks in order; stops at the first network error so the
// order is kept. Marks of a person not logged in now wait for their session
// (and so do that person's later marks). Returns how many were synced.
export async function syncAttendanceOps() {
  const db = await getOfflineDb();
  const pending = await db.getAllFromIndex("pendingAttendanceOps", "by-created");
  const waitingUsers = new Set<number>();
  let synced = 0;
  for (const op of pending) {
    if (op.status === "error" || waitingUsers.has(op.userId)) continue;
    try {
      await postOp(op.op, op.data, false);
      await db.delete("pendingAttendanceOps", op.id);
      synced++;
    } catch (error) {
      if (error instanceof SessionRejectedError) throw error;
      if (error instanceof OtherPersonError) {
        waitingUsers.add(op.userId);
        continue;
      }
      if (error instanceof WorkerOpRejectedError) {
        await db.put("pendingAttendanceOps", {
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
