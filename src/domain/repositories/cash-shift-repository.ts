import type {
  CashMovementType,
  CashShift,
  CashShiftStatus,
  ShiftAmounts,
} from "../entities/cash-shift";

// Everything is keyed by the device's uuid: operations made without internet
// may be sent more than once and must not duplicate.
export interface CashShiftRepository {
  open(data: {
    uuid: string;
    cashierId: number;
    openedAt: Date;
    openingCash: number;
  }): Promise<void>;
  addMovement(data: {
    uuid: string;
    shiftUuid: string;
    type: CashMovementType;
    amount: number;
    reason: string;
    occurredAt: Date;
    actorId: number;
  }): Promise<void>;
  close(data: {
    uuid: string;
    closedAt: Date;
    counted: ShiftAmounts;
    note: string | null;
    reportedSales: number;
  }): Promise<void>;
  findOwner(uuid: string): Promise<{ cashierId: number; status: CashShiftStatus } | null>;
  // Shifts opened in the range, newest first, with their live totals.
  list(from: Date, to: Date): Promise<CashShift[]>;
  findById(id: number): Promise<CashShift | null>;
  countByStatus(): Promise<{ closed: number; openLong: number }>;
  review(data: {
    id: number;
    expected: ShiftAmounts;
    note: string | null;
    actorId: number;
  }): Promise<void>;
}
