import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type {
  NewPurchaseOrder,
  PurchaseOrder,
  PurchaseOrderStatus,
} from "@/domain/entities/purchase-order";
import type { PurchaseOrderRepository } from "@/domain/repositories/purchase-order-repository";
import { db } from "@/infrastructure/db/client";
import {
  goodsReceiptItems,
  goodsReceipts,
  productPresentations,
  products,
  purchaseOrderItems,
  purchaseOrders,
  suppliers,
  users,
} from "@/infrastructure/db/schema";

async function hydrate(
  rows: {
    order: typeof purchaseOrders.$inferSelect;
    supplierName: string;
    createdByName: string | null;
  }[],
): Promise<PurchaseOrder[]> {
  if (rows.length === 0) return [];
  const orderIds = rows.map((row) => row.order.id);

  const [items, receipts, received] = await Promise.all([
    db
      .select({
        orderId: purchaseOrderItems.orderId,
        productId: purchaseOrderItems.productId,
        productName: products.name,
        presentationId: purchaseOrderItems.presentationId,
        presentationName: productPresentations.name,
        quantity: purchaseOrderItems.quantity,
        units: purchaseOrderItems.units,
        estimatedTotal: purchaseOrderItems.estimatedTotal,
      })
      .from(purchaseOrderItems)
      .innerJoin(products, eq(products.id, purchaseOrderItems.productId))
      .leftJoin(
        productPresentations,
        eq(productPresentations.id, purchaseOrderItems.presentationId),
      )
      .where(inArray(purchaseOrderItems.orderId, orderIds))
      .orderBy(purchaseOrderItems.id),
    db
      .select({
        orderId: goodsReceipts.orderId,
        id: goodsReceipts.id,
        receivedAt: goodsReceipts.receivedAt,
        docNumber: goodsReceipts.docNumber,
      })
      .from(goodsReceipts)
      .where(inArray(goodsReceipts.orderId, orderIds))
      .orderBy(goodsReceipts.receivedAt),
    // Units that arrived per order and product (bonuses included).
    db
      .select({
        orderId: goodsReceipts.orderId,
        productId: goodsReceiptItems.productId,
        units: sql<number>`sum(${goodsReceiptItems.units})`.mapWith(Number),
      })
      .from(goodsReceiptItems)
      .innerJoin(goodsReceipts, eq(goodsReceipts.id, goodsReceiptItems.receiptId))
      .where(and(isNotNull(goodsReceipts.orderId), inArray(goodsReceipts.orderId, orderIds)))
      .groupBy(goodsReceipts.orderId, goodsReceiptItems.productId),
  ]);

  return rows.map(({ order, supplierName, createdByName }) => ({
    id: order.id,
    supplierId: order.supplierId,
    supplierName,
    status: order.status,
    expectedAt: order.expectedAt,
    estimatedTotal: order.estimatedTotal === null ? null : Number(order.estimatedTotal),
    note: order.note,
    createdAt: order.createdAt,
    createdByName,
    lines: items
      .filter((item) => item.orderId === order.id)
      .map(({ orderId, estimatedTotal, ...item }) => ({
        ...item,
        estimatedTotal: estimatedTotal === null ? null : Number(estimatedTotal),
        receivedUnits:
          received.find((r) => r.orderId === orderId && r.productId === item.productId)
            ?.units ?? 0,
      })),
    receipts: receipts
      .filter((receipt) => receipt.orderId === order.id)
      .map(({ id, receivedAt, docNumber }) => ({ id, receivedAt, docNumber })),
  }));
}

function selectOrders() {
  return db
    .select({
      order: purchaseOrders,
      supplierName: sql<string>`coalesce(${suppliers.tradeName}, ${suppliers.businessName})`,
      createdByName: users.name,
    })
    .from(purchaseOrders)
    .innerJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
    .leftJoin(users, eq(users.id, purchaseOrders.createdBy));
}

export class DrizzlePurchaseOrderRepository implements PurchaseOrderRepository {
  async create(data: NewPurchaseOrder) {
    return db.transaction(async (tx) => {
      const [order] = await tx
        .insert(purchaseOrders)
        .values({
          supplierId: data.supplierId,
          expectedAt: data.expectedAt,
          note: data.note,
          estimatedTotal: data.estimatedTotal?.toFixed(2) ?? null,
          createdBy: data.actorId,
        })
        .returning({ id: purchaseOrders.id });
      await tx.insert(purchaseOrderItems).values(
        data.lines.map((line) => ({
          orderId: order.id,
          productId: line.productId,
          presentationId: line.presentationId,
          quantity: line.quantity,
          units: line.units,
          estimatedTotal: line.estimatedTotal?.toFixed(2) ?? null,
        })),
      );
      return { id: order.id };
    });
  }

  async findById(id: number) {
    const rows = await selectOrders().where(eq(purchaseOrders.id, id)).limit(1);
    return (await hydrate(rows))[0] ?? null;
  }

  async list(limit: number) {
    const rows = await selectOrders()
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(limit);
    return hydrate(rows);
  }

  async setStatus(id: number, status: PurchaseOrderStatus) {
    await db
      .update(purchaseOrders)
      .set({ status, updatedAt: new Date() })
      .where(eq(purchaseOrders.id, id));
  }
}
