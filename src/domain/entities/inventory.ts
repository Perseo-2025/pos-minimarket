export type LocationKind = "warehouse" | "store";

export interface Location {
  id: number;
  name: string;
  kind: LocationKind;
}

export const LOCATION_KIND_LABELS: Record<LocationKind, string> = {
  warehouse: "Almacén",
  store: "Tienda",
};

export type StockMovementType =
  | "opening"
  | "count_adjustment"
  | "purchase_receipt"
  | "transfer_out"
  | "transfer_in"
  | "sale"
  | "sale_void"
  | "waste"
  | "supplier_return";

export const STOCK_MOVEMENT_LABELS: Record<StockMovementType, string> = {
  opening: "Stock inicial",
  count_adjustment: "Ajuste por conteo",
  purchase_receipt: "Compra recibida",
  transfer_out: "Traslado (salida)",
  transfer_in: "Traslado (entrada)",
  sale: "Venta",
  sale_void: "Venta anulada",
  waste: "Merma",
  supplier_return: "Devolución a proveedor",
};

// One row of the Kardex: what moved, where, why and who did it.
export interface StockMovement {
  id: number;
  productId: number;
  locationId: number;
  locationName: string;
  qtyDelta: number;
  balanceAfter: number;
  type: StockMovementType;
  // Key (uuid) of the sale / count that caused the movement.
  refId: string;
  // The document behind the movement, when there is one.
  saleId: number | null;
  receiptId: number | null;
  transferId: number | null;
  unitCost: number | null;
  note: string | null;
  actorName: string | null;
  occurredAt: Date;
  createdAt: Date;
}

// A product's balance at every location (0 where it never moved).
export interface ProductStock {
  productId: number;
  productName: string;
  categoryName: string;
  isActive: boolean;
  trackStock: boolean;
  // Keyed by location id.
  byLocation: Record<number, number>;
  total: number;
  // Expiry-controlled products keep their stock in dated lots.
  tracksExpiry: boolean;
  // The category's warning window, in days.
  expiryWarningDays: number;
  lots: StockLot[];
}

// Units of a product at one location sharing an expiry date (YYYY-MM-DD).
export interface StockLot {
  locationId: number;
  expiresAt: string;
  quantity: number;
}

// A lot inside its category's warning window, or already expired.
export interface ExpiringLot extends StockLot {
  lotId: number;
  productId: number;
  productName: string;
  categoryName: string;
  locationName: string;
  locationKind: LocationKind;
  warningDays: number;
  priceCost: number | null;
}
