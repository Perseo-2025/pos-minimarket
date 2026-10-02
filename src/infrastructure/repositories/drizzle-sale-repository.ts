import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { AuditFlag } from "@/domain/entities/audit";
import type { Sale, SaleRecord } from "@/domain/entities/sale";
import type { SaleRepository } from "@/domain/repositories/sale-repository";
import { db } from "@/infrastructure/db/client";
import {
  loyaltyLedger,
  products,
  saleItems,
  sales,
  workers,
} from "@/infrastructure/db/schema";
import { moveStockForSale } from "./stock-ledger";

type SaleRow = typeof sales.$inferSelect & {
  cashier: { name: string } | null;
  courtesyApprover: { name: string } | null;
  worker: { fullName: string; dni: string } | null;
  items: (typeof saleItems.$inferSelect)[];
};

function toSale(row: SaleRow): Sale {
  return {
    id: row.id,
    uuid: row.uuid,
    cashierId: row.cashierId,
    cashierName: row.cashier?.name,
    status: row.status,
    paymentType: row.paymentType,
    subtotal: Number(row.subtotal),
    discountTotal: Number(row.discountTotal),
    discountPercent: Number(row.discountPercent),
    courtesyTotal: Number(row.courtesyTotal),
    courtesyApprovedByName: row.courtesyApprover?.name ?? null,
    total: Number(row.total),
    workerId: row.workerId,
    workerName: row.worker?.fullName ?? null,
    workerDni: row.worker?.dni ?? null,
    workerVerification: row.workerVerification,
    pointsEarned: row.pointsEarned,
    auditFlags: row.auditFlags as AuditFlag[],
    clientCreatedAt: row.clientCreatedAt,
    syncedAt: row.syncedAt,
    createdAt: row.createdAt,
    items: row.items.map((item) => ({
      id: item.id,
      saleId: item.saleId,
      productId: item.productId,
      productName: item.productName,
      unitPrice: Number(item.unitPrice),
      quantity: item.quantity,
      lineTotal: Number(item.lineTotal),
      discountPercent: Number(item.discountPercent),
      discountAmount: Number(item.discountAmount),
      isCourtesy: item.isCourtesy,
      captureSource: item.captureSource,
    })),
  };
}

const withRelations = {
  cashier: { columns: { name: true } },
  courtesyApprover: { columns: { name: true } },
  worker: { columns: { fullName: true, dni: true } },
  items: true,
} as const;

export class DrizzleSaleRepository implements SaleRepository {
  // Amounts arrive already re-priced and audited by createSaleUseCase.
  async insertWithItems(record: SaleRecord) {
    const inserted = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(sales)
        .values({
          uuid: record.uuid,
          shiftUuid: record.shiftUuid,
          cashierId: record.cashierId,
          paymentType: record.paymentType,
          subtotal: record.subtotal.toFixed(2),
          discountTotal: record.discountTotal.toFixed(2),
          discountPercent: record.discountPercent.toFixed(2),
          courtesyTotal: record.courtesyTotal.toFixed(2),
          courtesyApprovedBy: record.courtesyApprovedBy,
          total: record.total.toFixed(2),
          workerId: record.workerId,
          policyId: record.policyId,
          workerVerification: record.workerVerification,
          pointsEarned: record.pointsEarned,
          auditFlags: record.auditFlags,
          clientCreatedAt: new Date(record.clientCreatedAt),
          syncedAt: new Date(),
        })
        .onConflictDoNothing({ target: sales.uuid })
        .returning({ id: sales.id });

      // Already synced previously (retry) — skip items, points and stock too.
      if (!row) return null;
      const saleId = row.id;

      const catalogRows = await tx
        .select({
          id: products.id,
          name: products.name,
          trackStock: products.trackStock,
          priceCost: products.priceCost,
        })
        .from(products)
        .where(
          inArray(
            products.id,
            record.items.map((item) => item.productId),
          ),
        );
      const catalog = new Map(catalogRows.map((p) => [p.id, p]));

      await tx.insert(saleItems).values(
        record.items.map((item) => ({
          saleId,
          productId: item.productId,
          productName: item.productName,
          unitPrice: item.unitPrice.toFixed(2),
          quantity: item.quantity,
          lineTotal: item.lineTotal.toFixed(2),
          discountPercent: (item.discountPercent ?? 0).toFixed(2),
          discountAmount: (item.discountAmount ?? 0).toFixed(2),
          isCourtesy: item.isCourtesy ?? false,
          unitCost: catalog.get(item.productId)?.priceCost ?? null,
          captureSource: item.captureSource ?? null,
        })),
      );

      await moveStockForSale(tx, record, saleId, catalog);

      if (record.workerId && record.pointsEarned > 0) {
        await tx.insert(loyaltyLedger).values({
          workerId: record.workerId,
          saleId,
          points: record.pointsEarned,
          type: "earn",
        });
        await tx
          .update(workers)
          .set({
            pointsBalance: sql`${workers.pointsBalance} + ${record.pointsEarned}`,
          })
          .where(eq(workers.id, record.workerId));
      }

      return saleId;
    });

    if (inserted !== null) {
      return { id: inserted, uuid: record.uuid, total: record.total, inserted: true };
    }
    const [existing] = await db
      .select({ id: sales.id, total: sales.total })
      .from(sales)
      .where(eq(sales.uuid, record.uuid))
      .limit(1);
    return {
      id: existing.id,
      uuid: record.uuid,
      total: Number(existing.total),
      inserted: false,
    };
  }

  async existsByUuid(uuid: string) {
    const [row] = await db
      .select({ id: sales.id })
      .from(sales)
      .where(eq(sales.uuid, uuid))
      .limit(1);
    return row !== undefined;
  }

  async findByDateRange(from: Date, to: Date): Promise<Sale[]> {
    const rows = await db.query.sales.findMany({
      where: and(
        gte(sales.clientCreatedAt, from),
        lte(sales.clientCreatedAt, to),
      ),
      orderBy: desc(sales.clientCreatedAt),
      with: withRelations,
    });

    return rows.map(toSale);
  }

  async findById(id: number): Promise<Sale | null> {
    const row = await db.query.sales.findFirst({
      where: eq(sales.id, id),
      with: withRelations,
    });

    return row ? toSale(row) : null;
  }
}
