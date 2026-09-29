import type { Product, ProductCategory } from "../entities/product";

export interface CreateProductData {
  name: string;
  description?: string;
  category: ProductCategory;
  priceSale: number;
}

export interface UpdateProductData extends CreateProductData {
  id: string;
}

export interface ProductRepository {
  findActive(): Promise<Product[]>;
  findAll(): Promise<Product[]>;
  findById(id: string): Promise<Product | null>;
  create(data: CreateProductData): Promise<void>;
  update(data: UpdateProductData): Promise<void>;
  setActive(id: string, isActive: boolean): Promise<void>;
}
