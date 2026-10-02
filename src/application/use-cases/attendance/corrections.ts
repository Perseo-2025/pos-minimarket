import type { AttendanceField, AttendanceRecordDetail } from "@/domain/entities/attendance";
import type { UserRole } from "@/domain/entities/user";
import { ValidationError } from "@/domain/errors";
import {
  computeEarlyLeave,
  computeLateMinutes,
  scheduleFor,
} from "@/domain/services/attendance";
import { STORE_UTC_OFFSET, storeDateKey } from "@/domain/value-objects/store-time";
import {
  addAttendanceSchema,
  adminCorrectSchema,
  requestCorrectionSchema,
  reviewCorrectionSchema,
} from "@/application/validation/attendance";
import { assertOwnMark } from "./clock";
import { nowOf, snapshotShift, type AttendanceDeps } from "./deps";

type Actor = { id: number; role: UserRole };

const DAY_MS = 24 * 60 * 60 * 1000;

// The new time must make sense for that workday: never in the future, the
// exit after the entrance and within a day of it.
function checkNewValue(
  record: AttendanceRecordDetail,
  field: AttendanceField,
  value: Date,
  now: Date,
) {
  if (value > now) throw new ValidationError("La hora no puede ser en el futuro");
  if (field === "clock_out") {
    if (value <= record.clockInAt) {
      throw new ValidationError("La salida debe ser después de la entrada");
    }
    if (value.getTime() - record.clockInAt.getTime() > DAY_MS) {
      throw new ValidationError("La salida no puede ser más de 24 horas después de la entrada");
    }
  } else if (record.clockOutAt && value >= record.clockOutAt) {
    throw new ValidationError("La entrada debe ser antes de la salida");
  }
}

// Nobody fixes their own marks, not even an admin who marks.
function notOwn(record: AttendanceRecordDetail, actor: Actor) {
  if (record.userId === actor.id) {
    throw new ValidationError("No puedes corregir tu propia marca: pídeselo a otro administrador");
  }
}

// Applies an approved change: new effective time, lateness and early leave
// recomputed against the schedule frozen at clock-in.
async function apply(
  deps: AttendanceDeps,
  record: AttendanceRecordDetail,
  field: AttendanceField,
  value: Date,
) {
  const clockInAt = field === "clock_in" ? value : record.clockInAt;
  const clockOutAt = field === "clock_out" ? value : record.clockOutAt;
  const shift = snapshotShift(record);
  await deps.attendance.applyCorrection({
    uuid: record.uuid,
    clockInAt,
    clockOutAt,
    workDate: record.workDate,
    lateMinutes: computeLateMinutes(clockInAt, shift),
    earlyLeaveMinutes: clockOutAt ? computeEarlyLeave(clockOutAt, shift) : 0,
  });
}

// "Ayer no marcaste salida. ¿A qué hora saliste?" — asked by the person
// (also offline), it waits for an admin.
export async function requestCorrectionUseCase(
  deps: AttendanceDeps,
  input: unknown,
  actor: Actor,
) {
  const data = requestCorrectionSchema.parse(input);
  assertOwnMark(data, actor);
  if (await deps.attendance.findCorrectionByUuid(data.uuid)) return;
  const record = await deps.attendance.findByUuid(data.attendanceUuid);
  if (!record) throw new ValidationError("La jornada no existe");
  if (record.userId !== actor.id) throw new ValidationError("Esta jornada es de otra persona");

  const now = nowOf(deps);
  const newValue = new Date(data.newValue);
  checkNewValue(record, data.field, newValue, now);
  const oldValue = data.field === "clock_in" ? record.clockInAt : record.clockOutAt;

  const inserted = await deps.attendance.insertCorrection({
    uuid: data.uuid,
    attendanceUuid: record.uuid,
    field: data.field,
    oldValue,
    newValue,
    reason: data.reason,
    requestedBy: actor.id,
  });
  if (!inserted) return;
  await deps.audit.recordWithUuid(data.uuid, {
    type: "attendance_correction_requested",
    actorId: actor.id,
    payload: {
      attendanceUuid: record.uuid,
      workDate: record.workDate,
      field: data.field,
      oldValue: oldValue?.toISOString() ?? null,
      newValue: newValue.toISOString(),
      reason: data.reason,
    },
    occurredAt: now,
  });
}

export async function reviewCorrectionUseCase(
  deps: AttendanceDeps,
  input: unknown,
  admin: Actor,
) {
  const data = reviewCorrectionSchema.parse(input);
  const correction = await deps.attendance.findCorrection(data.id);
  if (!correction) throw new ValidationError("La solicitud no existe");
  if (correction.status !== "pending") throw new ValidationError("Esta solicitud ya fue revisada");
  const record = await deps.attendance.findByUuid(correction.attendanceUuid);
  if (!record) throw new ValidationError("La jornada no existe");
  notOwn(record, admin);
  const now = nowOf(deps);
  if (data.approve) checkNewValue(record, correction.field, correction.newValue, now);

  const reviewed = await deps.attendance.reviewCorrection({
    id: correction.id,
    status: data.approve ? "approved" : "rejected",
    reviewerId: admin.id,
    note: data.note,
  });
  if (!reviewed) throw new ValidationError("Esta solicitud ya fue revisada");
  if (data.approve) await apply(deps, record, correction.field, correction.newValue);

  await deps.audit.record({
    type: data.approve ? "attendance_correction_approved" : "attendance_correction_rejected",
    actorId: admin.id,
    payload: {
      attendanceUuid: record.uuid,
      correctionId: correction.id,
      userId: record.userId,
      workDate: record.workDate,
      field: correction.field,
      oldValue: correction.oldValue?.toISOString() ?? null,
      newValue: correction.newValue.toISOString(),
      note: data.note,
    },
    occurredAt: now,
  });
}

// The admin fixes a mark directly, with a reason. Recorded as an approved
// correction, so the original value is kept.
export async function adminCorrectUseCase(
  deps: AttendanceDeps,
  input: unknown,
  admin: Actor,
) {
  const data = adminCorrectSchema.parse(input);
  const record = await deps.attendance.findById(data.attendanceId);
  if (!record) throw new ValidationError("La jornada no existe");
  notOwn(record, admin);
  const now = nowOf(deps);
  const newValue = new Date(data.newValue);
  checkNewValue(record, data.field, newValue, now);
  const oldValue = data.field === "clock_in" ? record.clockInAt : record.clockOutAt;
  const uuid = crypto.randomUUID();

  await deps.attendance.insertCorrection({
    uuid,
    attendanceUuid: record.uuid,
    field: data.field,
    oldValue,
    newValue,
    reason: data.reason,
    requestedBy: admin.id,
    approvedBy: admin.id,
  });
  await apply(deps, record, data.field, newValue);
  await deps.audit.recordWithUuid(uuid, {
    type: "attendance_correction_approved",
    actorId: admin.id,
    payload: {
      attendanceUuid: record.uuid,
      userId: record.userId,
      workDate: record.workDate,
      field: data.field,
      oldValue: oldValue?.toISOString() ?? null,
      newValue: newValue.toISOString(),
      reason: data.reason,
      direct: true,
    },
    occurredAt: now,
  });
}

const atStore = (dateKey: string, hhmm: string) =>
  new Date(`${dateKey}T${hhmm}:00.000${STORE_UTC_OFFSET}`);

// A workday the person could not mark at all (the tablet broke, no
// battery). Shown as "added by the admin" forever.
export async function addAttendanceUseCase(
  deps: AttendanceDeps,
  input: unknown,
  admin: Actor,
) {
  const data = addAttendanceSchema.parse(input);
  if (data.userId === admin.id) {
    throw new ValidationError("No puedes agregar tu propia jornada: pídeselo a otro administrador");
  }
  const now = nowOf(deps);
  if (data.workDate > storeDateKey(now)) throw new ValidationError("La fecha no puede ser futura");
  const clockInAt = atStore(data.workDate, data.clockIn);
  let clockOutAt = data.clockOut ? atStore(data.workDate, data.clockOut) : null;
  // Exit earlier than the entrance: a night shift that ended the next day.
  if (clockOutAt && clockOutAt <= clockInAt) clockOutAt = new Date(clockOutAt.getTime() + DAY_MS);
  if (clockInAt > now || (clockOutAt && clockOutAt > now)) {
    throw new ValidationError("La hora no puede ser en el futuro");
  }

  const shift = scheduleFor(data.workDate, await deps.schedules.listByUser(data.userId));
  const uuid = crypto.randomUUID();
  await deps.attendance.insert({
    uuid,
    userId: data.userId,
    workDate: data.workDate,
    clockInAt,
    clockInDeviceAt: null,
    clockInReceivedAt: now,
    clockOutAt,
    scheduledStart: shift?.start ?? null,
    scheduledEnd: shift?.end ?? null,
    toleranceMin: shift?.toleranceMin ?? null,
    lateMinutes: computeLateMinutes(clockInAt, shift),
    earlyLeaveMinutes: clockOutAt ? computeEarlyLeave(clockOutAt, shift) : 0,
    offline: false,
    timeSuspicious: false,
    isCorrected: true,
    createdBy: admin.id,
  });
  await deps.audit.recordWithUuid(uuid, {
    type: "attendance_added",
    actorId: admin.id,
    payload: {
      attendanceUuid: uuid,
      userId: data.userId,
      workDate: data.workDate,
      clockIn: clockInAt.toISOString(),
      clockOut: clockOutAt?.toISOString() ?? null,
      reason: data.reason,
    },
    occurredAt: now,
  });
}
