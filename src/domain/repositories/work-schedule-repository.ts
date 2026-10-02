import type { WorkSchedule } from "../entities/attendance";

export interface WorkScheduleRepository {
  listByUser(userId: number): Promise<WorkSchedule[]>;
  listAll(): Promise<WorkSchedule[]>;
  // The whole week at once: weekdays left out become days off.
  replaceForUser(
    userId: number,
    days: Omit<WorkSchedule, "userId">[],
    actorId: number,
  ): Promise<void>;
}
