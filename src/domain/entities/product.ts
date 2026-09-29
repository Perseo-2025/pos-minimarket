import type { CategoryIcon } from "./category";

// priceCost/stockQuantity/trackStock exist for a future inventory phase and
// are unused by any phase-1 use case.
export interface Product {
  id: string;
  sku: string | null;
  name: string;
  description: string | null;
  categoryId: string;
  categoryName: string;
  categoryIcon: CategoryIcon | null;
  priceSale: number;
  // % an identified airport worker gets off this product (0–99).
  workerDiscountPercent: number;
  priceCost: number | null;
  stockQuantity: number | null;
  trackStock: boolean;
  imageUrl: string | null;
  isActive: boolean;
}

// What the server re-prices a sale against: today's catalog price and the
// worker discount allowed on the product.
export interface ProductCatalogEntry {
  price: number;
  workerDiscountPercent: number;
}
