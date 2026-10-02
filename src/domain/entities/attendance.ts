import type { UserRole } from "./user";

// Attendance of the store's staff (cashiers and warehouse keepers), not of
// the airport workers (customers with a discount, who never log in).

export type AttendanceStatus = "open" | "closed" | "missing_clock_out";
export type AttendanceField = "clock_in" | "clock_out";
export type AttendanceCorrectionStatus = "pending" | "approved" | "rejected";

export const ATTENDANCE_FIELD_LABELS: Record<AttendanceField, string> = {
  clock_in: "Entrada",
  clock_out: "Salida",
};

export const ATTENDANCE_CORRECTION_STATUS_LABELS: Record<AttendanceCorrectionStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
};

// Business rule: cashiers and warehouse keepers must mark their entrance
// before working. The admin may mark, but is never blocked.
export function requiresAttendance(role: UserRole) {
  return role === "cashier" || role === "warehouse";
}

// Device clock further than this from the server's makes a mark suspicious.
export const SUSPICIOUS_CLOCK_MS = 5 * 60 * 1000;
// Opening the till this long before the start or after the end of the
// schedule is audited as "outside of schedule".
export const OFF_SCHEDULE_MARGIN_MIN = 30;
export const DEFAULT_TOLERANCE_MIN = 10;

// One working weekday of a person's weekly schedule (0 = Sunday).
export interface WorkSchedule {
  userId: number;
  weekday: number;
  // "HH:MM", store time. An end before the start ends the next day.
  startTime: string;
  endTime: string;
  toleranceMin: number;
}

export interface AttendanceRecord {
  id: number;
  uuid: string;
  userId: number;
  userName: string;
  workDate: string;
  clockInAt: Date;
  clockOutAt: Date | null;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  toleranceMin: number | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  status: AttendanceStatus;
  offline: boolean;
  timeSuspicious: boolean;
  isCorrected: boolean;
  createdByName: string | null;
}

// Everything stored about a workday, for the admin's audit trail.
export interface AttendanceRecordDetail extends AttendanceRecord {
  clockInDeviceAt: Date | null;
  clockInReceivedAt: Date;
  clockOutDeviceAt: Date | null;
  clockOutReceivedAt: Date | null;
  createdAt: Date;
}

export interface AttendanceCorrection {
  id: number;
  uuid: string;
  attendanceUuid: string;
  attendanceId: number | null;
  userName: string | null;
  workDate: string | null;
  field: AttendanceField;
  oldValue: Date | null;
  newValue: Date;
  reason: string;
  requestedById: number;
  requestedByName: string;
  status: AttendanceCorrectionStatus;
  reviewedByName: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  createdAt: Date;
}

// Staff member as listed in the attendance reports.
export interface AttendancePerson {
  id: number;
  name: string;
  role: UserRole;
  isActive: boolean;
  // Store date the user was created: no absences before it.
  since: string;
}

// What the device needs to show the clock-in screen without internet.
export interface AttendanceTodayState {
  serverTime: string;
  schedules: WorkSchedule[];
  // The person's workdays still open (today's, or a forgotten one).
  open: { uuid: string; workDate: string; clockInAt: string }[];
  // Today's workdays already closed (to tell "you already left").
  closedToday: { uuid: string; clockInAt: string; clockOutAt: string }[];
}
