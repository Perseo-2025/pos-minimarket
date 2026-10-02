import type { CategoryRepository } from "@/domain/repositories/category-repository";
import type { InventoryRepository } from "@/domain/repositories/inventory-repository";
import type { ProductRepository } from "@/domain/repositories/product-repository";
import type { SupplierRepository } from "@/domain/repositories/supplier-repository";

export interface SetupProgress {
  categories: number;
  suppliers: number;
  products: number;
  // Products with units in the Almacén / in the Tienda.
  inWarehouse: number;
  inStore: number;
}

// How far the store is along the flow: catalog → Almacén → Tienda → caja.
export async function getSetupProgressUseCase(repos: {
  categories: CategoryRepository;
  suppliers: SupplierRepository;
  products: ProductRepository;
  inventory: InventoryRepository;
}): Promise<SetupProgress> {
  const [categories, suppliers, products, locations, stock] = await Promise.all([
    repos.categories.findAllWithCounts(),
    repos.suppliers.findAll(),
    repos.products.findAll(),
    repos.inventory.listLocations(),
    repos.inventory.listStock(),
  ]);
  const unitsAt = (kind: "warehouse" | "store") => {
    const ids = locations.filter((l) => l.kind === kind).map((l) => l.id);
    return stock.filter((s) => ids.some((id) => (s.byLocation[id] ?? 0) > 0)).length;
  };
  return {
    categories: categories.length,
    suppliers: suppliers.length,
    products: products.length,
    inWarehouse: unitsAt("warehouse"),
    inStore: unitsAt("store"),
  };
}
