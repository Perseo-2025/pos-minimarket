import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type {
  AuditEventInput,
  AuditEventType,
  AuditFlag,
  CashierAuditSummary,
} from "@/domain/entities/audit";
import type { AuditRepository } from "@/domain/repositories/audit-repository";
import { db } from "@/infrastructure/db/client";
import { auditEvents, sales, users, workers } from "@/infrastructure/db/schema";

// OFFLINE_VERIFIED alone is informative, not suspicious: a sale "is flagged"
// only if it has any other flag.
const isFlagged = sql`cardinality(array_remove(${sales.auditFlags}, 'OFFLINE_VERIFIED')) > 0`;

function toRow(event: AuditEventInput) {
  return {
    type: event.type,
    actorId: event.actorId,
    workerId: event.workerId ?? null,
    saleId: event.saleId ?? null,
    payload: event.payload ?? {},
    occurredAt: event.occurredAt,
  };
}

export class DrizzleAuditRepository implements AuditRepository {
  async record(event: AuditEventInput) {
    await db.insert(auditEvents).values(toRow(event));
  }

  async recordWithId(id: string, event: AuditEventInput) {
    await db
      .insert(auditEvents)
      .values({ id, ...toRow(event) })
      .onConflictDoNothing({ target: auditEvents.id });
  }

  async listEvents(filter: {
    from: Date;
    to: Date;
    types?: AuditEventType[];
    limit: number;
  }) {
    const rows = await db
      .select({
        event: auditEvents,
        actorName: users.name,
        workerName: workers.fullName,
        workerDni: workers.dni,
      })
      .from(auditEvents)
      .leftJoin(users, eq(auditEvents.actorId, users.id))
      .leftJoin(workers, eq(auditEvents.workerId, workers.id))
      .where(
        and(
          gte(auditEvents.occurredAt, filter.from),
          lte(auditEvents.occurredAt, filter.to),
          filter.types?.length ? inArray(auditEvents.type, filter.types) : undefined,
        ),
      )
      .orderBy(desc(auditEvents.occurredAt))
      .limit(filter.limit);

    return rows.map(({ event, actorName, workerName, workerDni }) => ({
      id: event.id,
      type: event.type as AuditEventType,
      actorId: event.actorId,
      actorName,
      workerId: event.workerId,
      workerName,
      workerDni,
      saleId: event.saleId,
      payload: event.payload,
      occurredAt: event.occurredAt,
      createdAt: event.createdAt,
    }));
  }

  async countPinFailuresSince(workerId: string, since: Date) {
    const [row] = await db
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.workerId, workerId),
          eq(auditEvents.type, "worker_pin_failed"),
          gte(auditEvents.occurredAt, since),
        ),
      );
    return row?.total ?? 0;
  }

  async cashierSummary(from: Date, to: Date): Promise<CashierAuditSummary[]> {
    const saleRows = await db
      .select({
        cashierId: sales.cashierId,
        cashierName: users.name,
        sales: sql<number>`count(*)`.mapWith(Number),
        discountedSales: sql<number>`count(*) filter (where ${sales.discountTotal} > 0)`.mapWith(
          Number,
        ),
        discountTotal: sql<string>`coalesce(sum(${sales.discountTotal}), 0)`,
        offlineDiscountedSales: sql<number>`count(*) filter (where ${sales.discountTotal} > 0 and ${sales.workerVerification} = 'pin_offline')`.mapWith(
          Number,
        ),
        flaggedSales: sql<number>`count(*) filter (where ${isFlagged})`.mapWith(Number),
      })
      .from(sales)
      .innerJoin(users, eq(sales.cashierId, users.id))
      .where(and(gte(sales.clientCreatedAt, from), lte(sales.clientCreatedAt, to)))
      .groupBy(sales.cashierId, users.name);

    const eventRows = await db
      .select({
        actorId: auditEvents.actorId,
        actorName: users.name,
        pinFailures: sql<number>`count(*) filter (where ${auditEvents.type} = 'worker_pin_failed')`.mapWith(
          Number,
        ),
        pinResets: sql<number>`count(*) filter (where ${auditEvents.type} = 'worker_pin_reset_requested')`.mapWith(
          Number,
        ),
      })
      .from(auditEvents)
      .innerJoin(users, eq(auditEvents.actorId, users.id))
      .where(
        and(
          gte(auditEvents.occurredAt, from),
          lte(auditEvents.occurredAt, to),
          inArray(auditEvents.type, ["worker_pin_failed", "worker_pin_reset_requested"]),
        ),
      )
      .groupBy(auditEvents.actorId, users.name);

    const byCashier = new Map<string, CashierAuditSummary>();
    for (const row of saleRows) {
      byCashier.set(row.cashierId, {
        ...row,
        discountTotal: Number(row.discountTotal),
        pinFailures: 0,
        pinResets: 0,
      });
    }
    for (const row of eventRows) {
      if (!row.actorId) continue;
      const summary = byCashier.get(row.actorId) ?? {
        cashierId: row.actorId,
        cashierName: row.actorName,
        sales: 0,
        discountedSales: 0,
        discountTotal: 0,
        offlineDiscountedSales: 0,
        flaggedSales: 0,
        pinFailures: 0,
        pinResets: 0,
      };
      summary.pinFailures = row.pinFailures;
      summary.pinResets = row.pinResets;
      byCashier.set(row.actorId, summary);
    }

    return [...byCashier.values()].sort((a, b) => b.sales - a.sales);
  }

  async flaggedSales(from: Date, to: Date) {
    const rows = await db
      .select({
        saleId: sales.id,
        clientCreatedAt: sales.clientCreatedAt,
        cashierName: users.name,
        workerName: workers.fullName,
        workerDni: workers.dni,
        subtotal: sales.subtotal,
        discountTotal: sales.discountTotal,
        total: sales.total,
        auditFlags: sales.auditFlags,
      })
      .from(sales)
      .innerJoin(users, eq(sales.cashierId, users.id))
      .leftJoin(workers, eq(sales.workerId, workers.id))
      .where(
        and(gte(sales.clientCreatedAt, from), lte(sales.clientCreatedAt, to), isFlagged),
      )
      .orderBy(desc(sales.clientCreatedAt))
      .limit(200);

    return rows.map((row) => ({
      ...row,
      subtotal: Number(row.subtotal),
      discountTotal: Number(row.discountTotal),
      total: Number(row.total),
      auditFlags: row.auditFlags as AuditFlag[],
    }));
  }
}
