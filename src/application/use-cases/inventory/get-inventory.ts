import type { InventoryRepository } from "@/domain/repositories/inventory-repository";
import { storeDateKey } from "@/domain/value-objects/store-time";

const KARDEX_LIMIT = 200;

export async function getInventoryUseCase(repo: InventoryRepository) {
  const [locations, stock] = await Promise.all([
    repo.listLocations(),
    repo.listStock(),
  ]);
  return { locations, stock };
}

export async function getProductKardexUseCase(
  repo: InventoryRepository,
  productId: number,
) {
  const [locations, stock, movements] = await Promise.all([
    repo.listLocations(),
    repo.findProductStock(productId),
    repo.findMovements(productId, KARDEX_LIMIT),
  ]);
  return stock ? { locations, stock, movements, limit: KARDEX_LIMIT } : null;
}

// Lots inside their category's warning window, or already expired, as of
// today in the store's time zone.
export async function getExpiringLotsUseCase(
  repo: InventoryRepository,
  now = new Date(),
) {
  const todayKey = storeDateKey(now);
  return { todayKey, lots: await repo.listExpiringLots(todayKey) };
}
