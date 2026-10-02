import {
  requiresAttendance,
  type AttendanceTodayState,
} from "@/domain/entities/attendance";
import type { UserRole } from "@/domain/entities/user";
import { ForbiddenError, ValidationError } from "@/domain/errors";
import {
  computeEarlyLeave,
  computeLateMinutes,
  isOffSchedule,
  resolvePunchTime,
  scheduleFor,
} from "@/domain/services/attendance";
import { storeDateKey } from "@/domain/value-objects/store-time";
import { clockInSchema, clockOutSchema } from "@/application/validation/attendance";
import { nowOf, snapshotShift, type AttendanceDeps } from "./deps";

type Actor = { id: number; role: UserRole };

// A mark queued on a shared device waits for its own person's session.
export function assertOwnMark(data: { userId?: number }, actor: Actor) {
  if (data.userId !== undefined && data.userId !== actor.id) {
    throw new ForbiddenError("La marca es de otra persona");
  }
}

// "Marcar entrada". Idempotent by the device's uuid. The person is always the
// session's user, never one sent by the device.
export async function clockInUseCase(deps: AttendanceDeps, input: unknown, actor: Actor) {
  const data = clockInSchema.parse(input);
  assertOwnMark(data, actor);
  const receivedAt = nowOf(deps);
  const time = resolvePunchTime({
    deviceAt: new Date(data.deviceAt),
    sentAt: new Date(data.sentAt),
    receivedAt,
    live: data.live,
    clockMovedBack: data.clockMovedBack,
  });
  const workDate = storeDateKey(time.at);
  const shift = scheduleFor(workDate, await deps.schedules.listByUser(actor.id));
  const lateMinutes = computeLateMinutes(time.at, shift);

  const inserted = await deps.attendance.insert({
    uuid: data.uuid,
    userId: actor.id,
    workDate,
    clockInAt: time.at,
    clockInDeviceAt: new Date(data.deviceAt),
    clockInReceivedAt: receivedAt,
    scheduledStart: shift?.start ?? null,
    scheduledEnd: shift?.end ?? null,
    toleranceMin: shift?.toleranceMin ?? null,
    lateMinutes,
    offline: time.offline,
    timeSuspicious: time.suspicious,
  });
  // Retried sync of the same mark: already done.
  if (!inserted) return;

  // A workday left open before this one: they forgot to mark the exit.
  await deps.attendance.markForgotten(actor.id, data.uuid);
  await deps.audit.recordWithUuid(data.uuid, {
    type: "attendance_clock_in",
    actorId: actor.id,
    payload: {
      attendanceUuid: data.uuid,
      workDate,
      lateMinutes,
      offline: time.offline,
      timeSuspicious: time.suspicious,
      deviceAt: data.deviceAt,
    },
    occurredAt: time.at,
  });
}

// "Marcar salida". The till asks to close the cash drawer first; if it still
// arrives with a shift open (another device, old queue) it's accepted and
// audited — a mark is never lost.
export async function clockOutUseCase(deps: AttendanceDeps, input: unknown, actor: Actor) {
  const data = clockOutSchema.parse(input);
  assertOwnMark(data, actor);
  const record = await deps.attendance.findByUuid(data.uuid);
  if (!record) throw new ValidationError("La jornada no existe");
  if (record.userId !== actor.id) throw new ValidationError("Esta jornada es de otra persona");
  if (record.clockOutAt) return;

  const receivedAt = nowOf(deps);
  const time = resolvePunchTime({
    deviceAt: new Date(data.deviceAt),
    sentAt: new Date(data.sentAt),
    receivedAt,
    live: data.live,
    clockMovedBack: data.clockMovedBack,
  });
  const at = time.at < record.clockInAt ? record.clockInAt : time.at;
  const earlyLeaveMinutes = computeEarlyLeave(at, snapshotShift(record));

  const updated = await deps.attendance.clockOut({
    uuid: data.uuid,
    clockOutAt: at,
    deviceAt: new Date(data.deviceAt),
    receivedAt,
    earlyLeaveMinutes,
    offline: time.offline,
    timeSuspicious: time.suspicious,
  });
  if (!updated) return;

  await deps.audit.record({
    type: "attendance_clock_out",
    actorId: actor.id,
    payload: {
      attendanceUuid: data.uuid,
      workDate: record.workDate,
      earlyLeaveMinutes,
      offline: time.offline,
      timeSuspicious: time.suspicious,
      deviceAt: data.deviceAt,
    },
    occurredAt: at,
  });
  if (await deps.shifts.hasOpenShift(actor.id)) {
    await deps.audit.record({
      type: "clock_out_with_open_till",
      actorId: actor.id,
      payload: { attendanceUuid: data.uuid, workDate: record.workDate },
      occurredAt: at,
    });
  }
}

// What the clock-in screen needs (cached on the device for offline use).
export async function attendanceTodayUseCase(
  deps: AttendanceDeps,
  userId: number,
): Promise<AttendanceTodayState> {
  const now = nowOf(deps);
  const today = storeDateKey(now);
  const [schedules, open, todays] = await Promise.all([
    deps.schedules.listByUser(userId),
    deps.attendance.listOpen(userId),
    deps.attendance.listByDates(today, today, userId),
  ]);
  return {
    serverTime: now.toISOString(),
    schedules,
    open: open.map((r) => ({
      uuid: r.uuid,
      workDate: r.workDate,
      clockInAt: r.clockInAt.toISOString(),
    })),
    closedToday: todays
      .filter((r) => r.clockOutAt)
      .map((r) => ({
        uuid: r.uuid,
        clockInAt: r.clockInAt.toISOString(),
        clockOutAt: r.clockOutAt!.toISOString(),
      })),
  };
}

// "Abrir caja" well outside of the person's schedule is audited (never
// blocked: the sale must go on).
export async function auditShiftOpeningUseCase(
  deps: AttendanceDeps,
  // The shift opening as the device sent it (already validated).
  data: { uuid: string; openedAt: string },
  actor: Actor,
) {
  if (!requiresAttendance(actor.role)) return;
  const openedAt = new Date(data.openedAt);
  if (Number.isNaN(openedAt.getTime())) return;
  const shift = scheduleFor(storeDateKey(openedAt), await deps.schedules.listByUser(actor.id));
  if (!isOffSchedule(openedAt, shift)) return;
  // Keyed by the shift's uuid: a retried opening doesn't audit twice.
  await deps.audit.recordWithUuid(data.uuid, {
    type: "shift_opened_off_schedule",
    actorId: actor.id,
    payload: {
      shiftUuid: data.uuid,
      scheduledStart: shift?.start.toISOString() ?? null,
      scheduledEnd: shift?.end.toISOString() ?? null,
    },
    occurredAt: openedAt,
  });
}
