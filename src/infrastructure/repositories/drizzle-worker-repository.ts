import { and, count, desc, eq, gt, gte, ne, sql } from "drizzle-orm";
import type {
  Worker,
  WorkerNameSource,
  WorkerStatus,
} from "@/domain/entities/worker";
import type {
  CreateWorkerData,
  OfflineWorker,
  WorkerRepository,
} from "@/domain/repositories/worker-repository";
import { db } from "@/infrastructure/db/client";
import { sales, users, workers } from "@/infrastructure/db/schema";

type WorkerRow = typeof workers.$inferSelect & {
  registeredByName?: string | null;
};

function toWorker(row: WorkerRow): Worker {
  return {
    id: row.id,
    uuid: row.uuid,
    dni: row.dni,
    fullName: row.fullName,
    nameSource: row.nameSource,
    company: row.company,
    birthDate: row.birthDate,
    status: row.status,
    pendingReason: row.status === "pending" ? row.pendingReason : null,
    pointsBalance: row.pointsBalance,
    registeredById: row.registeredBy,
    registeredByName: row.registeredByName ?? null,
    approvedAt: row.approvedAt,
    createdAt: row.createdAt,
  };
}

function selectWorkers() {
  return db
    .select({ worker: workers, registeredByName: users.name })
    .from(workers)
    .leftJoin(users, eq(workers.registeredBy, users.id));
}

// Only sales that actually had a discount count toward the daily cap; a
// birthday gift is any free line (courtesy_total) in the year.
const discounted = gt(sales.discountTotal, "0");
const withGift = gt(sales.giftTotal, "0");

function usageColumns(dayStart: Date) {
  return {
    today: sql<number>`count(*) filter (where ${discounted} and ${sales.clientCreatedAt} >= ${dayStart.toISOString()}::timestamptz)`.mapWith(
      Number,
    ),
    gifts: sql<number>`count(*) filter (where ${withGift})`.mapWith(Number),
  };
}

export class DrizzleWorkerRepository implements WorkerRepository {
  async findById(id: number) {
    const [row] = await selectWorkers().where(eq(workers.id, id)).limit(1);
    return row ? toWorker({ ...row.worker, registeredByName: row.registeredByName }) : null;
  }

  async findByDni(dni: string) {
    const [row] = await selectWorkers().where(eq(workers.dni, dni)).limit(1);
    return row ? toWorker({ ...row.worker, registeredByName: row.registeredByName }) : null;
  }

  async findAll(status?: WorkerStatus) {
    const query = selectWorkers();
    const rows = await (status ? query.where(eq(workers.status, status)) : query).orderBy(
      desc(workers.createdAt),
    );
    return rows.map((row) =>
      toWorker({ ...row.worker, registeredByName: row.registeredByName }),
    );
  }

  async countByStatus() {
    const rows = await db
      .select({ status: workers.status, total: count() })
      .from(workers)
      .groupBy(workers.status);

    const counts: Record<WorkerStatus, number> = {
      pending: 0,
      active: 0,
      suspended: 0,
      rejected: 0,
    };
    for (const row of rows) counts[row.status] = row.total;
    return counts;
  }

  async create(data: CreateWorkerData) {
    const rows = await db
      .insert(workers)
      .values({
        uuid: data.uuid,
        dni: data.dni,
        fullName: data.fullName,
        nameSource: data.nameSource,
        company: data.company,
        birthDate: data.birthDate,
        status: "pending",
        pendingReason: "new",
        registeredBy: data.registeredById,
      })
      .onConflictDoNothing({ target: workers.uuid })
      .returning({ id: workers.id });
    return rows[0]?.id ?? null;
  }

  async setStatus(id: number, status: WorkerStatus, actorId: number) {
    await db
      .update(workers)
      .set({
        status,
        ...(status === "active"
          ? { approvedBy: actorId, approvedAt: new Date(), pendingReason: null }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(workers.id, id));
  }

  async updateName(id: number, fullName: string, nameSource: WorkerNameSource) {
    await db
      .update(workers)
      .set({ fullName, nameSource, updatedAt: new Date() })
      .where(eq(workers.id, id));
  }

  async updateBirthDate(id: number, birthDate: string) {
    await db
      .update(workers)
      .set({ birthDate, updatedAt: new Date() })
      .where(eq(workers.id, id));
  }

  async discountUsage(workerId: number, dayStart: Date, yearStart: Date) {
    const [row] = await db
      .select(usageColumns(dayStart))
      .from(sales)
      .where(
        and(
          eq(sales.workerId, workerId),
          ne(sales.status, "voided"),
          gte(sales.clientCreatedAt, yearStart),
        ),
      );

    return {
      discountedSalesToday: row?.today ?? 0,
      giftUsedThisYear: (row?.gifts ?? 0) > 0,
    };
  }

  async offlineSnapshot(dayStart: Date, yearStart: Date): Promise<OfflineWorker[]> {
    const columns = usageColumns(dayStart);
    const usage = db
      .select({
        workerId: sales.workerId,
        today: columns.today.as("today"),
        gifts: columns.gifts.as("gifts"),
      })
      .from(sales)
      .where(and(ne(sales.status, "voided"), gte(sales.clientCreatedAt, yearStart)))
      .groupBy(sales.workerId)
      .as("usage");

    const rows = await db
      .select({ worker: workers, today: usage.today, gifts: usage.gifts })
      .from(workers)
      .leftJoin(usage, eq(usage.workerId, workers.id))
      .where(ne(workers.status, "rejected"));

    return rows.map(({ worker, today, gifts }) => ({
      id: worker.id,
      dni: worker.dni,
      fullName: worker.fullName,
      company: worker.company,
      birthDate: worker.birthDate,
      status: worker.status,
      pointsBalance: worker.pointsBalance,
      usage: {
        discountedSalesToday: Number(today ?? 0),
        giftUsedThisYear: Number(gifts ?? 0) > 0,
      },
    }));
  }

  async purchaseHistory(workerId: number, limit: number) {
    const rows = await db
      .select({
        saleId: sales.id,
        clientCreatedAt: sales.clientCreatedAt,
        cashierName: users.name,
        subtotal: sales.subtotal,
        discountTotal: sales.discountTotal,
        giftTotal: sales.giftTotal,
        total: sales.total,
        pointsEarned: sales.pointsEarned,
        auditFlags: sales.auditFlags,
      })
      .from(sales)
      .leftJoin(users, eq(sales.cashierId, users.id))
      .where(eq(sales.workerId, workerId))
      .orderBy(desc(sales.clientCreatedAt))
      .limit(limit);

    return rows.map((row) => ({
      ...row,
      subtotal: Number(row.subtotal),
      discountTotal: Number(row.discountTotal),
      giftTotal: Number(row.giftTotal),
      total: Number(row.total),
    }));
  }
}
