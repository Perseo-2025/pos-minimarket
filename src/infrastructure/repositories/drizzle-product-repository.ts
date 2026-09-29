import { asc, eq } from "drizzle-orm";
import type { Product } from "@/domain/entities/product";
import type {
  CreateProductData,
  ProductRepository,
  UpdateProductData,
} from "@/domain/repositories/product-repository";
import { db } from "@/infrastructure/db/client";
import { products } from "@/infrastructure/db/schema";

function toProduct(row: typeof products.$inferSelect): Product {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    description: row.description,
    category: row.category,
    priceSale: Number(row.priceSale),
    priceCost: row.priceCost === null ? null : Number(row.priceCost),
    stockQuantity: row.stockQuantity,
    trackStock: row.trackStock,
    imageUrl: row.imageUrl,
    isActive: row.isActive,
  };
}

export class DrizzleProductRepository implements ProductRepository {
  async findActive(): Promise<Product[]> {
    const rows = await db
      .select()
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(asc(products.category), asc(products.name));

    return rows.map(toProduct);
  }

  async findAll(): Promise<Product[]> {
    const rows = await db
      .select()
      .from(products)
      .orderBy(asc(products.category), asc(products.name));

    return rows.map(toProduct);
  }

  async findById(id: string): Promise<Product | null> {
    const [row] = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    return row ? toProduct(row) : null;
  }

  async create(data: CreateProductData): Promise<void> {
    await db.insert(products).values({
      name: data.name,
      description: data.description,
      category: data.category,
      priceSale: data.priceSale.toString(),
    });
  }

  async update(data: UpdateProductData): Promise<void> {
    await db
      .update(products)
      .set({
        name: data.name,
        description: data.description,
        category: data.category,
        priceSale: data.priceSale.toString(),
        updatedAt: new Date(),
      })
      .where(eq(products.id, data.id));
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    await db
      .update(products)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(products.id, id));
  }
}
