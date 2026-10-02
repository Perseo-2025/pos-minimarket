import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import type {
  ExpiringLot,
  LocationKind,
  ProductStock,
  StockLot,
  StockMovement,
} from "@/domain/entities/inventory";
import type {
  InventoryRepository,
  StockCountData,
} from "@/domain/repositories/inventory-repository";
import { planStockCount } from "@/domain/services/stock-count";
import { db } from "@/infrastructure/db/client";
import {
  auditEvents,
  categories,
  goodsReceipts,
  locations,
  products,
  sales,
  stockLevels,
  stockLots,
  stockMovements,
  stockTransfers,
  users,
} from "@/infrastructure/db/schema";
import { recordMovement } from "./stock-ledger";

// The product's own setting, or else its category's (see tracksExpiry()).
const effectiveTracksExpiry = sql<boolean>`coalesce(${products.tracksExpiry}, ${categories.tracksExpiry})`;

function selectStock() {
  return db
    .select({
      productId: products.id,
      productName: products.name,
      categoryName: categories.name,
      isActive: products.isActive,
      trackStock: products.trackStock,
      tracksExpiry: effectiveTracksExpiry,
      expiryWarningDays: categories.expiryWarningDays,
      locationId: stockLevels.locationId,
      quantity: stockLevels.quantity,
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(stockLevels, eq(stockLevels.productId, products.id));
}

type StockRow = Awaited<ReturnType<typeof selectStock>>[number];

async function lotsOf(productIds: number[]): Promise<Map<number, StockLot[]>> {
  const byProduct = new Map<number, StockLot[]>();
  if (productIds.length === 0) return byProduct;
  const rows = await db
    .select({
      productId: stockLots.productId,
      locationId: stockLots.locationId,
      expiresAt: stockLots.expiresAt,
      quantity: stockLots.quantity,
    })
    .from(stockLots)
    .where(and(inArray(stockLots.productId, productIds), gt(stockLots.quantity, 0)))
    .orderBy(asc(stockLots.expiresAt));
  for (const { productId, ...lot } of rows) {
    byProduct.set(productId, [...(byProduct.get(productId) ?? []), lot]);
  }
  return byProduct;
}

// One row per product and location in, one ProductStock per product out,
// keeping the query's order.
async function groupStock(rows: StockRow[]): Promise<ProductStock[]> {
  const byProduct = new Map<number, ProductStock>();
  for (const row of rows) {
    let stock = byProduct.get(row.productId);
    if (!stock) {
      stock = {
        productId: row.productId,
        productName: row.productName,
        categoryName: row.categoryName,
        isActive: row.isActive,
        trackStock: row.trackStock,
        byLocation: {},
        total: 0,
        tracksExpiry: row.tracksExpiry,
        expiryWarningDays: row.expiryWarningDays,
        lots: [],
      };
      byProduct.set(row.productId, stock);
    }
    if (row.locationId !== null && row.quantity !== null) {
      stock.byLocation[row.locationId] = row.quantity;
      stock.total += row.quantity;
    }
  }
  const stock = [...byProduct.values()];
  const lots = await lotsOf(
    stock.filter((s) => s.tracksExpiry).map((s) => s.productId),
  );
  for (const s of stock) s.lots = lots.get(s.productId) ?? [];
  return stock;
}

export class DrizzleInventoryRepository implements InventoryRepository {
  async listLocations() {
    const rows = await db
      .select({ id: locations.id, name: locations.name, kind: locations.kind })
      .from(locations)
      .where(eq(locations.isActive, true))
      // Warehouse first: stock flows warehouse → store.
      .orderBy(asc(locations.kind), asc(locations.createdAt));

    return rows.map((row) => ({ ...row, kind: row.kind as LocationKind }));
  }

  async listStock() {
    const rows = await selectStock().orderBy(
      asc(categories.sortOrder),
      asc(categories.name),
      asc(products.name),
    );
    return groupStock(rows);
  }

  async findProductStock(productId: number) {
    const rows = await selectStock().where(eq(products.id, productId));
    return (await groupStock(rows))[0] ?? null;
  }

  async findMovements(productId: number, limit: number): Promise<StockMovement[]> {
    const rows = await db
      .select({
        movement: stockMovements,
        locationName: locations.name,
        actorName: users.name,
        saleId: sales.id,
        receiptId: goodsReceipts.id,
        transferId: stockTransfers.id,
      })
      .from(stockMovements)
      .innerJoin(locations, eq(stockMovements.locationId, locations.id))
      .leftJoin(users, eq(stockMovements.actorId, users.id))
      .leftJoin(
        sales,
        and(
          inArray(stockMovements.type, ["sale", "sale_void"]),
          eq(sales.uuid, stockMovements.refId),
        ),
      )
      .leftJoin(
        goodsReceipts,
        and(
          eq(stockMovements.type, "purchase_receipt"),
          eq(goodsReceipts.uuid, stockMovements.refId),
        ),
      )
      .leftJoin(
        stockTransfers,
        and(
          inArray(stockMovements.type, ["transfer_in", "transfer_out"]),
          eq(stockTransfers.uuid, stockMovements.refId),
        ),
      )
      .where(eq(stockMovements.productId, productId))
      .orderBy(desc(stockMovements.createdAt))
      .limit(limit);

    return rows.map(
      ({ movement, locationName, actorName, saleId, receiptId, transferId }) => ({
      id: movement.id,
      productId: movement.productId,
      locationId: movement.locationId,
      locationName,
      qtyDelta: movement.qtyDelta,
      balanceAfter: movement.balanceAfter,
      type: movement.type,
      refId: movement.refId,
      saleId,
      receiptId,
      transferId,
      unitCost: movement.unitCost === null ? null : Number(movement.unitCost),
      note: movement.note,
      actorName,
      occurredAt: movement.occurredAt,
      createdAt: movement.createdAt,
      }),
    );
  }

  async applyCount(data: StockCountData) {
    return db.transaction(async (tx) => {
      // Make sure the balance row exists, then lock it: a sale syncing
      // meanwhile waits, so the difference is computed against the real
      // current balance.
      await tx
        .insert(stockLevels)
        .values({ productId: data.productId, locationId: data.locationId })
        .onConflictDoNothing();
      const [level] = await tx
        .select({ quantity: stockLevels.quantity })
        .from(stockLevels)
        .where(
          and(
            eq(stockLevels.productId, data.productId),
            eq(stockLevels.locationId, data.locationId),
          ),
        )
        .for("update");

      const [previous] = await tx
        .select({ id: stockMovements.id })
        .from(stockMovements)
        .where(
          and(
            eq(stockMovements.productId, data.productId),
            eq(stockMovements.locationId, data.locationId),
          ),
        )
        .limit(1);

      const plan = planStockCount({
        current: level.quantity,
        counted: data.counted,
        hasMovements: previous !== undefined,
        note: data.note,
      });
      const now = new Date();

      // The count is the truth about dates too, even when the quantity
      // matched: the lots at this location become exactly what was counted.
      if (data.lots !== null) {
        await tx
          .delete(stockLots)
          .where(
            and(
              eq(stockLots.productId, data.productId),
              eq(stockLots.locationId, data.locationId),
            ),
          );
        if (data.lots.length > 0) {
          await tx.insert(stockLots).values(
            data.lots.map((lot) => ({
              productId: data.productId,
              locationId: data.locationId,
              expiresAt: lot.expiresAt,
              quantity: lot.quantity,
            })),
          );
        }
      }

      if (!plan) return null;

      await recordMovement(tx, {
        productId: data.productId,
        locationId: data.locationId,
        qtyDelta: plan.delta,
        type: plan.type,
        refId: randomUUID(),
        note: data.note?.trim() || null,
        actorId: data.actorId,
        occurredAt: now,
      });

      await tx
        .update(products)
        .set({ trackStock: true, updatedAt: now })
        .where(eq(products.id, data.productId));

      if (plan.type === "count_adjustment") {
        await tx.insert(auditEvents).values({
          type: "stock_adjusted",
          actorId: data.actorId,
          payload: {
            productId: data.productId,
            locationId: data.locationId,
            expected: level.quantity,
            counted: data.counted,
            delta: plan.delta,
            note: data.note?.trim(),
          },
          occurredAt: now,
        });
      }

      return { delta: plan.delta };
    });
  }

  async listExpiringLots(todayKey: string): Promise<ExpiringLot[]> {
    const rows = await db
      .select({
        lotId: stockLots.id,
        productId: stockLots.productId,
        productName: products.name,
        categoryName: categories.name,
        locationId: stockLots.locationId,
        locationName: locations.name,
        locationKind: locations.kind,
        expiresAt: stockLots.expiresAt,
        quantity: stockLots.quantity,
        warningDays: categories.expiryWarningDays,
        priceCost: products.priceCost,
      })
      .from(stockLots)
      .innerJoin(products, eq(products.id, stockLots.productId))
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .innerJoin(locations, eq(locations.id, stockLots.locationId))
      .where(
        and(
          gt(stockLots.quantity, 0),
          eq(products.isActive, true),
          effectiveTracksExpiry,
          // Inside the category's window: expires_at - today <= warning days.
          lte(
            stockLots.expiresAt,
            sql`(${todayKey}::date + ${categories.expiryWarningDays})`,
          ),
        ),
      )
      .orderBy(asc(stockLots.expiresAt), asc(products.name));

    return rows.map((row) => ({
      ...row,
      locationKind: row.locationKind as LocationKind,
      priceCost: row.priceCost === null ? null : Number(row.priceCost),
    }));
  }
}
