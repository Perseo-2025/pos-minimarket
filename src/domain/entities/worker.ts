// An airport worker: a *customer* entitled to the staff discount. Not to be
// confused with the minimarket's own cashiers (User with role "cashier") —
// workers never log into the POS. At the till the cashier types their DNI
// and checks it against the worker's fotocheck (it carries no barcode).
export type WorkerStatus = "pending" | "active" | "suspended" | "rejected";

// Why a worker is waiting for the admin. "pin_reset" only appears on records
// from when workers had a PIN.
export type WorkerPendingReason = "new" | "pin_reset";

// Where the full name came from: the DNI lookup service (trusted) or typed
// by the cashier because the service was unreachable (admin double-checks).
export type WorkerNameSource = "api" | "manual";

// How the worker was identified for a discounted sale. Today it is always
// "dni_manual"; the pin_* values remain on sales from when workers had a PIN.
export type WorkerVerification = "none" | "dni_manual" | "pin_online" | "pin_offline";

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
  dni_manual: "DNI digitado por el cajero",
  pin_online: "Clave verificada en línea",
  pin_offline: "Clave verificada sin conexión",
};

export const DNI_PATTERN = /^\d{8}$/;

export interface Worker {
  id: number;
  // Client-generated at registration (see CreateWorkerData).
  uuid: string;
  dni: string;
  fullName: string;
  nameSource: WorkerNameSource;
  company: string;
  // YYYY-MM-DD. Null for workers registered before it was asked: no birthday
  // gift until the admin fills it in.
  birthDate: string | null;
  status: WorkerStatus;
  pendingReason: WorkerPendingReason | null;
  pointsBalance: number;
  registeredById: number | null;
  registeredByName?: string | null;
  approvedAt: Date | null;
  createdAt: Date;
}

// What the worker already used: discounted purchases today (daily cap) and
// whether the birthday gift was given this year (once a year).
export interface WorkerDiscountUsage {
  discountedSalesToday: number;
  giftUsedThisYear: boolean;
}

export interface WorkerPurchase {
  saleId: number;
  clientCreatedAt: Date;
  cashierName: string | null;
  subtotal: number;
  discountTotal: number;
  giftTotal: number;
  total: number;
  pointsEarned: number;
  auditFlags: string[];
}
