import type { AuditFlag } from "./audit";
import type { CaptureSource } from "../value-objects/capture-source";
import type { WorkerVerification } from "./worker";

export type PaymentType = "cash" | "yape_plin" | "card";
export const PAYMENT_TYPES: PaymentType[] = ["cash", "yape_plin", "card"];

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  cash: "Efectivo",
  yape_plin: "Yape/Plin",
  card: "Tarjeta",
};

export type SaleStatus = "completed" | "voided";

export interface SaleItemInput {
  productId: number;
  productName: string;
  unitPrice: number;
  quantity: number;
  // Gross amount (unitPrice × quantity), before any discount.
  lineTotal: number;
  // Worker discount on this line (0 when none) — see sale-pricing.ts:
  // soles per unit (snapshot of the product setting) and the amount taken
  // off lineTotal.
  discountUnitAmount?: number;
  discountAmount?: number;
  // Given away whole: the worker's birthday gift (one unit). On older sales,
  // a courtesy an admin approved at the till.
  isGift?: boolean;
  captureSource?: CaptureSource | null;
}

// The shape a sale is created with. Its uuid is supplied by the client, since
// a sale can be built entirely offline before it ever reaches the server
// (see SaleRepository.insertWithItems for idempotency); the numeric id is
// assigned by the database on sync.
// cashierId is captured at checkout time — not at sync time — so a sale made
// offline stays attributed to whoever actually charged it, even if another
// cashier is logged in when the queue finally syncs.
export interface SaleInput {
  uuid: string;
  cashierId: number;
  paymentType: PaymentType;
  items: SaleItemInput[];
  total: number;
  clientCreatedAt: string;
  // Airport-worker discount (all optional: plain customer sales, and sales
  // queued before this feature existed, carry none of it).
  workerId?: number;
  workerVerification?: WorkerVerification;
  discountTotal?: number;
  policyId?: number;
}

// What is actually persisted, after the server re-priced and audited the
// sale. Amounts are the ones the POS charged; flags record any disagreement.
export interface SaleRecord {
  uuid: string;
  // cash_shifts.uuid of the shift it was charged in (null: before shifts).
  shiftUuid: string | null;
  cashierId: number;
  paymentType: PaymentType;
  items: SaleItemInput[];
  clientCreatedAt: string;
  subtotal: number;
  discountTotal: number;
  giftTotal: number;
  total: number;
  workerId: number | null;
  policyId: number | null;
  workerVerification: WorkerVerification;
  pointsEarned: number;
  auditFlags: AuditFlag[];
}

export interface SaleItem extends SaleItemInput {
  id: number;
  saleId: number;
}

export interface Sale {
  id: number;
  uuid: string;
  cashierId: number;
  cashierName?: string;
  status: SaleStatus;
  paymentType: PaymentType;
  subtotal: number;
  discountTotal: number;
  giftTotal: number;
  // Only on older sales, whose free lines were courtesies an admin approved
  // (null: the free line is a birthday gift).
  courtesyApprovedByName: string | null;
  total: number;
  workerId: number | null;
  workerName: string | null;
  workerDni: string | null;
  workerVerification: WorkerVerification;
  pointsEarned: number;
  auditFlags: AuditFlag[];
  clientCreatedAt: Date;
  syncedAt: Date | null;
  createdAt: Date;
  items: SaleItem[];
}
