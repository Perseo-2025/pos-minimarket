export type PaymentType = "cash" | "yape_plin" | "card";
export type SaleStatus = "completed" | "voided";

export interface SaleItemInput {
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

// The shape a sale is created with — the id and every item id are supplied
// by the client, since a sale can be built entirely offline before it ever
// reaches the server (see SaleRepository.insertWithItems for idempotency).
export interface SaleInput {
  id: string;
  paymentType: PaymentType;
  items: SaleItemInput[];
  total: number;
  clientCreatedAt: string;
}

export interface SaleItem extends SaleItemInput {
  saleId: string;
}

export interface Sale {
  id: string;
  cashierId: string;
  cashierName?: string;
  status: SaleStatus;
  paymentType: PaymentType;
  total: number;
  clientCreatedAt: Date;
  syncedAt: Date | null;
  createdAt: Date;
  items: SaleItem[];
}
