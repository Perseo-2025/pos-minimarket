import { attendanceTodayUseCase } from "@/application/use-cases/attendance/clock";
import { requiresAttendance } from "@/domain/entities/attendance";
import type { UserRole } from "@/domain/entities/user";
import { attendanceDeps } from "@/infrastructure/deps";

// What the server knows about today's attendance, for the first render of
// the till / warehouse. Null for the admin or if the database is unreachable
// (the device's own copy is used then).
export async function initialAttendance(user: { id: number; role: UserRole }) {
  if (!requiresAttendance(user.role)) return null;
  try {
    return await attendanceTodayUseCase(attendanceDeps, user.id);
  } catch (error) {
    console.error("Attendance state unavailable", error);
    return null;
  }
}
