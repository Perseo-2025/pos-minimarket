import { and, desc, eq, gte, lte } from "drizzle-orm";
import type { Sale, SaleInput } from "@/domain/entities/sale";
import type { SaleRepository } from "@/domain/repositories/sale-repository";
import { round2 } from "@/domain/value-objects/money";
import { db } from "@/infrastructure/db/client";
import { saleItems, sales } from "@/infrastructure/db/schema";

type SaleRow = typeof sales.$inferSelect & {
  cashier: { name: string } | null;
  items: (typeof saleItems.$inferSelect)[];
};

function toSale(row: SaleRow): Sale {
  return {
    id: row.id,
    cashierId: row.cashierId,
    cashierName: row.cashier?.name,
    status: row.status,
    paymentType: row.paymentType,
    total: Number(row.total),
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
    })),
  };
}

export class DrizzleSaleRepository implements SaleRepository {
  async insertWithItems(input: SaleInput, cashierId: string) {
    // Never trust the client-computed total: recompute from the line items.
    const total = round2(
      input.items.reduce((sum, item) => sum + item.lineTotal, 0),
    );

    await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(sales)
        .values({
          id: input.id,
          cashierId,
          paymentType: input.paymentType,
          total: total.toFixed(2),
          clientCreatedAt: new Date(input.clientCreatedAt),
          syncedAt: new Date(),
        })
        .onConflictDoNothing({ target: sales.id })
        .returning({ id: sales.id });

      // Already synced previously (retry) — skip re-inserting items too.
      if (!inserted) return;

      await tx.insert(saleItems).values(
        input.items.map((item) => ({
          id: item.id,
          saleId: input.id,
          productId: item.productId,
          productName: item.productName,
          unitPrice: item.unitPrice.toFixed(2),
          quantity: item.quantity,
          lineTotal: item.lineTotal.toFixed(2),
        })),
      );
    });

    return { id: input.id, total };
  }

  async findByDateRange(from: Date, to: Date): Promise<Sale[]> {
    const rows = await db.query.sales.findMany({
      where: and(
        gte(sales.clientCreatedAt, from),
        lte(sales.clientCreatedAt, to),
      ),
      orderBy: desc(sales.clientCreatedAt),
      with: {
        cashier: { columns: { name: true } },
        items: true,
      },
    });

    return rows.map(toSale);
  }

  async findById(id: string): Promise<Sale | null> {
    const row = await db.query.sales.findFirst({
      where: eq(sales.id, id),
      with: { items: true, cashier: { columns: { name: true } } },
    });

    return row ? toSale(row) : null;
  }
}
