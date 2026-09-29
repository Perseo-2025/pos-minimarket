// Anomalies detected when a sale reaches the server. A flagged sale is still
// accepted — the money was already charged — but it shows up in the audit
// report so the owner can review it.
export type AuditFlag =
  | "PRICE_MISMATCH"
  | "DISCOUNT_MISMATCH"
  | "WORKER_NOT_ACTIVE"
  | "DAILY_LIMIT_EXCEEDED"
  | "MONTHLY_LIMIT_EXCEEDED"
  | "OFFLINE_VERIFIED"
  | "INVALID_VERIFICATION"
  | "COURTESY_NOT_APPROVED";

export const AUDIT_FLAGS: AuditFlag[] = [
  "PRICE_MISMATCH",
  "DISCOUNT_MISMATCH",
  "WORKER_NOT_ACTIVE",
  "DAILY_LIMIT_EXCEEDED",
  "MONTHLY_LIMIT_EXCEEDED",
  "OFFLINE_VERIFIED",
  "INVALID_VERIFICATION",
  "COURTESY_NOT_APPROVED",
];

export const AUDIT_FLAG_LABELS: Record<AuditFlag, string> = {
  PRICE_MISMATCH: "Precio distinto al catálogo",
  DISCOUNT_MISMATCH: "Descuento mayor al permitido",
  WORKER_NOT_ACTIVE: "Trabajador no activo",
  DAILY_LIMIT_EXCEEDED: "Superó el límite diario",
  MONTHLY_LIMIT_EXCEEDED: "Superó el tope mensual",
  OFFLINE_VERIFIED: "Clave validada sin internet",
  INVALID_VERIFICATION: "Verificación inválida",
  COURTESY_NOT_APPROVED: "Cortesía sin aprobación",
};

// Plain-language explanation shown to the admin next to each flag.
export const AUDIT_FLAG_HELP: Record<AuditFlag, string> = {
  PRICE_MISMATCH:
    "Algún producto se cobró a un precio diferente al registrado en el catálogo.",
  DISCOUNT_MISMATCH:
    "Algún producto tuvo más descuento que el porcentaje configurado para él, o se aplicó descuento sin trabajador.",
  WORKER_NOT_ACTIVE:
    "Se usó un trabajador pendiente, suspendido o rechazado. No sumó puntos.",
  DAILY_LIMIT_EXCEEDED:
    "El trabajador ya había usado todas sus compras con descuento del día.",
  MONTHLY_LIMIT_EXCEEDED:
    "El trabajador superó el monto máximo de descuento del mes.",
  OFFLINE_VERIFIED:
    "La clave se validó en la tablet sin internet. Es válida, pero con menor nivel de confianza.",
  INVALID_VERIFICATION:
    "La venta dice tener clave validada, pero la prueba no es válida. No sumó puntos.",
  COURTESY_NOT_APPROVED:
    "Se regalaron productos sin una aprobación válida del administrador.",
};

// Flags that are informative only (not suspicious by themselves).
export const INFO_AUDIT_FLAGS: AuditFlag[] = ["OFFLINE_VERIFIED"];

// Flags that disqualify the sale from earning loyalty points.
export const BLOCKING_AUDIT_FLAGS: AuditFlag[] = [
  "WORKER_NOT_ACTIVE",
  "INVALID_VERIFICATION",
];

export type AuditEventType =
  | "worker_pin_failed"
  | "worker_registered"
  | "worker_pin_reset_requested"
  | "worker_approved"
  | "worker_rejected"
  | "worker_suspended"
  | "worker_reactivated"
  | "worker_name_updated"
  | "policy_changed"
  | "courtesy_approved"
  | "courtesy_denied";

export const AUDIT_EVENT_LABELS: Record<AuditEventType, string> = {
  worker_pin_failed: "Clave incorrecta",
  worker_registered: "Trabajador registrado",
  worker_pin_reset_requested: "Cambio de clave solicitado",
  worker_approved: "Trabajador aprobado",
  worker_rejected: "Trabajador rechazado",
  worker_suspended: "Trabajador suspendido",
  worker_reactivated: "Trabajador reactivado",
  worker_name_updated: "Nombre corregido con RENIEC",
  policy_changed: "Descuento modificado",
  courtesy_approved: "Cortesía aprobada",
  courtesy_denied: "Cortesía rechazada (clave incorrecta)",
};

export interface AuditEventInput {
  type: AuditEventType;
  actorId: string | null;
  workerId?: string | null;
  saleId?: string | null;
  payload?: Record<string, unknown>;
  occurredAt: Date;
}

export interface AuditEvent extends Required<Omit<AuditEventInput, "payload">> {
  id: string;
  actorName: string | null;
  workerName: string | null;
  workerDni: string | null;
  payload: Record<string, unknown>;
  createdAt: Date;
}

// Per-cashier aggregates for the anti-fraud report.
export interface CashierAuditSummary {
  cashierId: string;
  cashierName: string;
  sales: number;
  discountedSales: number;
  discountTotal: number;
  offlineDiscountedSales: number;
  flaggedSales: number;
  pinFailures: number;
  pinResets: number;
}

export interface FlaggedSale {
  saleId: string;
  clientCreatedAt: Date;
  cashierName: string;
  workerName: string | null;
  workerDni: string | null;
  subtotal: number;
  discountTotal: number;
  total: number;
  auditFlags: AuditFlag[];
}
