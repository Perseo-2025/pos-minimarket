import { and, desc, eq, gt, gte, inArray, lt, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type {
  CountCandidateRow,
  CountItem,
  NewDailyCount,
} from "@/domain/entities/daily-count";
import { ValidationError } from "@/domain/errors";
import type { DailyCountRepository } from "@/domain/repositories/daily-count-repository";
import { countOutcome } from "@/domain/services/daily-count";
import { daysBetween } from "@/domain/services/expiry";
import { storeDateKey } from "@/domain/value-objects/store-time";
import { db } from "@/infrastructure/db/client";
import {
  auditEvents,
  categories,
  locations,
  products,
  stockCountItems,
  stockCounts,
  stockLevels,
  stockLots,
  stockMovements,
  users,
} from "@/infrastructure/db/schema";
import { consumeLots, recordMovement, type Tx } from "./stock-ledger";

const DAY_MS = 24 * 60 * 60 * 1000;

// The count is the truth about dates: lots at the location become exactly
// what was counted.
async function replaceLots(
  tx: Tx,
  productId: number,
  locationId: number,
  lots: { expiresAt: string; quantity: number }[],
) {
  await tx
    .delete(stockLots)
    .where(and(eq(stockLots.productId, productId), eq(stockLots.locationId, locationId)));
  if (lots.length > 0) {
    await tx
      .insert(stockLots)
      .values(lots.map((lot) => ({ productId, locationId, ...lot })));
  }
}

async function lockedBalance(tx: Tx, productId: number, locationId: number) {
  await tx
    .insert(stockLevels)
    .values({ productId, locationId })
    .onConflictDoNothing();
  const [level] = await tx
    .select({ quantity: stockLevels.quantity })
    .from(stockLevels)
    .where(and(eq(stockLevels.productId, productId), eq(stockLevels.locationId, locationId)))
    .for("update");
  return level.quantity;
}

const counter = alias(users, "counter");
const reviewer = alias(users, "reviewer");

function selectItems() {
  return db
    .select({
      item: stockCountItems,
      productName: products.name,
      locationName: locations.name,
      countedAt: stockCounts.countedAt,
      countedByName: counter.name,
      reviewedByName: reviewer.name,
    })
    .from(stockCountItems)
    .innerJoin(stockCounts, eq(stockCounts.id, stockCountItems.countId))
    .innerJoin(products, eq(products.id, stockCountItems.productId))
    .innerJoin(locations, eq(locations.id, stockCounts.locationId))
    .leftJoin(counter, eq(counter.id, stockCounts.countedBy))
    .leftJoin(reviewer, eq(reviewer.id, stockCountItems.reviewedBy));
}

function toItem(row: Awaited<ReturnType<typeof selectItems>>[number]): CountItem {
  return {
    id: row.item.id,
    countId: row.item.countId,
    productId: row.item.productId,
    productName: row.productName,
    locationName: row.locationName,
    countedByName: row.countedByName,
    countedAt: row.countedAt,
    expected: row.item.expected,
    counted: row.item.counted,
    lots: row.item.lots,
    status: row.item.status,
    reviewedByName: row.reviewedByName,
    reviewedAt: row.item.reviewedAt,
    reviewNote: row.item.reviewNote,
  };
}

export class DrizzleDailyCountRepository implements DailyCountRepository {
  async listCandidates(locationId: number, todayKey: string): Promise<CountCandidateRow[]> {
    const now = Date.now();
    const weekAgo = new Date(now - 7 * DAY_MS);
    const threeDaysAgo = new Date(now - 3 * DAY_MS);

    const [rows, lastCounts, lastAdminCounts, outflows, inflows, lots, pending] =
      await Promise.all([
        db
          .select({
            productId: products.id,
            productName: products.name,
            categoryName: categories.name,
            tracksExpiry: sql<boolean>`coalesce(${products.tracksExpiry}, ${categories.tracksExpiry})`,
            warningDays: categories.expiryWarningDays,
            balance: sql<number>`coalesce(${stockLevels.quantity}, 0)`.mapWith(Number),
          })
          .from(products)
          .innerJoin(categories, eq(categories.id, products.categoryId))
          .leftJoin(
            stockLevels,
            and(
              eq(stockLevels.productId, products.id),
              eq(stockLevels.locationId, locationId),
            ),
          )
          .where(and(eq(products.isActive, true), eq(products.trackStock, true))),
        // Last "conteo del día" here, and the admin's direct counts.
        db
          .select({
            productId: stockCountItems.productId,
            at: sql<Date>`max(${stockCounts.countedAt})`.mapWith((v) => new Date(v)),
          })
          .from(stockCountItems)
          .innerJoin(stockCounts, eq(stockCounts.id, stockCountItems.countId))
          .where(eq(stockCounts.locationId, locationId))
          .groupBy(stockCountItems.productId),
        db
          .select({
            productId: stockMovements.productId,
            at: sql<Date>`max(${stockMovements.createdAt})`.mapWith((v) => new Date(v)),
          })
          .from(stockMovements)
          .where(
            and(
              eq(stockMovements.locationId, locationId),
              inArray(stockMovements.type, ["opening", "count_adjustment"]),
            ),
          )
          .groupBy(stockMovements.productId),
        db
          .select({
            productId: stockMovements.productId,
            units: sql<number>`sum(-${stockMovements.qtyDelta})`.mapWith(Number),
          })
          .from(stockMovements)
          .where(
            and(
              eq(stockMovements.locationId, locationId),
              lt(stockMovements.qtyDelta, 0),
              gte(stockMovements.occurredAt, weekAgo),
            ),
          )
          .groupBy(stockMovements.productId),
        db
          .selectDistinct({ productId: stockMovements.productId })
          .from(stockMovements)
          .where(
            and(
              eq(stockMovements.locationId, locationId),
              gt(stockMovements.qtyDelta, 0),
              inArray(stockMovements.type, ["purchase_receipt", "transfer_in"]),
              gte(stockMovements.createdAt, threeDaysAgo),
            ),
          ),
        db
          .select({
            productId: stockLots.productId,
            expiresAt: stockLots.expiresAt,
          })
          .from(stockLots)
          .where(and(eq(stockLots.locationId, locationId), gt(stockLots.quantity, 0))),
        db
          .selectDistinct({ productId: stockCountItems.productId })
          .from(stockCountItems)
          .innerJoin(stockCounts, eq(stockCounts.id, stockCountItems.countId))
          .where(
            and(
              eq(stockCounts.locationId, locationId),
              eq(stockCountItems.status, "pending"),
            ),
          ),
      ]);

    const awaitingReview = new Set(pending.map((p) => p.productId));
    return rows
      .filter((row) => !awaitingReview.has(row.productId))
      .map((row) => {
        const times = [
          ...lastCounts.filter((c) => c.productId === row.productId),
          ...lastAdminCounts.filter((c) => c.productId === row.productId),
        ].map((c) => c.at.getTime());
        const lotDates = lots
          .filter((lot) => lot.productId === row.productId)
          .map((lot) => lot.expiresAt)
          .sort();
        return {
          candidate: {
            productId: row.productId,
            balance: row.balance,
            lastCountedOn: times.length ? storeDateKey(new Date(Math.max(...times))) : null,
            unitsOutLastWeek:
              outflows.find((o) => o.productId === row.productId)?.units ?? 0,
            hasExpiring:
              row.tracksExpiry &&
              lotDates.some((date) => daysBetween(todayKey, date) <= row.warningDays),
            recentlyReceived: inflows.some((i) => i.productId === row.productId),
          },
          productName: row.productName,
          categoryName: row.categoryName,
          tracksExpiry: row.tracksExpiry,
          lotDates: [...new Set(lotDates)],
        };
      });
  }

  async submit(data: NewDailyCount) {
    return db.transaction(async (tx) => {
      const [count] = await tx
        .insert(stockCounts)
        .values({ locationId: data.locationId, countedBy: data.actorId })
        .returning({ id: stockCounts.id });

      let matched = 0;
      let pending = 0;
      for (const item of data.items) {
        const expected = await lockedBalance(tx, item.productId, data.locationId);
        const status = countOutcome(expected, item.counted);
        if (status === "matched") {
          matched++;
          // Same quantity: the dates are refreshed right away.
          if (item.lots !== null) {
            await replaceLots(tx, item.productId, data.locationId, item.lots);
          }
        } else {
          pending++;
        }
        await tx.insert(stockCountItems).values({
          countId: count.id,
          productId: item.productId,
          expected,
          counted: item.counted,
          lots: item.lots ?? [],
          status,
          captureSource: item.captureSource,
        });
      }
      return { countId: count.id, matched, pending };
    });
  }

  async listItems(limit: number) {
    const rows = await selectItems()
      .orderBy(
        sql`${stockCountItems.status} = 'pending' desc`,
        desc(stockCounts.countedAt),
      )
      .limit(limit);
    return rows.map(toItem);
  }

  async findItem(id: number) {
    const [row] = await selectItems().where(eq(stockCountItems.id, id)).limit(1);
    return row ? toItem(row) : null;
  }

  async review(data: { id: number; approve: boolean; note: string | null; actorId: number }) {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ item: stockCountItems, count: stockCounts, productName: products.name })
        .from(stockCountItems)
        .innerJoin(stockCounts, eq(stockCounts.id, stockCountItems.countId))
        .innerJoin(products, eq(products.id, stockCountItems.productId))
        .where(eq(stockCountItems.id, data.id))
        .for("update", { of: stockCountItems });
      if (!row || row.item.status !== "pending") {
        throw new ValidationError("Este conteo ya fue revisado");
      }
      const { item, count } = row;
      const now = new Date();

      if (data.approve) {
        const current = await lockedBalance(tx, item.productId, count.locationId);
        // The difference of the count's moment: sales made since stay valid.
        const delta = item.counted - item.expected;
        await recordMovement(tx, {
          productId: item.productId,
          locationId: count.locationId,
          qtyDelta: delta,
          type: "count_adjustment",
          refId: count.uuid,
          note: data.note ?? `Conteo del día #${count.id} aprobado`,
          actorId: data.actorId,
          occurredAt: now,
        });
        if (current === item.expected && item.lots.length > 0) {
          // Nothing moved since the count: its dates are exact.
          await replaceLots(tx, item.productId, count.locationId, item.lots);
        } else if (delta < 0) {
          await consumeLots(tx, item.productId, count.locationId, -delta);
        }
        await tx.insert(auditEvents).values({
          type: "stock_adjusted",
          actorId: data.actorId,
          payload: {
            productId: item.productId,
            productName: row.productName,
            locationId: count.locationId,
            countId: count.id,
            countedBy: count.countedBy,
            expected: item.expected,
            counted: item.counted,
            delta,
            note: data.note,
          },
          occurredAt: now,
        });
      }

      await tx
        .update(stockCountItems)
        .set({
          status: data.approve ? "approved" : "rejected",
          reviewedBy: data.actorId,
          reviewedAt: now,
          reviewNote: data.note,
        })
        .where(eq(stockCountItems.id, data.id));
    });
  }
}
