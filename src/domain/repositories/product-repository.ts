import type { Product, ProductCatalogEntry } from "../entities/product";

export interface CreateProductData {
  name: string;
  description?: string;
  categoryId: string;
  priceSale: number;
  workerDiscountPercent: number;
  imageUrl?: string | null;
}

export interface UpdateProductData extends CreateProductData {
  id: string;
}

export interface ProductRepository {
  // Active products whose category is also active — what the POS sells.
  findActive(): Promise<Product[]>;
  findAll(): Promise<Product[]>;
  findById(id: string): Promise<Product | null>;
  create(data: CreateProductData): Promise<void>;
  update(data: UpdateProductData): Promise<void>;
  setActive(id: string, isActive: boolean): Promise<void>;
  isImageInUse(imageUrl: string): Promise<boolean>;
  // Current catalog entry per product id, to re-price sales server-side.
  findCatalogByIds(ids: string[]): Promise<Map<string, ProductCatalogEntry>>;
}
