import { stockCountSchema } from "@/application/validation/inventory";
import { ValidationError } from "@/domain/errors";
import { normalizeCountedLots } from "@/domain/services/expiry";
import type { InventoryRepository } from "@/domain/repositories/inventory-repository";
import type { ProductRepository } from "@/domain/repositories/product-repository";

// Records a physical count: the first one is the product's opening stock at
// that location, later ones adjust the balance with a mandatory reason.
export async function countStockUseCase(
  repos: { inventory: InventoryRepository; products: ProductRepository },
  input: unknown,
  actorId: number,
) {
  const data = stockCountSchema.parse(input);

  const [product, locations] = await Promise.all([
    repos.products.findById(data.productId),
    repos.inventory.listLocations(),
  ]);
  if (!product) throw new ValidationError("El producto no existe");
  if (!locations.some((l) => l.id === data.locationId)) {
    throw new ValidationError("La ubicación no existe");
  }

  // Every counted unit of an expiry-controlled product needs its date.
  const lots = product.tracksExpiry
    ? normalizeCountedLots(data.counted, data.lots)
    : null;

  return repos.inventory.applyCount({ ...data, lots, actorId });
}
