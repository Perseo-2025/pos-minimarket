import { and, asc, eq, gt, sql } from "drizzle-orm";
import type { StockMovementType } from "@/domain/entities/inventory";
import type { SaleRecord } from "@/domain/entities/sale";
import { consumeFefo } from "@/domain/services/expiry";
import { aggregateQuantities } from "@/domain/services/stock-count";
import { storeDateKey } from "@/domain/value-objects/store-time";
import type { db } from "@/infrastructure/db/client";
import {
  auditEvents,
  locations,
  stockLevels,
  stockLots,
  stockMovements,
} from "@/infrastructure/db/schema";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface MovementInput {
  productId: number;
  locationId: number;
  qtyDelta: number;
  type: StockMovementType;
  refId: string;
  unitCost?: string | null;
  note?: string | null;
  actorId: number | null;
  occurredAt: Date;
}

// Appends a Kardex row and moves the balance in the caller's transaction.
// Returns the new balance, or null when this exact movement was already
// recorded (a retried sync), in which case the balance is left untouched.
export async function recordMovement(tx: Tx, input: MovementInput) {
  const [movement] = await tx
    .insert(stockMovements)
    .values({
      productId: input.productId,
      locationId: input.locationId,
      qtyDelta: input.qtyDelta,
      balanceAfter: 0,
      type: input.type,
      refId: input.refId,
      unitCost: input.unitCost ?? null,
      note: input.note ?? null,
      actorId: input.actorId,
      occurredAt: input.occurredAt,
    })
    .onConflictDoNothing()
    .returning({ id: stockMovements.id });

  if (!movement) return null;

  // The upsert row-locks the balance, so concurrent sales of the same
  // product queue up here and each one sees the previous balance.
  const [level] = await tx
    .insert(stockLevels)
    .values({
      productId: input.productId,
      locationId: input.locationId,
      quantity: input.qtyDelta,
    })
    .onConflictDoUpdate({
      target: [stockLevels.productId, stockLevels.locationId],
      set: {
        quantity: sql`${stockLevels.quantity} + ${input.qtyDelta}`,
        updatedAt: new Date(),
      },
    })
    .returning({ quantity: stockLevels.quantity });

  await tx
    .update(stockMovements)
    .set({ balanceAfter: level.quantity })
    .where(eq(stockMovements.id, movement.id));

  return level.quantity;
}

// Units leaving a location come out of its dated lots, soonest expiry first
// (FEFO). Returns the lots that were touched.
export async function consumeLots(
  tx: Tx,
  productId: number,
  locationId: number,
  quantity: number,
) {
  const lots = await tx
    .select({
      id: stockLots.id,
      expiresAt: stockLots.expiresAt,
      quantity: stockLots.quantity,
    })
    .from(stockLots)
    .where(
      and(
        eq(stockLots.productId, productId),
        eq(stockLots.locationId, locationId),
        gt(stockLots.quantity, 0),
      ),
    )
    .for("update");
  if (lots.length === 0) return [];

  const { taken } = consumeFefo(lots, quantity);
  for (const lot of taken) {
    await tx
      .update(stockLots)
      .set({
        quantity: sql`${stockLots.quantity} - ${lot.quantity}`,
        updatedAt: new Date(),
      })
      .where(eq(stockLots.id, lot.id));
  }
  // Emptied lots carry no information any more.
  await tx
    .delete(stockLots)
    .where(
      and(
        eq(stockLots.productId, productId),
        eq(stockLots.locationId, locationId),
        sql`${stockLots.quantity} <= 0`,
      ),
    );
  return taken;
}

// Units entering a location with an expiry date join that date's lot.
export async function addToLot(
  tx: Tx,
  productId: number,
  locationId: number,
  expiresAt: string,
  quantity: number,
) {
  await tx
    .insert(stockLots)
    .values({ productId, locationId, expiresAt, quantity })
    .onConflictDoUpdate({
      target: [stockLots.productId, stockLots.locationId, stockLots.expiresAt],
      set: {
        quantity: sql`${stockLots.quantity} + ${quantity}`,
        updatedAt: new Date(),
      },
    });
}

// The first active Almacén / Tienda.
export async function findLocationId(tx: Tx, kind: "warehouse" | "store") {
  const [row] = await tx
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.kind, kind), eq(locations.isActive, true)))
    .orderBy(asc(locations.createdAt))
    .limit(1);
  return row?.id ?? null;
}

export interface SaleStockProduct {
  name: string;
  trackStock: boolean;
  priceCost: string | null;
}

// Sold units leave the shop floor. A sale is never blocked for lack of
// stock (it may have been made offline): the balance goes negative and the
// admin is alerted, since it means a transfer or a count was not recorded.
export async function moveStockForSale(
  tx: Tx,
  record: SaleRecord,
  saleId: number,
  catalog: Map<number, SaleStockProduct>,
) {
  const tracked = [...aggregateQuantities(record.items)].filter(
    ([productId]) => catalog.get(productId)?.trackStock,
  );
  if (tracked.length === 0) return;

  const storeId = await findLocationId(tx, "store");
  if (!storeId) return;

  const occurredAt = new Date(record.clientCreatedAt);

  for (const [productId, quantity] of tracked) {
    const product = catalog.get(productId)!;
    const balance = await recordMovement(tx, {
      productId,
      locationId: storeId,
      qtyDelta: -quantity,
      type: "sale",
      refId: record.uuid,
      unitCost: product.priceCost,
      actorId: record.cashierId,
      occurredAt,
    });

    // A retried sync (balance null) already consumed its lots.
    if (balance !== null) {
      const taken = await consumeLots(tx, productId, storeId, quantity);
      const saleDay = storeDateKey(occurredAt);
      const expired = taken.filter((lot) => lot.expiresAt < saleDay);
      if (expired.length > 0) {
        await tx.insert(auditEvents).values({
          type: "sold_expired",
          actorId: record.cashierId,
          saleUuid: record.uuid,
          payload: {
            saleId,
            productId,
            productName: product.name,
            lots: expired,
          },
          occurredAt,
        });
      }
    }

    if (balance !== null && balance < 0) {
      await tx.insert(auditEvents).values({
        type: "sold_without_stock",
        actorId: record.cashierId,
        saleUuid: record.uuid,
        payload: {
          saleId,
          productId,
          productName: product.name,
          locationId: storeId,
          quantity,
          balance,
        },
        occurredAt,
      });
    }
  }
}
