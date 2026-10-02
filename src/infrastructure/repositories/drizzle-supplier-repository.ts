import { and, asc, eq, inArray, ne } from "drizzle-orm";
import type { Supplier, SupplierData } from "@/domain/entities/supplier";
import type { SupplierRepository } from "@/domain/repositories/supplier-repository";
import { db } from "@/infrastructure/db/client";
import {
  categories,
  supplierCategories,
  suppliers,
} from "@/infrastructure/db/schema";
import type { Tx } from "./stock-ledger";

type SupplierRow = typeof suppliers.$inferSelect;

// Attaches each supplier's categories (one extra query, not one per row).
async function withCategories(rows: SupplierRow[]): Promise<Supplier[]> {
  if (rows.length === 0) return [];
  const links = await db
    .select({
      supplierId: supplierCategories.supplierId,
      id: categories.id,
      name: categories.name,
    })
    .from(supplierCategories)
    .innerJoin(categories, eq(categories.id, supplierCategories.categoryId))
    .where(
      inArray(
        supplierCategories.supplierId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  return rows.map((row) => ({
    id: row.id,
    ruc: row.ruc,
    businessName: row.businessName,
    tradeName: row.tradeName,
    contactName: row.contactName,
    phone: row.phone,
    email: row.email,
    address: row.address,
    notes: row.notes,
    isActive: row.isActive,
    categories: links
      .filter((link) => link.supplierId === row.id)
      .map(({ id, name }) => ({ id, name })),
  }));
}

function toColumns(data: SupplierData) {
  const { categoryIds, ...columns } = data;
  void categoryIds;
  return columns;
}

async function replaceCategories(
  tx: Tx,
  supplierId: number,
  categoryIds: number[],
) {
  await tx
    .delete(supplierCategories)
    .where(eq(supplierCategories.supplierId, supplierId));
  const unique = [...new Set(categoryIds)];
  if (unique.length > 0) {
    await tx
      .insert(supplierCategories)
      .values(unique.map((categoryId) => ({ supplierId, categoryId })));
  }
}

export class DrizzleSupplierRepository implements SupplierRepository {
  async findAll() {
    const rows = await db
      .select()
      .from(suppliers)
      .orderBy(asc(suppliers.businessName));
    return withCategories(rows);
  }

  async findById(id: number) {
    const rows = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, id))
      .limit(1);
    return (await withCategories(rows))[0] ?? null;
  }

  async existsByRuc(ruc: string, excludeId?: number) {
    const sameRuc = eq(suppliers.ruc, ruc);
    const [row] = await db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(excludeId ? and(sameRuc, ne(suppliers.id, excludeId)) : sameRuc)
      .limit(1);
    return row !== undefined;
  }

  // The supplier and its categories are saved together or not at all.
  async create(data: SupplierData) {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(suppliers)
        .values(toColumns(data))
        .returning({ id: suppliers.id });
      await replaceCategories(tx, row.id, data.categoryIds);
    });
  }

  async update(id: number, data: SupplierData) {
    await db.transaction(async (tx) => {
      await tx
        .update(suppliers)
        .set({ ...toColumns(data), updatedAt: new Date() })
        .where(eq(suppliers.id, id));
      await replaceCategories(tx, id, data.categoryIds);
    });
  }

  async setActive(id: number, isActive: boolean) {
    await db
      .update(suppliers)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(suppliers.id, id));
  }
}
