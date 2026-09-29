import type { AuditFlag } from "./audit";
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
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  // Gross amount (unitPrice × quantity), before any discount.
  lineTotal: number;
  // Worker discount on this line (0 when none) — see sale-pricing.ts.
  discountPercent?: number;
  discountAmount?: number;
  // Given away, approved by an admin at the till.
  isCourtesy?: boolean;
}

// The shape a sale is created with — the id and every item id are supplied
// by the client, since a sale can be built entirely offline before it ever
// reaches the server (see SaleRepository.insertWithItems for idempotency).
// cashierId is captured at checkout time — not at sync time — so a sale made
// offline stays attributed to whoever actually charged it, even if another
// cashier is logged in when the queue finally syncs.
export interface SaleInput {
  id: string;
  cashierId: string;
  paymentType: PaymentType;
  items: SaleItemInput[];
  total: number;
  clientCreatedAt: string;
  // Airport-worker discount (all optional: plain customer sales, and sales
  // queued before this feature existed, carry none of it).
  workerId?: string;
  workerVerification?: WorkerVerification;
  // Signed proof that the PIN was checked online (see worker-token).
  verificationToken?: string;
  discountTotal?: number;
  policyId?: string;
  // Signed admin approval covering the courtesy lines (see courtesy-token).
  courtesyToken?: string;
}

// What is actually persisted, after the server re-priced and audited the
// sale. Amounts are the ones the POS charged; flags record any disagreement.
export interface SaleRecord {
  id: string;
  cashierId: string;
  paymentType: PaymentType;
  items: SaleItemInput[];
  clientCreatedAt: string;
  subtotal: number;
  discountTotal: number;
  discountPercent: number;
  courtesyTotal: number;
  courtesyApprovedBy: string | null;
  total: number;
  workerId: string | null;
  policyId: string | null;
  workerVerification: WorkerVerification;
  pointsEarned: number;
  auditFlags: AuditFlag[];
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
  subtotal: number;
  discountTotal: number;
  discountPercent: number;
  courtesyTotal: number;
  courtesyApprovedByName: string | null;
  total: number;
  workerId: string | null;
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
