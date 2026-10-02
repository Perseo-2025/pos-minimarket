import type { AuditFlag } from "../entities/audit";
import type { ProductCatalogEntry } from "../entities/product";
import type { WorkerStatus } from "../entities/worker";
import { round2 } from "../value-objects/money";
import { isBirthdayAt } from "./birthday";
import { maxSaleDiscount } from "./sale-pricing";

const CENT = 0.01;

export interface SaleAuditContext {
  // What the POS actually charged, as stored (a gift is its own line).
  lines: {
    productId: number;
    unitPrice: number;
    quantity: number;
    // Recomputed gross amount (unitPrice × quantity).
    lineTotal: number;
    discountAmount: number;
    isGift: boolean;
  }[];
  // Current catalog entry per product id (missing = unknown product).
  catalog: Map<number, ProductCatalogEntry>;
  // Worker discount charged (sum of the paid lines' discounts).
  chargedDiscount: number;
  giftTotal: number;
  soldAt: Date;
  worker: { status: WorkerStatus; birthDate: string | null } | null;
  policy: {
    maxDiscountedUnitsPerSale: number;
    maxDiscountedSalesPerDay: number;
    birthdayGiftMaxAmount: number;
  } | null;
  // Usage *before* this sale.
  usage: { discountedSalesToday: number; giftUsedThisYear: boolean } | null;
}

// Pure: decides which anomalies a sale has. Never throws — a sale is always
// accepted, only marked, because the customer already paid.
export function evaluateSaleFlags(ctx: SaleAuditContext): AuditFlag[] {
  const flags = new Set<AuditFlag>();

  for (const line of ctx.lines) {
    const catalog = ctx.catalog.get(line.productId);
    if (catalog === undefined || Math.abs(catalog.price - line.unitPrice) >= CENT) {
      flags.add("PRICE_MISMATCH");
      break;
    }
  }

  const discount = ctx.chargedDiscount;
  const gifts = ctx.lines.filter((line) => line.isGift);

  if (!ctx.worker) {
    if (discount > 0) flags.add("DISCOUNT_MISMATCH");
    if (gifts.length > 0) flags.add("GIFT_NOT_BIRTHDAY");
    return [...flags];
  }

  if (ctx.worker.status !== "active") flags.add("WORKER_NOT_ACTIVE");

  if (discount > 0) {
    // Without a policy no worker discount is allowed at all. Otherwise each
    // line may take at most its product's soles per unit (checked per line,
    // so a big discount on one product can't hide behind small ones), and
    // the sale at most its best `maxDiscountedUnitsPerSale` units.
    const unitDiscount = (productId: number) =>
      ctx.catalog.get(productId)?.workerDiscountAmount ?? 0;
    const overLine =
      !ctx.policy ||
      ctx.lines.some((line) => {
        if (line.isGift) return line.discountAmount > 0;
        const max = round2(Math.min(unitDiscount(line.productId), line.unitPrice) * line.quantity);
        return line.discountAmount - max >= CENT;
      });
    if (overLine) {
      flags.add("DISCOUNT_MISMATCH");
    } else if (ctx.policy) {
      const max = maxSaleDiscount(
        ctx.lines.map((line) => ({
          quantity: line.quantity,
          isGift: line.isGift,
          unitDiscount: Math.min(unitDiscount(line.productId), line.unitPrice),
        })),
        ctx.policy.maxDiscountedUnitsPerSale,
      );
      if (discount - max >= CENT) flags.add("UNITS_LIMIT_EXCEEDED");
    }

    if (
      ctx.policy &&
      ctx.usage &&
      ctx.usage.discountedSalesToday >= ctx.policy.maxDiscountedSalesPerDay
    ) {
      flags.add("DAILY_LIMIT_EXCEEDED");
    }
  }

  if (gifts.length > 0) {
    if (!isBirthdayAt(ctx.worker.birthDate, ctx.soldAt)) flags.add("GIFT_NOT_BIRTHDAY");
    if (ctx.usage?.giftUsedThisYear) flags.add("GIFT_ALREADY_USED");
    const maxGift = ctx.policy?.birthdayGiftMaxAmount ?? 0;
    if (
      gifts.length > 1 ||
      gifts[0].quantity !== 1 ||
      gifts[0].unitPrice - maxGift >= CENT
    ) {
      flags.add("GIFT_OVER_LIMIT");
    }
  }

  return [...flags];
}
