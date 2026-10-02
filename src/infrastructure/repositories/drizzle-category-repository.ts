import { and, asc, eq, ne, sql } from "drizzle-orm";
import type {
  Category,
  CategoryIcon,
  CategoryWithCounts,
} from "@/domain/entities/category";
import type {
  CategoryData,
  CategoryRepository,
} from "@/domain/repositories/category-repository";
import { db } from "@/infrastructure/db/client";
import {
  categories,
  products,
  supplierCategories,
  suppliers,
} from "@/infrastructure/db/schema";

function toCategory(row: typeof categories.$inferSelect): Category {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon as CategoryIcon | null,
    sortOrder: row.sortOrder,
    tracksExpiry: row.tracksExpiry,
    expiryWarningDays: row.expiryWarningDays,
    isActive: row.isActive,
  };
}

const order = [asc(categories.sortOrder), asc(categories.name)];

export class DrizzleCategoryRepository implements CategoryRepository {
  async findAllWithCounts(): Promise<CategoryWithCounts[]> {
    const rows = await db
      .select({
        category: categories,
        productCount: sql<number>`count(${products.id})::int`,
        activeProductCount: sql<number>`count(${products.id}) filter (where ${products.isActive})::int`,
      })
      .from(categories)
      .leftJoin(products, eq(products.categoryId, categories.id))
      .groupBy(categories.id)
      .orderBy(...order);

    const links = await db
      .select({
        categoryId: supplierCategories.categoryId,
        id: suppliers.id,
        name: sql<string>`coalesce(${suppliers.tradeName}, ${suppliers.businessName})`,
      })
      .from(supplierCategories)
      .innerJoin(suppliers, eq(suppliers.id, supplierCategories.supplierId))
      .where(eq(suppliers.isActive, true))
      .orderBy(asc(suppliers.businessName));

    return rows.map((row) => ({
      ...toCategory(row.category),
      productCount: row.productCount,
      activeProductCount: row.activeProductCount,
      suppliers: links
        .filter((link) => link.categoryId === row.category.id)
        .map(({ id, name }) => ({ id, name })),
    }));
  }

  async findActive(): Promise<Category[]> {
    const rows = await db
      .select()
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(...order);
    return rows.map(toCategory);
  }

  async findById(id: number): Promise<Category | null> {
    const [row] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);
    return row ? toCategory(row) : null;
  }

  async existsByName(name: string, excludeId?: number): Promise<boolean> {
    // Mirrors the lower(name) unique index.
    const sameName = sql`lower(${categories.name}) = lower(${name})`;
    const [row] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(excludeId ? and(sameName, ne(categories.id, excludeId)) : sameName)
      .limit(1);
    return row !== undefined;
  }

  async create(data: CategoryData): Promise<void> {
    await db.insert(categories).values(data);
  }

  async update(id: number, data: CategoryData): Promise<void> {
    await db
      .update(categories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(categories.id, id));
  }

  async setActive(id: number, isActive: boolean): Promise<void> {
    await db
      .update(categories)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(categories.id, id));
  }
}
