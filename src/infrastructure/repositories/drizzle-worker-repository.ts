import { and, count, desc, eq, gt, gte, ne, sql } from "drizzle-orm";
import {
  type WorkerNameSource,
  type WorkerStatus,
  type WorkerWithPin,
  withoutPin,
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

function toWorker(row: WorkerRow): WorkerWithPin {
  return {
    id: row.id,
    dni: row.dni,
    fullName: row.fullName,
    nameSource: row.nameSource,
    company: row.company,
    status: row.status,
    pendingReason: row.status === "pending" ? row.pendingReason : null,
    pointsBalance: row.pointsBalance,
    registeredById: row.registeredBy,
    registeredByName: row.registeredByName ?? null,
    approvedAt: row.approvedAt,
    createdAt: row.createdAt,
    pinHash: row.pinHash,
  };
}

function selectWorkers() {
  return db
    .select({ worker: workers, registeredByName: users.name })
    .from(workers)
    .leftJoin(users, eq(workers.registeredBy, users.id));
}

// Only sales that actually had a discount count toward the caps.
const discounted = gt(sales.discountTotal, "0");

export class DrizzleWorkerRepository implements WorkerRepository {
  async findById(id: string) {
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
      withoutPin(toWorker({ ...row.worker, registeredByName: row.registeredByName })),
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
        id: data.id,
        dni: data.dni,
        fullName: data.fullName,
        nameSource: data.nameSource,
        company: data.company,
        pinHash: data.pinHash,
        status: "pending",
        pendingReason: "new",
        registeredBy: data.registeredById,
      })
      .onConflictDoNothing({ target: workers.id })
      .returning({ id: workers.id });
    return rows.length > 0;
  }

  async replacePin(id: string, pinHash: string) {
    await db
      .update(workers)
      .set({
        pinHash,
        pinUpdatedAt: new Date(),
        status: "pending",
        pendingReason: "pin_reset",
        updatedAt: new Date(),
      })
      .where(eq(workers.id, id));
  }

  async setStatus(id: string, status: WorkerStatus, actorId: string) {
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

  async updateName(id: string, fullName: string, nameSource: WorkerNameSource) {
    await db
      .update(workers)
      .set({ fullName, nameSource, updatedAt: new Date() })
      .where(eq(workers.id, id));
  }

  async discountUsage(workerId: string, dayStart: Date, monthStart: Date) {
    const [row] = await db
      .select({
        today: sql<number>`count(*) filter (where ${sales.clientCreatedAt} >= ${dayStart.toISOString()}::timestamptz)`.mapWith(
          Number,
        ),
        month: sql<string>`coalesce(sum(${sales.discountTotal}), 0)`,
      })
      .from(sales)
      .where(
        and(
          eq(sales.workerId, workerId),
          discounted,
          ne(sales.status, "voided"),
          gte(sales.clientCreatedAt, monthStart),
        ),
      );

    return {
      discountedSalesToday: row?.today ?? 0,
      discountThisMonth: Number(row?.month ?? 0),
    };
  }

  async offlineSnapshot(dayStart: Date, monthStart: Date): Promise<OfflineWorker[]> {
    const usage = db
      .select({
        workerId: sales.workerId,
        today: sql<number>`count(*) filter (where ${sales.clientCreatedAt} >= ${dayStart.toISOString()}::timestamptz)`
          .mapWith(Number)
          .as("today"),
        month: sql<string>`coalesce(sum(${sales.discountTotal}), 0)`.as("month"),
      })
      .from(sales)
      .where(
        and(discounted, ne(sales.status, "voided"), gte(sales.clientCreatedAt, monthStart)),
      )
      .groupBy(sales.workerId)
      .as("usage");

    const rows = await db
      .select({
        worker: workers,
        today: usage.today,
        month: usage.month,
      })
      .from(workers)
      .leftJoin(usage, eq(usage.workerId, workers.id))
      .where(ne(workers.status, "rejected"));

    return rows.map(({ worker, today, month }) => ({
      id: worker.id,
      dni: worker.dni,
      fullName: worker.fullName,
      company: worker.company,
      status: worker.status,
      // Only active workers can get a discount, so only they need a hash.
      pinHash: worker.status === "active" ? worker.pinHash : null,
      pointsBalance: worker.pointsBalance,
      usage: {
        discountedSalesToday: Number(today ?? 0),
        discountThisMonth: Number(month ?? 0),
      },
    }));
  }

  async purchaseHistory(workerId: string, limit: number) {
    const rows = await db
      .select({
        saleId: sales.id,
        clientCreatedAt: sales.clientCreatedAt,
        cashierName: users.name,
        subtotal: sales.subtotal,
        discountTotal: sales.discountTotal,
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
      total: Number(row.total),
    }));
  }
}
