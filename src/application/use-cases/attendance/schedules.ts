import type { UserRole } from "@/domain/entities/user";
import { saveScheduleSchema } from "@/application/validation/attendance";
import { nowOf, type AttendanceDeps } from "./deps";

export function listSchedulesUseCase(deps: AttendanceDeps) {
  return deps.schedules.listAll();
}

// The whole week of one person. Changes are audited: schedules decide who
// was late.
export async function saveScheduleUseCase(
  deps: AttendanceDeps,
  input: unknown,
  admin: { id: number; role: UserRole },
) {
  const data = saveScheduleSchema.parse(input);
  await deps.schedules.replaceForUser(data.userId, data.days, admin.id);
  await deps.audit.record({
    type: "work_schedule_changed",
    actorId: admin.id,
    payload: { userId: data.userId, days: data.days },
    occurredAt: nowOf(deps),
  });
}
