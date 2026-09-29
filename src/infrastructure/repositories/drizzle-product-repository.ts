import { and, asc, eq, inArray } from "drizzle-orm";
import type { CategoryIcon } from "@/domain/entities/category";
import type { Product, ProductCatalogEntry } from "@/domain/entities/product";
import type {
  CreateProductData,
  ProductRepository,
  UpdateProductData,
} from "@/domain/repositories/product-repository";
import { db } from "@/infrastructure/db/client";
import { categories, products } from "@/infrastructure/db/schema";

type ProductRow = {
  product: typeof products.$inferSelect;
  category: typeof categories.$inferSelect;
};

function toProduct({ product: row, category }: ProductRow): Product {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    description: row.description,
    categoryId: row.categoryId,
    categoryName: category.name,
    categoryIcon: category.icon as CategoryIcon | null,
    priceSale: Number(row.priceSale),
    workerDiscountPercent: Number(row.workerDiscountPercent),
    priceCost: row.priceCost === null ? null : Number(row.priceCost),
    stockQuantity: row.stockQuantity,
    trackStock: row.trackStock,
    imageUrl: row.imageUrl,
    isActive: row.isActive,
  };
}

// Every read joins the category: products are always shown with its name,
// and ordered the same way the POS sidebar is.
function selectProducts() {
  return db
    .select({ product: products, category: categories })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id));
}

const order = [
  asc(categories.sortOrder),
  asc(categories.name),
  asc(products.name),
];

export class DrizzleProductRepository implements ProductRepository {
  async findActive(): Promise<Product[]> {
    const rows = await selectProducts()
      .where(and(eq(products.isActive, true), eq(categories.isActive, true)))
      .orderBy(...order);

    return rows.map(toProduct);
  }

  async findAll(): Promise<Product[]> {
    const rows = await selectProducts().orderBy(...order);

    return rows.map(toProduct);
  }

  async findById(id: string): Promise<Product | null> {
    const [row] = await selectProducts()
      .where(eq(products.id, id))
      .limit(1);

    return row ? toProduct(row) : null;
  }

  async create(data: CreateProductData): Promise<void> {
    await db.insert(products).values({
      name: data.name,
      description: data.description,
      categoryId: data.categoryId,
      priceSale: data.priceSale.toString(),
      workerDiscountPercent: data.workerDiscountPercent.toString(),
      imageUrl: data.imageUrl ?? null,
    });
  }

  async update(data: UpdateProductData): Promise<void> {
    await db
      .update(products)
      .set({
        name: data.name,
        description: data.description,
        categoryId: data.categoryId,
        priceSale: data.priceSale.toString(),
        workerDiscountPercent: data.workerDiscountPercent.toString(),
        imageUrl: data.imageUrl,
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

  async isImageInUse(imageUrl: string): Promise<boolean> {
    const [row] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.imageUrl, imageUrl))
      .limit(1);

    return row !== undefined;
  }

  async findCatalogByIds(ids: string[]): Promise<Map<string, ProductCatalogEntry>> {
    if (ids.length === 0) return new Map();

    const rows = await db
      .select({
        id: products.id,
        priceSale: products.priceSale,
        workerDiscountPercent: products.workerDiscountPercent,
      })
      .from(products)
      .where(inArray(products.id, ids));

    return new Map(
      rows.map((row) => [
        row.id,
        {
          price: Number(row.priceSale),
          workerDiscountPercent: Number(row.workerDiscountPercent),
        },
      ]),
    );
  }
}
