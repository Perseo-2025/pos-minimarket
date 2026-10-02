import { round2 } from "../value-objects/money";

export interface PricedLine {
  unitPrice: number;
  quantity: number;
  // Soles an identified airport worker gets off each unit of this product.
  workerDiscountAmount?: number;
  // One unit of this line is the worker's birthday gift.
  isGift?: boolean;
}

export interface WorkerDiscountRule {
  pointsPerSol: number;
  // Units of the purchase that get their product's discount, taken in
  // basket order.
  unitsPerSale: number;
  // False when the worker already used today's discounted purchases: the
  // sale still earns points, but charges full price.
  discountAllowed?: boolean;
  // True on the worker's birthday while this year's gift is unused.
  giftAllowed?: boolean;
  // Highest price the gift may have.
  giftMaxAmount?: number;
}

export interface LinePricing {
  gross: number;
  // The product's discount per unit when it was applied to this line, else 0.
  discountUnitAmount: number;
  discountedQuantity: number;
  discountAmount: number;
  // True when one unit of the line went as the birthday gift.
  isGift: boolean;
  giftAmount: number;
  // What the customer pays for the line.
  net: number;
}

export interface SalePricing {
  subtotal: number;
  // Worker discount only; the birthday gift is tracked apart (giftTotal).
  discountTotal: number;
  giftTotal: number;
  total: number;
  pointsEarned: number;
  // True when some units had a discount but the per-purchase limit left them
  // at full price.
  unitsCapped: boolean;
  lines: LinePricing[];
}

export type DiscountLimitReached = "daily" | null;

// Turns the active policy and the worker's usage into the rule the POS
// prices with. When the daily cap is reached the worker still earns points;
// the sale simply has no discount (and the POS tells the cashier why).
export function buildWorkerDiscountRule(
  policy: {
    maxDiscountedUnitsPerSale: number;
    maxDiscountedSalesPerDay: number;
    pointsPerSol: number;
    birthdayGiftMaxAmount: number;
  },
  usage: { discountedSalesToday: number },
  giftAvailable: boolean,
): { rule: WorkerDiscountRule; limitReached: DiscountLimitReached } {
  const limitReached: DiscountLimitReached =
    usage.discountedSalesToday >= policy.maxDiscountedSalesPerDay ? "daily" : null;

  return {
    rule: {
      pointsPerSol: policy.pointsPerSol,
      unitsPerSale: policy.maxDiscountedUnitsPerSale,
      discountAllowed: limitReached === null,
      giftAllowed: giftAvailable,
      giftMaxAmount: policy.birthdayGiftMaxAmount,
    },
    limitReached,
  };
}

export function lineTotal(line: { unitPrice: number; quantity: number }) {
  return round2(line.unitPrice * line.quantity);
}

// True when a product may be the birthday gift under this rule.
export function canBeGift(unitPrice: number, rule: WorkerDiscountRule | null) {
  return (
    rule !== null &&
    (rule.giftAllowed ?? false) &&
    unitPrice <= (rule.giftMaxAmount ?? 0)
  );
}

// Single source of truth for how a sale is priced. The POS uses it to show the
// cashier the amount to charge, and the server checks what was charged
// against the same rules.
//
// Each product carries its own discount in soles per unit, applied only when
// a worker is identified (rule !== null) and only to the first
// `unitsPerSale` units of the basket. On the worker's birthday one unit of
// one product (up to giftMaxAmount) is free.
export function priceSale(
  lines: PricedLine[],
  rule: WorkerDiscountRule | null,
): SalePricing {
  const allowed = rule !== null && (rule.discountAllowed ?? true);
  let unitsLeft = rule?.unitsPerSale ?? 0;
  let giftGiven = false;
  let unitsCapped = false;

  const priced: LinePricing[] = lines.map((line) => {
    const gross = lineTotal(line);

    const isGift = !giftGiven && (line.isGift ?? false) && canBeGift(line.unitPrice, rule);
    if (isGift) giftGiven = true;
    const giftAmount = isGift ? round2(line.unitPrice) : 0;

    const perUnit = allowed
      ? round2(Math.min(Math.max(0, line.workerDiscountAmount ?? 0), line.unitPrice))
      : 0;
    const eligible = line.quantity - (isGift ? 1 : 0);
    const discountedQuantity = perUnit > 0 ? Math.min(eligible, unitsLeft) : 0;
    if (perUnit > 0 && discountedQuantity < eligible) unitsCapped = true;
    unitsLeft -= discountedQuantity;
    const discountAmount = round2(perUnit * discountedQuantity);

    return {
      gross,
      discountUnitAmount: discountedQuantity > 0 ? perUnit : 0,
      discountedQuantity,
      discountAmount,
      isGift,
      giftAmount,
      net: round2(gross - discountAmount - giftAmount),
    };
  });

  const subtotal = round2(priced.reduce((sum, l) => sum + l.gross, 0));
  const discountTotal = round2(priced.reduce((sum, l) => sum + l.discountAmount, 0));
  const giftTotal = round2(priced.reduce((sum, l) => sum + l.giftAmount, 0));
  const total = round2(subtotal - discountTotal - giftTotal);

  return {
    subtotal,
    discountTotal,
    giftTotal,
    total,
    pointsEarned: rule ? Math.floor(total * rule.pointsPerSol) : 0,
    unitsCapped,
    lines: priced,
  };
}

// A line as the sale is stored: the gift unit travels as its own line of one
// unit, fully free, so every stored line is either paid or given away whole.
export interface SaleLine {
  // Index of the basket line it comes from.
  index: number;
  quantity: number;
  lineTotal: number;
  discountUnitAmount: number;
  discountAmount: number;
  isGift: boolean;
}

export function saleLines(
  lines: { unitPrice: number; quantity: number }[],
  pricing: SalePricing,
): SaleLine[] {
  return lines.flatMap((line, index) => {
    const p = pricing.lines[index];
    const paidQuantity = line.quantity - (p.isGift ? 1 : 0);
    const result: SaleLine[] = [];
    if (paidQuantity > 0) {
      result.push({
        index,
        quantity: paidQuantity,
        lineTotal: lineTotal({ unitPrice: line.unitPrice, quantity: paidQuantity }),
        discountUnitAmount: p.discountUnitAmount,
        discountAmount: p.discountAmount,
        isGift: false,
      });
    }
    if (p.isGift) {
      result.push({
        index,
        quantity: 1,
        lineTotal: round2(line.unitPrice),
        discountUnitAmount: 0,
        discountAmount: 0,
        isGift: true,
      });
    }
    return result;
  });
}

// Most discount the stored lines could carry: the `unitsPerSale` best unit
// discounts among the paid lines. The server checks the charged discount
// against it, whatever order the basket was in.
export function maxSaleDiscount(
  lines: { quantity: number; isGift: boolean; unitDiscount: number }[],
  unitsPerSale: number,
) {
  const units = lines
    .filter((line) => !line.isGift && line.unitDiscount > 0)
    .flatMap((line) => Array<number>(line.quantity).fill(line.unitDiscount))
    .sort((a, b) => b - a)
    .slice(0, Math.max(0, unitsPerSale));
  return round2(units.reduce((sum, amount) => sum + amount, 0));
}
