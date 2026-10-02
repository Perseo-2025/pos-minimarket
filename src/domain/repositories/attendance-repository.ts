import type {
  AttendanceCorrection,
  AttendanceCorrectionStatus,
  AttendanceField,
  AttendancePerson,
  AttendanceRecord,
  AttendanceRecordDetail,
} from "../entities/attendance";

export interface NewAttendanceRecord {
  uuid: string;
  userId: number;
  workDate: string;
  clockInAt: Date;
  clockInDeviceAt: Date | null;
  clockInReceivedAt: Date;
  clockOutAt?: Date | null;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  toleranceMin: number | null;
  lateMinutes: number;
  earlyLeaveMinutes?: number;
  offline: boolean;
  timeSuspicious: boolean;
  isCorrected?: boolean;
  createdBy?: number | null;
}

export interface NewAttendanceCorrection {
  uuid: string;
  attendanceUuid: string;
  field: AttendanceField;
  oldValue: Date | null;
  newValue: Date;
  reason: string;
  requestedBy: number;
  // Made by an admin directly: born approved.
  approvedBy?: number;
}

// Workdays are keyed by the device's uuid: marks made without internet may be
// sent more than once and must not duplicate.
export interface AttendanceRepository {
  // false when the uuid already existed (retried sync).
  insert(record: NewAttendanceRecord): Promise<boolean>;
  findByUuid(uuid: string): Promise<AttendanceRecordDetail | null>;
  findById(id: number): Promise<AttendanceRecordDetail | null>;
  // The person's other open workdays become "forgot to mark the exit".
  markForgotten(userId: number, exceptUuid: string): Promise<void>;
  // Only once: false if the exit was already marked.
  clockOut(data: {
    uuid: string;
    clockOutAt: Date;
    deviceAt: Date | null;
    receivedAt: Date;
    earlyLeaveMinutes: number;
    offline: boolean;
    timeSuspicious: boolean;
  }): Promise<boolean>;
  // An approved correction: new effective times, lateness recomputed.
  applyCorrection(data: {
    uuid: string;
    clockInAt: Date;
    clockOutAt: Date | null;
    workDate: string;
    lateMinutes: number;
    earlyLeaveMinutes: number;
  }): Promise<void>;
  listOpen(userId: number): Promise<AttendanceRecord[]>;
  // Workdays whose work_date is in [from, to] (YYYY-MM-DD), oldest first.
  listByDates(from: string, to: string, userId?: number): Promise<AttendanceRecord[]>;
  // Cashiers and warehouse keepers, plus anyone else who has marked.
  listPeople(): Promise<AttendancePerson[]>;

  insertCorrection(correction: NewAttendanceCorrection): Promise<boolean>;
  findCorrection(id: number): Promise<AttendanceCorrection | null>;
  findCorrectionByUuid(uuid: string): Promise<AttendanceCorrection | null>;
  listCorrections(filter: {
    status?: AttendanceCorrectionStatus;
    attendanceUuid?: string;
    limit: number;
  }): Promise<AttendanceCorrection[]>;
  countPendingCorrections(): Promise<number>;
  // Only a pending one: false if someone else already reviewed it.
  reviewCorrection(data: {
    id: number;
    status: "approved" | "rejected";
    reviewerId: number;
    note: string | null;
  }): Promise<boolean>;
}
