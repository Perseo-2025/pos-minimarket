import type {
  NewPurchaseOrder,
  PurchaseOrder,
  PurchaseOrderStatus,
} from "../entities/purchase-order";

export interface PurchaseOrderRepository {
  create(data: NewPurchaseOrder): Promise<{ id: number }>;
  // With the units received so far per line and the receipts made from it.
  findById(id: number): Promise<PurchaseOrder | null>;
  list(limit: number): Promise<PurchaseOrder[]>;
  setStatus(id: number, status: PurchaseOrderStatus): Promise<void>;
}
