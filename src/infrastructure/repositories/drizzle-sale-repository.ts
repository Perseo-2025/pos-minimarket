import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { AuditFlag } from "@/domain/entities/audit";
import type { Sale, SaleRecord } from "@/domain/entities/sale";
import type { SaleRepository } from "@/domain/repositories/sale-repository";
import { db } from "@/infrastructure/db/client";
import {
  loyaltyLedger,
  saleItems,
  sales,
  workers,
} from "@/infrastructure/db/schema";

type SaleRow = typeof sales.$inferSelect & {
  cashier: { name: string } | null;
  courtesyApprover: { name: string } | null;
  worker: { fullName: string; dni: string } | null;
  items: (typeof saleItems.$inferSelect)[];
};

function toSale(row: SaleRow): Sale {
  return {
    id: row.id,
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
          id: record.id,
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
        .onConflictDoNothing({ target: sales.id })
        .returning({ id: sales.id });

      // Already synced previously (retry) — skip items and points too.
      if (!row) return false;

      await tx.insert(saleItems).values(
        record.items.map((item) => ({
          id: item.id,
          saleId: record.id,
          productId: item.productId,
          productName: item.productName,
          unitPrice: item.unitPrice.toFixed(2),
          quantity: item.quantity,
          lineTotal: item.lineTotal.toFixed(2),
          discountPercent: (item.discountPercent ?? 0).toFixed(2),
          discountAmount: (item.discountAmount ?? 0).toFixed(2),
          isCourtesy: item.isCourtesy ?? false,
        })),
      );

      if (record.workerId && record.pointsEarned > 0) {
        await tx.insert(loyaltyLedger).values({
          workerId: record.workerId,
          saleId: record.id,
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

      return true;
    });

    return { id: record.id, total: record.total, inserted };
  }

  async exists(id: string) {
    const [row] = await db
      .select({ id: sales.id })
      .from(sales)
      .where(eq(sales.id, id))
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

  async findById(id: string): Promise<Sale | null> {
    const row = await db.query.sales.findFirst({
      where: eq(sales.id, id),
      with: withRelations,
    });

    return row ? toSale(row) : null;
  }
}
