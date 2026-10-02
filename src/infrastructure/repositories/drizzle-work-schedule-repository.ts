import { asc, eq } from "drizzle-orm";
import type { WorkSchedule } from "@/domain/entities/attendance";
import type { WorkScheduleRepository } from "@/domain/repositories/work-schedule-repository";
import { db } from "@/infrastructure/db/client";
import { workSchedules } from "@/infrastructure/db/schema";

// Postgres returns time columns as "07:00:00".
const hhmm = (value: string) => value.slice(0, 5);

function toSchedule(row: typeof workSchedules.$inferSelect): WorkSchedule {
  return {
    userId: row.userId,
    weekday: row.weekday,
    startTime: hhmm(row.startTime),
    endTime: hhmm(row.endTime),
    toleranceMin: row.toleranceMin,
  };
}

export class DrizzleWorkScheduleRepository implements WorkScheduleRepository {
  async listByUser(userId: number) {
    const rows = await db
      .select()
      .from(workSchedules)
      .where(eq(workSchedules.userId, userId))
      .orderBy(asc(workSchedules.weekday));
    return rows.map(toSchedule);
  }

  async listAll() {
    const rows = await db
      .select()
      .from(workSchedules)
      .orderBy(asc(workSchedules.userId), asc(workSchedules.weekday));
    return rows.map(toSchedule);
  }

  async replaceForUser(
    userId: number,
    days: Omit<WorkSchedule, "userId">[],
    actorId: number,
  ) {
    await db.transaction(async (tx) => {
      await tx.delete(workSchedules).where(eq(workSchedules.userId, userId));
      if (days.length === 0) return;
      await tx.insert(workSchedules).values(
        days.map((day) => ({ ...day, userId, updatedBy: actorId, updatedAt: new Date() })),
      );
    });
  }
}
