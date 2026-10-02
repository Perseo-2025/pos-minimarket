import type { DailyCountProduct } from "@/domain/entities/daily-count";
import { ValidationError } from "@/domain/errors";
import type { DailyCountRepository } from "@/domain/repositories/daily-count-repository";
import type { InventoryRepository } from "@/domain/repositories/inventory-repository";
import type { ProductRepository } from "@/domain/repositories/product-repository";
import { suggestDailyCount } from "@/domain/services/daily-count";
import { normalizeCountedLots } from "@/domain/services/expiry";
import { storeDateKey } from "@/domain/value-objects/store-time";
import {
  dailyCountSchema,
  reviewCountSchema,
} from "@/application/validation/daily-count";

const PRODUCTS_PER_DAY = 10;

// Today's handful of products to count at a location, riskiest first.
export async function getDailyCountUseCase(
  repo: DailyCountRepository,
  locationId: number,
  now = new Date(),
): Promise<DailyCountProduct[]> {
  const todayKey = storeDateKey(now);
  const rows = await repo.listCandidates(locationId, todayKey);
  const suggestions = suggestDailyCount(
    rows.map((row) => row.candidate),
    todayKey,
    PRODUCTS_PER_DAY,
  );
  return suggestions.map((s) => {
    const row = rows.find((r) => r.candidate.productId === s.productId)!;
    return {
      productId: s.productId,
      productName: row.productName,
      categoryName: row.categoryName,
      tracksExpiry: row.tracksExpiry,
      lotDates: row.lotDates,
      reasons: s.reasons,
    };
  });
}

export async function submitDailyCountUseCase(
  repos: {
    counts: DailyCountRepository;
    products: ProductRepository;
    inventory: InventoryRepository;
  },
  input: unknown,
  actorId: number,
) {
  const data = dailyCountSchema.parse(input);
  const locations = await repos.inventory.listLocations();
  if (!locations.some((l) => l.id === data.locationId)) {
    throw new ValidationError("La ubicación no existe");
  }

  const items = [];
  for (const item of data.items) {
    const product = await repos.products.findById(item.productId);
    if (!product) throw new ValidationError("Uno de los productos no existe");
    let lots = null;
    if (product.tracksExpiry) {
      try {
        lots = normalizeCountedLots(item.counted, item.lots);
      } catch (error) {
        throw new ValidationError(`${product.name}: ${(error as Error).message}`);
      }
    }
    items.push({
      productId: product.id,
      counted: item.counted,
      lots,
      captureSource: item.captureSource,
    });
  }

  return repos.counts.submit({ locationId: data.locationId, actorId, items });
}

export function listCountItemsUseCase(repo: DailyCountRepository) {
  return repo.listItems(200);
}

// The admin approves the adjustment or asks for a recount.
export async function reviewCountUseCase(
  repo: DailyCountRepository,
  input: unknown,
  actorId: number,
) {
  const data = reviewCountSchema.parse(input);
  const item = await repo.findItem(data.id);
  if (!item) throw new ValidationError("El conteo no existe");
  if (item.status !== "pending") throw new ValidationError("Este conteo ya fue revisado");
  await repo.review({ ...data, actorId });
}
