import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type {
  CashMovementType,
  CashShift,
  ShiftAmounts,
} from "@/domain/entities/cash-shift";
import { ValidationError } from "@/domain/errors";
import type { CashShiftRepository } from "@/domain/repositories/cash-shift-repository";
import { expectedAmounts } from "@/domain/services/cash-shift";
import { db } from "@/infrastructure/db/client";
import { cashMovements, cashShifts, sales, users } from "@/infrastructure/db/schema";

// A shift open for longer than this deserves the admin's attention.
const LONG_OPEN_MS = 12 * 60 * 60 * 1000;

const cashier = alias(users, "cashier");
const reviewer = alias(users, "reviewer");
const mover = alias(users, "mover");

const num = (value: string | null) => (value === null ? null : Number(value));

function selectShifts() {
  return db
    .select({
      shift: cashShifts,
      cashierName: cashier.name,
      reviewedByName: reviewer.name,
    })
    .from(cashShifts)
    .innerJoin(cashier, eq(cashier.id, cashShifts.cashierId))
    .leftJoin(reviewer, eq(reviewer.id, cashShifts.reviewedBy));
}

type ShiftRow = Awaited<ReturnType<typeof selectShifts>>[number];

// Sales and cash movements of the given shifts, in two grouped queries.
async function hydrate(rows: ShiftRow[]): Promise<CashShift[]> {
  if (rows.length === 0) return [];
  const uuids = rows.map((row) => row.shift.uuid);
  const completed = eq(sales.status, "completed");

  const [saleTotals, movements] = await Promise.all([
    db
      .select({
        shiftUuid: sales.shiftUuid,
        count: sql<number>`count(*)`.mapWith(Number),
        cash: sql<string>`coalesce(sum(${sales.total}) filter (where ${sales.paymentType} = 'cash' and ${completed}), 0)`,
        yape: sql<string>`coalesce(sum(${sales.total}) filter (where ${sales.paymentType} = 'yape_plin' and ${completed}), 0)`,
        card: sql<string>`coalesce(sum(${sales.total}) filter (where ${sales.paymentType} = 'card' and ${completed}), 0)`,
      })
      .from(sales)
      .where(inArray(sales.shiftUuid, uuids))
      .groupBy(sales.shiftUuid),
    db
      .select({ movement: cashMovements, createdByName: mover.name })
      .from(cashMovements)
      .leftJoin(mover, eq(mover.id, cashMovements.createdBy))
      .where(inArray(cashMovements.shiftUuid, uuids))
      .orderBy(cashMovements.occurredAt),
  ]);

  return rows.map(({ shift, cashierName, reviewedByName }) => {
    const sold = saleTotals.find((s) => s.shiftUuid === shift.uuid);
    const own = movements.filter((m) => m.movement.shiftUuid === shift.uuid);
    const sum = (type: CashMovementType) =>
      own
        .filter((m) => m.movement.type === type)
        .reduce((total, m) => total + Number(m.movement.amount), 0);
    const totals = {
      openingCash: Number(shift.openingCash),
      cashSales: Number(sold?.cash ?? 0),
      yapeSales: Number(sold?.yape ?? 0),
      cardSales: Number(sold?.card ?? 0),
      cashIn: sum("in"),
      cashOut: sum("out"),
    };
    const frozen =
      shift.expectedCash !== null
        ? {
            cash: Number(shift.expectedCash),
            yape: Number(shift.expectedYape),
            card: Number(shift.expectedCard),
          }
        : null;
    return {
      id: shift.id,
      uuid: shift.uuid,
      cashierId: shift.cashierId,
      cashierName,
      status: shift.status,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      counted:
        shift.countedCash === null
          ? null
          : {
              cash: Number(shift.countedCash),
              yape: num(shift.countedYape) ?? 0,
              card: num(shift.countedCard) ?? 0,
            },
      closeNote: shift.closeNote,
      reportedSales: shift.reportedSales,
      syncedSales: sold?.count ?? 0,
      totals,
      expected: frozen ?? expectedAmounts(totals),
      movements: own.map(({ movement, createdByName }) => ({
        id: movement.id,
        type: movement.type,
        amount: Number(movement.amount),
        reason: movement.reason,
        occurredAt: movement.occurredAt,
        createdByName,
      })),
      reviewedByName,
      reviewedAt: shift.reviewedAt,
      reviewNote: shift.reviewNote,
    };
  });
}

export class DrizzleCashShiftRepository implements CashShiftRepository {
  async open(data: {
    uuid: string;
    cashierId: number;
    openedAt: Date;
    openingCash: number;
  }) {
    await db
      .insert(cashShifts)
      .values({ ...data, openingCash: data.openingCash.toFixed(2) })
      .onConflictDoNothing({ target: cashShifts.uuid });
  }

  async addMovement(data: {
    uuid: string;
    shiftUuid: string;
    type: CashMovementType;
    amount: number;
    reason: string;
    occurredAt: Date;
    actorId: number;
  }) {
    await db
      .insert(cashMovements)
      .values({
        uuid: data.uuid,
        shiftUuid: data.shiftUuid,
        type: data.type,
        amount: data.amount.toFixed(2),
        reason: data.reason,
        occurredAt: data.occurredAt,
        createdBy: data.actorId,
      })
      .onConflictDoNothing({ target: cashMovements.uuid });
  }

  async close(data: {
    uuid: string;
    closedAt: Date;
    counted: ShiftAmounts;
    note: string | null;
    reportedSales: number;
  }) {
    await db
      .update(cashShifts)
      .set({
        status: "closed",
        closedAt: data.closedAt,
        countedCash: data.counted.cash.toFixed(2),
        countedYape: data.counted.yape.toFixed(2),
        countedCard: data.counted.card.toFixed(2),
        closeNote: data.note,
        reportedSales: data.reportedSales,
      })
      // Only once: a retried close changes nothing.
      .where(and(eq(cashShifts.uuid, data.uuid), eq(cashShifts.status, "open")));
  }

  async findOwner(uuid: string) {
    const [row] = await db
      .select({ cashierId: cashShifts.cashierId, status: cashShifts.status })
      .from(cashShifts)
      .where(eq(cashShifts.uuid, uuid))
      .limit(1);
    return row ?? null;
  }

  async hasOpenShift(cashierId: number) {
    const [row] = await db
      .select({ id: cashShifts.id })
      .from(cashShifts)
      .where(and(eq(cashShifts.cashierId, cashierId), eq(cashShifts.status, "open")))
      .limit(1);
    return Boolean(row);
  }

  async list(from: Date, to: Date) {
    const rows = await selectShifts()
      .where(and(gte(cashShifts.openedAt, from), lte(cashShifts.openedAt, to)))
      .orderBy(desc(cashShifts.openedAt));
    return hydrate(rows);
  }

  async findById(id: number) {
    const rows = await selectShifts().where(eq(cashShifts.id, id)).limit(1);
    return (await hydrate(rows))[0] ?? null;
  }

  async countByStatus() {
    const [row] = await db
      .select({
        closed: sql<number>`count(*) filter (where ${cashShifts.status} = 'closed')`.mapWith(Number),
        openLong: sql<number>`count(*) filter (where ${cashShifts.status} = 'open' and ${cashShifts.openedAt} < ${new Date(Date.now() - LONG_OPEN_MS).toISOString()}::timestamptz)`.mapWith(Number),
      })
      .from(cashShifts);
    return { closed: row?.closed ?? 0, openLong: row?.openLong ?? 0 };
  }

  async review(data: {
    id: number;
    expected: ShiftAmounts;
    note: string | null;
    actorId: number;
  }) {
    const updated = await db
      .update(cashShifts)
      .set({
        status: "reviewed",
        expectedCash: data.expected.cash.toFixed(2),
        expectedYape: data.expected.yape.toFixed(2),
        expectedCard: data.expected.card.toFixed(2),
        reviewedBy: data.actorId,
        reviewedAt: new Date(),
        reviewNote: data.note,
      })
      .where(and(eq(cashShifts.id, data.id), eq(cashShifts.status, "closed")))
      .returning({ id: cashShifts.id });
    if (updated.length === 0) throw new ValidationError("Esta caja ya fue revisada");
  }
}

