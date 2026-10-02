import type { WorkSchedule } from "@/domain/entities/attendance";
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
    // Per-line worker discount / birthday gift (a gift is its own line of
    // one unit). Sales queued by older versions carry discountPercent and
    // isCourtesy instead.
    discountUnitAmount?: number;
    discountAmount?: number;
    isGift?: boolean;
    discountPercent?: number;
    isCourtesy?: boolean;
    captureSource?: CaptureSource;
  }[];
  total: number;
  clientCreatedAt: string;
  // Airport-worker discount (absent for regular customers).
  workerId?: number;
  workerVerification?: WorkerVerification;
  subtotal?: number;
  discountTotal?: number;
  giftTotal?: number;
  policyId?: number;
  status: "pending" | "syncing" | "error";
  errorMessage?: string;
};

// Mirror of the server snapshot (GET /api/sync/workers).
export type CachedWorker = {
  id: number;
  dni: string;
  fullName: string;
  company: string;
  birthDate: string | null;
  status: WorkerStatus;
  pointsBalance: number;
  usage: WorkerDiscountUsage;
};

export type CachedPolicy = {
  id: number;
  maxDiscountedUnitsPerSale: number;
  maxDiscountedSalesPerDay: number;
  pointsPerSol: number;
  birthdayGiftMaxAmount: number;
};

export type WorkerSnapshotRecord = {
  key: "current";
  generatedAt: string;
  policy: CachedPolicy | null;
  workers: CachedWorker[];
};

// "pin_reset" / "pin_failed" may still sit in queues of older versions.
export type WorkerOpType = "register" | "pin_reset" | "pin_failed";

// Worker operations made at the till while offline (or whose send failed),
// replayed by the sync engine.
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

// A staff member's attendance as this device knows it (works offline).
export type LocalAttendance = {
  userId: number;
  // The workday in progress (null before "Marcar entrada" / after "Marcar
  // salida").
  current: { uuid: string; workDate: string; clockInAt: string } | null;
  // Workdays left open before this one: the person is asked when they left.
  forgotten: { uuid: string; workDate: string; clockInAt: string }[];
  // The last workday closed, to tell "your workday is over".
  lastClosed: { workDate: string; clockInAt: string; clockOutAt: string } | null;
  // Forgotten workdays already answered or skipped (not asked again).
  answered: string[];
  schedules: WorkSchedule[];
  // Server time of the last state merged from the server: older snapshots
  // (e.g. a page cached by the service worker) never overwrite newer ones.
  serverTime: string | null;
};

export type AttendanceOpType = "clock_in" | "clock_out" | "correction";

// Attendance marks made without internet (or whose send failed), replayed
// in order. Each one belongs to the person who marked.
export type PendingAttendanceOp = {
  id: string;
  op: AttendanceOpType;
  userId: number;
  data: Record<string, unknown>;
  createdAt: string;
  status: "pending" | "error";
  errorMessage?: string;
};

// The device clock as last seen: if it goes backwards, marks made until the
// clock is checked against the server are flagged as suspicious.
export type DeviceClockRecord = {
  key: "clock";
  lastSeenAt: number;
  movedBack: boolean;
};
