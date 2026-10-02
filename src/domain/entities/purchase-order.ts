import type { PurchaseOrderStatus } from "../services/purchase-orders";

export type { PurchaseOrderStatus };

export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  pending: "Pendiente",
  partial: "Llegó una parte",
  received: "Recibida",
  cancelled: "Anulada",
};

export interface PurchaseOrderLine {
  productId: number;
  productName: string;
  presentationId: number | null;
  presentationName: string | null;
  quantity: number;
  units: number;
  estimatedTotal: number | null;
  // Units the supplier already delivered (invoiced) through receipts of
  // this order; what was missing from them is in receipt_discrepancies.
  receivedUnits: number;
}

export interface PurchaseOrder {
  id: number;
  supplierId: number;
  supplierName: string;
  status: PurchaseOrderStatus;
  expectedAt: string | null;
  estimatedTotal: number | null;
  note: string | null;
  createdAt: Date;
  createdByName: string | null;
  lines: PurchaseOrderLine[];
  receipts: { id: number; receivedAt: Date; docNumber: string | null }[];
}

export interface NewPurchaseOrder {
  supplierId: number;
  expectedAt: string | null;
  note: string | null;
  estimatedTotal: number | null;
  lines: {
    productId: number;
    presentationId: number | null;
    quantity: number;
    units: number;
    estimatedTotal: number | null;
  }[];
  actorId: number;
}
