import { round2 } from "../value-objects/money";

export interface PricedLine {
  unitPrice: number;
  quantity: number;
  // Discount an identified airport worker gets on this product (0–99).
  workerDiscountPercent?: number;
  // Given away for free, approved by an admin at the till.
  isCourtesy?: boolean;
}

export interface WorkerDiscountRule {
  pointsPerSol: number;
  // Remaining discount allowance for the month; the sale's discount never
  // exceeds it. Omit to skip the cap.
  maxDiscount?: number;
  // False when the worker already used today's discounted purchases: the
  // sale still earns points, but charges full price.
  discountAllowed?: boolean;
}

export interface LinePricing {
  gross: number;
  // The product's worker discount when it was applied to this line, else 0.
  discountPercent: number;
  discountAmount: number;
  isCourtesy: boolean;
  // What the customer pays for the line.
  net: number;
}

export interface SalePricing {
  subtotal: number;
  // Worker discount only; courtesies are tracked apart (courtesyTotal).
  discountTotal: number;
  // The single % applied when every discounted line shares it, else 0
  // (mixed rates are shown line by line).
  discountPercent: number;
  courtesyTotal: number;
  total: number;
  pointsEarned: number;
  // True when the monthly allowance cut the discount short.
  capped: boolean;
  lines: LinePricing[];
}

export type DiscountLimitReached = "daily" | "monthly" | null;

// Turns the active policy and the worker's usage into the rule the POS
// prices with. When a cap is reached the worker still earns points; the
// sale simply has no discount (and the POS tells the cashier why).
export function buildWorkerDiscountRule(
  policy: {
    maxDiscountedSalesPerDay: number;
    maxDiscountPerMonth: number;
    pointsPerSol: number;
  },
  usage: { discountedSalesToday: number; discountThisMonth: number },
): { rule: WorkerDiscountRule; limitReached: DiscountLimitReached; remainingThisMonth: number } {
  const remainingThisMonth = round2(
    Math.max(0, policy.maxDiscountPerMonth - usage.discountThisMonth),
  );
  const limitReached: DiscountLimitReached =
    usage.discountedSalesToday >= policy.maxDiscountedSalesPerDay
      ? "daily"
      : remainingThisMonth <= 0
        ? "monthly"
        : null;

  return {
    rule: {
      pointsPerSol: policy.pointsPerSol,
      maxDiscount: remainingThisMonth,
      discountAllowed: limitReached === null,
    },
    limitReached,
    remainingThisMonth,
  };
}

export function lineTotal(line: { unitPrice: number; quantity: number }) {
  return round2(line.unitPrice * line.quantity);
}

// The single % shared by every discounted line, or 0 when rates are mixed.
export function uniformDiscountPercent(
  lines: { discountPercent: number; discountAmount: number }[],
) {
  const rates = new Set(
    lines.filter((l) => l.discountAmount > 0).map((l) => l.discountPercent),
  );
  return rates.size === 1 ? [...rates][0] : 0;
}

// Single source of truth for how a sale is priced. The POS uses it to show the
// cashier the amount to charge, and the server uses it again to verify what
// was charged — both sides must agree to the cent.
//
// Each product carries its own worker %, applied line by line and only when
// a worker is identified (rule !== null). A courtesy line is free no matter
// who buys. The monthly allowance is consumed in cart order.
export function priceSale(
  lines: PricedLine[],
  rule: WorkerDiscountRule | null,
): SalePricing {
  const allowed = rule !== null && (rule.discountAllowed ?? true);
  let remaining = rule?.maxDiscount ?? Number.POSITIVE_INFINITY;
  let capped = false;

  const priced: LinePricing[] = lines.map((line) => {
    const gross = lineTotal(line);
    if (line.isCourtesy) {
      return { gross, discountPercent: 0, discountAmount: 0, isCourtesy: true, net: 0 };
    }

    const percent = allowed ? (line.workerDiscountPercent ?? 0) : 0;
    const wanted = percent > 0 ? round2((gross * percent) / 100) : 0;
    const amount = round2(Math.max(0, Math.min(wanted, remaining)));
    if (amount < wanted) capped = true;
    remaining = round2(remaining - amount);

    return {
      gross,
      discountPercent: amount > 0 ? percent : 0,
      discountAmount: amount,
      isCourtesy: false,
      net: round2(gross - amount),
    };
  });

  const subtotal = round2(priced.reduce((sum, l) => sum + l.gross, 0));
  const discountTotal = round2(priced.reduce((sum, l) => sum + l.discountAmount, 0));
  const courtesyTotal = round2(
    priced.reduce((sum, l) => sum + (l.isCourtesy ? l.gross : 0), 0),
  );
  const total = round2(subtotal - discountTotal - courtesyTotal);

  return {
    subtotal,
    discountTotal,
    discountPercent: uniformDiscountPercent(priced),
    courtesyTotal,
    total,
    pointsEarned: rule ? Math.floor(total * rule.pointsPerSol) : 0,
    capped,
    lines: priced,
  };
}
