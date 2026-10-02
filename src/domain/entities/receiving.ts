import type { CaptureSource } from "../value-objects/capture-source";
import type { DiscrepancyResolution } from "../services/receiving";

export type ReceiptDocType = "factura" | "boleta" | "guia" | "ninguno";

export const RECEIPT_DOC_TYPES: ReceiptDocType[] = [
  "factura",
  "boleta",
  "guia",
  "ninguno",
];

export const RECEIPT_DOC_TYPE_LABELS: Record<ReceiptDocType, string> = {
  factura: "Factura",
  boleta: "Boleta",
  guia: "Guía de remisión",
  ninguno: "Sin documento",
};

// A receipt line already converted to units and cost per unit.
export interface PreparedReceiptLine {
  productId: number;
  presentationId: number | null;
  quantity: number;
  // What the invoice says / what actually arrived (both in units).
  units: number;
  receivedUnits: number;
  lineTotal: number;
  unitCost: number;
  isBonus: boolean;
  expiresAt: string | null;
  captureSource: CaptureSource | null;
}

export interface NewGoodsReceipt {
  supplierId: number | null;
  // The purchase order this merchandise answers, if any.
  orderId: number | null;
  docType: ReceiptDocType;
  docNumber: string | null;
  note: string | null;
  total: number;
  lines: PreparedReceiptLine[];
  actorId: number;
}

export interface GoodsReceiptLine {
  productName: string;
  presentationName: string | null;
  quantity: number;
  units: number;
  receivedUnits: number;
  lineTotal: number;
  isBonus: boolean;
  expiresAt: string | null;
}

export interface GoodsReceipt {
  id: number;
  receivedAt: Date;
  supplierName: string | null;
  docType: ReceiptDocType;
  docNumber: string | null;
  total: number;
  note: string | null;
  createdByName: string | null;
  lines: GoodsReceiptLine[];
}

export interface NewStockTransfer {
  // Units per product (already converted from presentations).
  lines: { productId: number; units: number; captureSource: CaptureSource | null }[];
  note: string | null;
  actorId: number;
}

export interface StockTransfer {
  id: number;
  createdAt: Date;
  fromName: string;
  toName: string;
  note: string | null;
  createdByName: string | null;
  lines: { productName: string; units: number }[];
}

export type DiscrepancyStatus = "open" | DiscrepancyResolution;

export const DISCREPANCY_STATUS_LABELS: Record<DiscrepancyStatus, string> = {
  open: "Por resolver",
  replenished: "El proveedor lo trajo",
  credited: "El proveedor lo descontó",
  written_off: "Se asumió la pérdida",
  kept: "Nos quedamos con lo extra",
  returned: "Se devolvió al proveedor",
};

// A receipt line where what arrived didn't match the invoice.
export interface ReceiptDiscrepancy {
  id: number;
  receiptId: number;
  receivedAt: Date;
  supplierName: string | null;
  docNumber: string | null;
  productId: number;
  productName: string;
  tracksExpiry: boolean;
  invoiceUnits: number;
  receivedUnits: number;
  // < 0 missing, > 0 extra.
  units: number;
  amount: number;
  status: DiscrepancyStatus;
  resolutionNote: string | null;
  resolvedByName: string | null;
  resolvedAt: Date | null;
}
