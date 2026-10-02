import type { Product, ProductCatalogEntry } from "../entities/product";

export interface CreateProductData {
  name: string;
  barcode: string | null;
  description?: string;
  categoryId: number;
  priceSale: number;
  // Precio de compra per unit; null = not known yet.
  priceCost: number | null;
  // Expiry control: null = follow the category.
  tracksExpiry: boolean | null;
  workerDiscountAmount: number;
  imageUrl?: string | null;
}

export interface UpdateProductData extends CreateProductData {
  id: number;
}

export interface ProductRepository {
  // What the POS sells: active products in an active category with units on
  // the shop floor (Tienda). Stock only in the Almacén doesn't show yet.
  findSellable(): Promise<Product[]>;
  findAll(): Promise<Product[]>;
  findById(id: number): Promise<Product | null>;
  create(data: CreateProductData): Promise<void>;
  update(data: UpdateProductData): Promise<void>;
  setActive(id: number, isActive: boolean): Promise<void>;
  isImageInUse(imageUrl: string): Promise<boolean>;
  existsByBarcode(barcode: string, excludeId?: number): Promise<boolean>;
  // Current catalog entry per product id, to re-price sales server-side.
  findCatalogByIds(ids: number[]): Promise<Map<number, ProductCatalogEntry>>;
}
