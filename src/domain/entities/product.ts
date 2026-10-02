import type { CategoryIcon } from "./category";

// priceCost/stockQuantity/trackStock exist for a future inventory phase and
// are unused by any phase-1 use case.
export interface Product {
  id: number;
  sku: string | null;
  // Printed on the unit; boxes/displays carry theirs in presentations.
  barcode: string | null;
  name: string;
  description: string | null;
  categoryId: number;
  categoryName: string;
  categoryIcon: CategoryIcon | null;
  priceSale: number;
  // Soles an identified airport worker gets off each unit (below the price).
  workerDiscountAmount: number;
  priceCost: number | null;
  stockQuantity: number | null;
  trackStock: boolean;
  // Set on the product itself; null = follow the category.
  tracksExpiryOverride: boolean | null;
  // Effective: the override, or else the category's setting.
  tracksExpiry: boolean;
  expiryWarningDays: number;
  imageUrl: string | null;
  isActive: boolean;
}

// What the server re-prices a sale against: today's catalog price and the
// worker discount allowed on the product.
export interface ProductCatalogEntry {
  price: number;
  workerDiscountAmount: number;
}
