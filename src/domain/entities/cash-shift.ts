import type { ShiftAmounts, ShiftTotals } from "../services/cash-shift";

export type { ShiftAmounts, ShiftTotals };

export type CashShiftStatus = "open" | "closed" | "reviewed";

export const CASH_SHIFT_STATUS_LABELS: Record<CashShiftStatus, string> = {
  open: "Abierta",
  closed: "Por revisar",
  reviewed: "Revisada",
};

export type CashMovementType = "in" | "out";

export const CASH_MOVEMENT_LABELS: Record<CashMovementType, string> = {
  in: "Entrada",
  out: "Salida",
};

export interface CashMovement {
  id: number;
  type: CashMovementType;
  amount: number;
  reason: string;
  occurredAt: Date;
  createdByName: string | null;
}

export interface CashShift {
  id: number;
  uuid: string;
  cashierId: number;
  cashierName: string;
  status: CashShiftStatus;
  openedAt: Date;
  closedAt: Date | null;
  // What the cashier counted at "Cerrar caja" (null while open).
  counted: ShiftAmounts | null;
  closeNote: string | null;
  // Sales the device made vs. those already on the server.
  reportedSales: number | null;
  syncedSales: number;
  totals: ShiftTotals;
  // Frozen at review; computed from totals before that.
  expected: ShiftAmounts;
  movements: CashMovement[];
  reviewedByName: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
}
