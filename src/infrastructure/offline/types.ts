import type { PaymentType } from "@/domain/entities/sale";
import type { WorkerDiscountUsage, WorkerStatus, WorkerVerification } from "@/domain/entities/worker";

export type PendingSale = {
  id: string;
  // Who charged the sale. Optional only for records queued before this
  // field existed; the server attributes those to the syncing user.
  cashierId?: string;
  paymentType: PaymentType;
  items: {
    id: string;
    productId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    // Per-line worker discount / courtesy (absent on sales queued before
    // per-product discounts).
    discountPercent?: number;
    discountAmount?: number;
    isCourtesy?: boolean;
  }[];
  total: number;
  clientCreatedAt: string;
  // Airport-worker discount (absent for regular customers).
  workerId?: string;
  workerVerification?: WorkerVerification;
  verificationToken?: string;
  subtotal?: number;
  discountTotal?: number;
  policyId?: string;
  // Signed admin approval for the courtesy lines.
  courtesyToken?: string;
  status: "pending" | "syncing" | "error";
  errorMessage?: string;
};

// Mirror of the server snapshot (GET /api/sync/workers).
export type CachedWorker = {
  id: string;
  dni: string;
  fullName: string;
  company: string;
  status: WorkerStatus;
  pinHash: string | null;
  pointsBalance: number;
  usage: WorkerDiscountUsage;
};

export type CachedPolicy = {
  id: string;
  discountPercent: number;
  maxDiscountedSalesPerDay: number;
  maxDiscountPerMonth: number;
  pointsPerSol: number;
};

export type WorkerSnapshotRecord = {
  key: "current";
  generatedAt: string;
  policy: CachedPolicy | null;
  workers: CachedWorker[];
};

export type WorkerOpType = "register" | "pin_reset" | "pin_failed";

// Worker operations made at the till while offline (or whose send failed),
// replayed by the sync engine. PINs are stored hashed, never in plain text.
export type PendingWorkerOp = {
  id: string;
  op: WorkerOpType;
  data: Record<string, unknown>;
  // Shown in the POS while pending, e.g. "Registro de 45678912".
  label: string;
  // For registrations: lets the POS treat the DNI as "pending approval".
  dni?: string;
  createdAt: string;
  status: "pending" | "error";
  errorMessage?: string;
};

export type PinAttemptRecord = {
  dni: string;
  failures: number;
  lockedUntil: number | null;
};
