import type { CountedLot } from "../services/expiry";
import type {
  ExpiringLot,
  Location,
  ProductStock,
  StockMovement,
} from "../entities/inventory";

export interface StockCountData {
  productId: number;
  locationId: number;
  counted: number;
  note?: string | null;
  actorId: number;
  // Expiry-controlled products: the counted units by date (they replace the
  // product's lots at that location). null = product without expiry.
  lots: CountedLot[] | null;
}

export interface InventoryRepository {
  listLocations(): Promise<Location[]>;
  listStock(): Promise<ProductStock[]>;
  findProductStock(productId: number): Promise<ProductStock | null>;
  // Newest first.
  findMovements(productId: number, limit: number): Promise<StockMovement[]>;
  // Locks the product's balance at that location, applies the count
  // (see planStockCount) and starts tracking the product. Returns the
  // recorded delta, or null when the count matched the system.
  applyCount(data: StockCountData): Promise<{ delta: number } | null>;
  // Lots expiring within their category's warning window (or expired) as of
  // `todayKey` (YYYY-MM-DD), soonest first.
  listExpiringLots(todayKey: string): Promise<ExpiringLot[]>;
}
