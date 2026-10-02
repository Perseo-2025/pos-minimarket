import { round2 } from "../value-objects/money";

// A cashier's shift at the till: from "Abrir caja" (starting cash) to
// "Cerrar caja" (what was counted). The cashier never sees what the system
// expects; the admin compares both.

export interface ShiftTotals {
  openingCash: number;
  // Completed sales of the shift, by payment method.
  cashSales: number;
  yapeSales: number;
  cardSales: number;
  // Money put into / taken out of the drawer during the shift.
  cashIn: number;
  cashOut: number;
}

export interface ShiftAmounts {
  cash: number;
  yape: number;
  card: number;
}

export function expectedAmounts(totals: ShiftTotals): ShiftAmounts {
  return {
    cash: round2(
      totals.openingCash + totals.cashSales + totals.cashIn - totals.cashOut,
    ),
    yape: round2(totals.yapeSales),
    card: round2(totals.cardSales),
  };
}

// counted − expected per method: negative = money missing, positive = extra.
export function shiftDifferences(
  counted: ShiftAmounts,
  expected: ShiftAmounts,
): ShiftAmounts {
  return {
    cash: round2(counted.cash - expected.cash),
    yape: round2(counted.yape - expected.yape),
    card: round2(counted.card - expected.card),
  };
}

// Sales the device made in the shift that haven't reached the server yet
// (sold without internet). Until it's 0 the expected amounts are incomplete.
export function salesStillSyncing(reportedSales: number | null, syncedSales: number) {
  if (reportedSales === null) return 0;
  return Math.max(0, reportedSales - syncedSales);
}
