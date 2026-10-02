import type { AttendanceRepository } from "@/domain/repositories/attendance-repository";
import type { AuditRepository } from "@/domain/repositories/audit-repository";
import type { CashShiftRepository } from "@/domain/repositories/cash-shift-repository";
import type { WorkScheduleRepository } from "@/domain/repositories/work-schedule-repository";
import type { ScheduledShift } from "@/domain/services/attendance";

export interface AttendanceDeps {
  attendance: AttendanceRepository;
  schedules: WorkScheduleRepository;
  audit: Pick<AuditRepository, "record" | "recordWithUuid">;
  shifts: Pick<CashShiftRepository, "hasOpenShift">;
  // Server clock (injectable for tests).
  now?: () => Date;
}

export const nowOf = (deps: AttendanceDeps) => (deps.now ? deps.now() : new Date());

// The schedule frozen in the workday at clock-in.
export function snapshotShift(record: {
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  toleranceMin: number | null;
}): ScheduledShift | null {
  if (!record.scheduledStart || !record.scheduledEnd) return null;
  return {
    start: record.scheduledStart,
    end: record.scheduledEnd,
    toleranceMin: record.toleranceMin ?? 0,
  };
}
