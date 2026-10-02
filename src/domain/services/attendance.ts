import {
  OFF_SCHEDULE_MARGIN_MIN,
  SUSPICIOUS_CLOCK_MS,
  type AttendanceStatus,
  type WorkSchedule,
} from "../entities/attendance";
import { STORE_UTC_OFFSET, storeDateKey } from "../value-objects/store-time";

// Attendance rules: schedules, lateness, absences and how much to trust the
// time a device says a mark was made. Pure, so the till (offline) and the
// server compute exactly the same thing.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
// An open workday older than this was not closed (forgot to mark the exit).
const MAX_OPEN_MS = 16 * HOUR;

export const WEEKDAY_LABELS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
export const WEEKDAY_SHORT = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];
// The week starts on Monday in Peru.
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

// ---- Dates (YYYY-MM-DD keys in the store's zone) ----

export function weekdayOf(dateKey: string) {
  return new Date(`${dateKey}T12:00:00Z`).getUTCDay();
}

export function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function dateKeysBetween(from: string, to: string) {
  const keys: string[] = [];
  for (let key = from; key <= to; key = addDays(key, 1)) keys.push(key);
  return keys;
}

// "2026-10" → first and last day of the month.
export function monthRange(month: string) {
  const from = `${month}-01`;
  const next = new Date(`${from}T12:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1, 0);
  return { from, to: next.toISOString().slice(0, 10) };
}

// The month as weeks of 7 cells, Monday first; null = outside the month.
export function monthGrid(month: string): (string | null)[][] {
  const { from, to } = monthRange(month);
  const days = dateKeysBetween(from, to);
  const lead = WEEK_ORDER.indexOf(weekdayOf(from));
  const cells: (string | null)[] = [...Array(lead).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// ---- Schedule ----

export interface ScheduledShift {
  start: Date;
  end: Date;
  toleranceMin: number;
}

function atStoreTime(dateKey: string, hhmm: string) {
  return new Date(`${dateKey}T${hhmm.slice(0, 5)}:00.000${STORE_UTC_OFFSET}`);
}

// The person's shift on that date, or null if it's their day off.
export function scheduleFor(
  dateKey: string,
  schedules: Pick<WorkSchedule, "weekday" | "startTime" | "endTime" | "toleranceMin">[],
): ScheduledShift | null {
  const day = schedules.find((s) => s.weekday === weekdayOf(dateKey));
  if (!day) return null;
  const start = atStoreTime(dateKey, day.startTime);
  let end = atStoreTime(dateKey, day.endTime);
  // Night shift: ends the next day.
  if (end <= start) end = atStoreTime(addDays(dateKey, 1), day.endTime);
  return { start, end, toleranceMin: day.toleranceMin };
}

// Minutes late counted from the start, but only once past the tolerance
// (tolerance 10: arriving 07:08 is on time, 07:25 is 25 minutes late).
export function computeLateMinutes(clockIn: Date, shift: ScheduledShift | null) {
  if (!shift) return 0;
  const late = Math.floor((clockIn.getTime() - shift.start.getTime()) / MINUTE);
  return late > shift.toleranceMin ? late : 0;
}

export function computeEarlyLeave(clockOut: Date, shift: ScheduledShift | null) {
  if (!shift) return 0;
  return Math.max(0, Math.floor((shift.end.getTime() - clockOut.getTime()) / MINUTE));
}

export function workedMinutes(clockIn: Date, clockOut: Date) {
  return Math.max(0, Math.floor((clockOut.getTime() - clockIn.getTime()) / MINUTE));
}

// Opening the till well before the start or after the end of the shift (or
// on a day off) is worth an audit entry.
export function isOffSchedule(at: Date, shift: ScheduledShift | null) {
  if (!shift) return true;
  const margin = OFF_SCHEDULE_MARGIN_MIN * MINUTE;
  return (
    at.getTime() < shift.start.getTime() - margin ||
    at.getTime() > shift.end.getTime() + margin
  );
}

// ---- Trusting the device's clock ----

export interface PunchTimeInput {
  // Device clock when the button was pressed.
  deviceAt: Date;
  // Device clock when the request left the device.
  sentAt: Date;
  // Server clock when it arrived.
  receivedAt: Date;
  // Sent the moment it was marked (not replayed from the offline queue).
  live: boolean;
  // The device saw its clock go backwards since its last check.
  clockMovedBack: boolean;
}

// Online, the server's clock decides. Offline, the device time is corrected
// by how wrong the device clock is when it finally syncs (a clock moved back
// to fake an earlier arrival is usually still wrong then). A clock off by
// more than 5 minutes, or that went backwards, makes the mark suspicious.
export function resolvePunchTime(input: PunchTimeInput) {
  const received = input.receivedAt.getTime();
  if (input.live) {
    return { at: input.receivedAt, offline: false, suspicious: false };
  }
  const offset = received - input.sentAt.getTime();
  const corrected = Math.min(input.deviceAt.getTime() + offset, received);
  return {
    at: new Date(corrected),
    offline: true,
    suspicious: Math.abs(offset) > SUSPICIOUS_CLOCK_MS || input.clockMovedBack,
  };
}

// ---- Reports ----

export type DayStatus =
  | "on_time"
  | "late"
  | "absent"
  | "no_clock_out"
  | "working"
  | "day_off"
  // Worked on a day without schedule.
  | "extra"
  // Scheduled today, still within the tolerance.
  | "pending"
  // Future, or before the person existed.
  | "none";

export const DAY_STATUS_LABELS: Record<DayStatus, string> = {
  on_time: "A tiempo",
  late: "Tardanza",
  absent: "Falta",
  no_clock_out: "Sin salida",
  working: "Trabajando",
  day_off: "Libre",
  extra: "Fuera de horario",
  pending: "Aún no llega",
  none: "",
};

export interface DayRecordInput {
  workDate: string;
  clockInAt: Date;
  clockOutAt: Date | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  status: AttendanceStatus;
  isCorrected: boolean;
  offline: boolean;
  timeSuspicious: boolean;
}

export interface PersonDay<R extends DayRecordInput = DayRecordInput> {
  dateKey: string;
  status: DayStatus;
  shift: ScheduledShift | null;
  records: R[];
  workedMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  corrected: boolean;
  offline: boolean;
  suspicious: boolean;
}

function isForgotten(record: DayRecordInput, now: Date) {
  return (
    record.status === "missing_clock_out" ||
    now.getTime() - record.clockInAt.getTime() > MAX_OPEN_MS
  );
}

// One person on one date: their records that day against their schedule.
export function buildPersonDay<R extends DayRecordInput>(
  dateKey: string,
  schedules: WorkSchedule[],
  records: R[],
  now: Date,
  since: string,
): PersonDay<R> {
  const today = storeDateKey(now);
  const shift = scheduleFor(dateKey, schedules);
  const sorted = [...records].sort((a, b) => a.clockInAt.getTime() - b.clockInAt.getTime());
  const closed = sorted.filter((r) => r.clockOutAt !== null);
  const open = sorted.filter((r) => r.clockOutAt === null);

  const base = {
    dateKey,
    shift,
    records: sorted,
    workedMinutes: closed.reduce((sum, r) => sum + workedMinutes(r.clockInAt, r.clockOutAt!), 0),
    lateMinutes: sorted[0]?.lateMinutes ?? 0,
    earlyLeaveMinutes: closed.at(-1)?.earlyLeaveMinutes ?? 0,
    corrected: sorted.some((r) => r.isCorrected),
    offline: sorted.some((r) => r.offline),
    suspicious: sorted.some((r) => r.timeSuspicious),
  };

  let status: DayStatus;
  if (sorted.length === 0) {
    if (dateKey > today || dateKey < since) status = "none";
    else if (!shift) status = "day_off";
    else if (dateKey < today) status = "absent";
    else
      status =
        now.getTime() > shift.start.getTime() + shift.toleranceMin * MINUTE
          ? "absent"
          : "pending";
  } else if (open.some((r) => isForgotten(r, now))) {
    status = "no_clock_out";
  } else if (open.length > 0) {
    status = "working";
  } else if (base.lateMinutes > 0) {
    status = "late";
  } else if (!shift) {
    status = "extra";
  } else {
    status = "on_time";
  }

  return { ...base, status };
}

export interface AttendanceTotals {
  daysWorked: number;
  absences: number;
  lateCount: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workedMinutes: number;
  missingClockOut: number;
  extraDays: number;
}

export function summarizeDays(days: PersonDay[]): AttendanceTotals {
  const totals: AttendanceTotals = {
    daysWorked: 0,
    absences: 0,
    lateCount: 0,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    workedMinutes: 0,
    missingClockOut: 0,
    extraDays: 0,
  };
  for (const day of days) {
    if (day.records.length > 0) totals.daysWorked++;
    if (day.status === "absent") totals.absences++;
    if (day.status === "no_clock_out") totals.missingClockOut++;
    if (day.status === "extra") totals.extraDays++;
    if (day.lateMinutes > 0) {
      totals.lateCount++;
      totals.lateMinutes += day.lateMinutes;
    }
    totals.earlyLeaveMinutes += day.earlyLeaveMinutes;
    totals.workedMinutes += day.workedMinutes;
  }
  return totals;
}

// 485 → "8 h 05 min".
export function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, "0")} min`;
}
