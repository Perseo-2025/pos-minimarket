export const PRODUCT_CATEGORIES = [
  "bebidas",
  "snacks",
  "alimentos",
  "adornos",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  bebidas: "Bebidas",
  snacks: "Snacks",
  alimentos: "Alimentos",
  adornos: "Adornos",
};

// priceCost/stockQuantity/trackStock exist for a future inventory phase and
// are unused by any phase-1 use case.
export interface Product {
  id: string;
  sku: string | null;
  name: string;
  description: string | null;
  category: string;
  priceSale: number;
  priceCost: number | null;
  stockQuantity: number | null;
  trackStock: boolean;
  imageUrl: string | null;
  isActive: boolean;
}
