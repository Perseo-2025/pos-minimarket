import type { PaymentType } from "@/domain/entities/sale";
import type { CaptureSource } from "@/domain/value-objects/capture-source";
import type { WorkerDiscountUsage, WorkerStatus, WorkerVerification } from "@/domain/entities/worker";

export type PendingSale = {
  // The sale's client-generated uuid (sent as `uuid`), also the IndexedDB
  // key.
  id: string;
  // Who charged the sale. Optional only for records queued before this
  // field existed; the server attributes those to the syncing user.
  cashierId?: number;
  // The till shift it was charged in (absent on sales queued before shifts).
  shiftUuid?: string;
  paymentType: PaymentType;
  items: {
    productId: number;
    productName: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    // Per-line worker discount / courtesy (absent on sales queued before
    // per-product discounts).
    discountPercent?: number;
    discountAmount?: number;
    isCourtesy?: boolean;
    captureSource?: CaptureSource;
  }[];
  total: number;
  clientCreatedAt: string;
  // Airport-worker discount (absent for regular customers).
  workerId?: number;
  workerVerification?: WorkerVerification;
  verificationToken?: string;
  subtotal?: number;
  discountTotal?: number;
  policyId?: number;
  // Signed admin approval for the courtesy lines.
  courtesyToken?: string;
  status: "pending" | "syncing" | "error";
  errorMessage?: string;
};

// Mirror of the server snapshot (GET /api/sync/workers).
export type CachedWorker = {
  id: number;
  dni: string;
  fullName: string;
  company: string;
  status: WorkerStatus;
  pinHash: string | null;
  pointsBalance: number;
  usage: WorkerDiscountUsage;
};

export type CachedPolicy = {
  id: number;
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

// A cashier's open till shift on this device ("Abrir caja" → "Cerrar caja").
export type LocalShift = {
  cashierId: number;
  uuid: string;
  openedAt: string;
  openingCash: number;
  // Sales charged in this shift on this device, sent at closing so the
  // admin knows whether all of them reached the server.
  salesCount: number;
};

export type ShiftOpType = "open" | "movement" | "close";

// Shift operations made without internet (or whose send failed), replayed
// in order before the sales.
export type PendingShiftOp = {
  id: string;
  op: ShiftOpType;
  data: Record<string, unknown>;
  createdAt: string;
  status: "pending" | "error";
  errorMessage?: string;
};
