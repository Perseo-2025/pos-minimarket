import type {
  AttendancePerson,
  AttendanceRecord,
} from "@/domain/entities/attendance";
import {
  buildPersonDay,
  dateKeysBetween,
  summarizeDays,
  type AttendanceTotals,
  type PersonDay,
} from "@/domain/services/attendance";
import { nowOf, type AttendanceDeps } from "./deps";

export interface PersonReport {
  person: AttendancePerson;
  days: PersonDay<AttendanceRecord>[];
  totals: AttendanceTotals;
}

// Every person, every day of [from, to]: marks against their schedule,
// absences included. The base of the daily, monthly and range views.
export async function attendanceReportUseCase(
  deps: AttendanceDeps,
  range: { from: string; to: string; userId?: number },
): Promise<PersonReport[]> {
  const now = nowOf(deps);
  const [people, schedules, records] = await Promise.all([
    deps.attendance.listPeople(),
    deps.schedules.listAll(),
    deps.attendance.listByDates(range.from, range.to, range.userId),
  ]);
  const keys = dateKeysBetween(range.from, range.to);

  return people
    .filter((person) => range.userId === undefined || person.id === range.userId)
    .map((person) => {
      const own = records.filter((r) => r.userId === person.id);
      const mine = schedules.filter((s) => s.userId === person.id);
      // A deactivated person no longer "misses" days.
      const since = person.isActive ? person.since : "9999-12-31";
      const days = keys.map((key) =>
        buildPersonDay(
          key,
          mine,
          own.filter((r) => r.workDate === key),
          now,
          since,
        ),
      );
      return { person, days, totals: summarizeDays(days) };
    })
    .filter((report) => report.person.isActive || report.totals.daysWorked > 0);
}

// One workday with its full trail: the original marks (device and server
// times) and every correction, approved or not.
export async function attendanceHistoryUseCase(deps: AttendanceDeps, id: number) {
  const record = await deps.attendance.findById(id);
  if (!record) return null;
  const corrections = await deps.attendance.listCorrections({
    attendanceUuid: record.uuid,
    limit: 100,
  });
  return { record, corrections };
}

export function listCorrectionsUseCase(
  deps: AttendanceDeps,
  status: "pending" | undefined,
) {
  return deps.attendance.listCorrections({ status, limit: 200 });
}
