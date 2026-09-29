// An airport worker: a *customer* entitled to the staff discount. Not to be
// confused with the minimarket's own cashiers (User with role "cashier") —
// workers never log into the POS, they identify at the till with their DNI
// plus a 6-digit PIN only they know.
export type WorkerStatus = "pending" | "active" | "suspended" | "rejected";

// Why a worker is waiting for the admin: a brand-new registration, or a PIN
// change requested at the till (a cashier could otherwise set a PIN they know).
export type WorkerPendingReason = "new" | "pin_reset";

// Where the full name came from: the DNI lookup service (trusted) or typed
// by the cashier because the service was unreachable (admin double-checks).
export type WorkerNameSource = "api" | "manual";

// How the worker proved presence for a discounted sale.
export type WorkerVerification = "none" | "pin_online" | "pin_offline";

export const WORKER_STATUS_LABELS: Record<WorkerStatus, string> = {
  pending: "Pendiente",
  active: "Activo",
  suspended: "Suspendido",
  rejected: "Rechazado",
};

export const WORKER_PENDING_REASON_LABELS: Record<WorkerPendingReason, string> = {
  new: "Nuevo registro",
  pin_reset: "Cambio de clave",
};

export const WORKER_VERIFICATION_LABELS: Record<WorkerVerification, string> = {
  none: "Sin verificar",
  pin_online: "Clave verificada en línea",
  pin_offline: "Clave verificada sin conexión",
};

export const DNI_PATTERN = /^\d{8}$/;
export const PIN_LENGTH = 6;
export const PIN_PATTERN = /^\d{6}$/;

export interface Worker {
  id: string;
  dni: string;
  fullName: string;
  nameSource: WorkerNameSource;
  company: string;
  status: WorkerStatus;
  pendingReason: WorkerPendingReason | null;
  pointsBalance: number;
  registeredById: string | null;
  registeredByName?: string | null;
  approvedAt: Date | null;
  createdAt: Date;
}

// Stored PIN hash is never part of Worker; only repositories and the offline
// snapshot (active workers only) ever see it.
export interface WorkerWithPin extends Worker {
  pinHash: string;
}

export function withoutPin(worker: WorkerWithPin): Worker {
  const safe: Partial<WorkerWithPin> = { ...worker };
  delete safe.pinHash;
  return safe as Worker;
}

// Discount usage used to enforce the daily/monthly caps.
export interface WorkerDiscountUsage {
  discountedSalesToday: number;
  discountThisMonth: number;
}

export interface WorkerPurchase {
  saleId: string;
  clientCreatedAt: Date;
  cashierName: string | null;
  subtotal: number;
  discountTotal: number;
  total: number;
  pointsEarned: number;
  auditFlags: string[];
}
