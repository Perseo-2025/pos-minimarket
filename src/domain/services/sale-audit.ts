import type { AuditFlag } from "../entities/audit";
import type { ProductCatalogEntry } from "../entities/product";
import type { WorkerStatus, WorkerVerification } from "../entities/worker";
import { round2 } from "../value-objects/money";

const CENT = 0.01;

export interface SaleAuditContext {
  // What the POS actually charged, line by line.
  lines: {
    productId: string;
    unitPrice: number;
    // Recomputed gross amount (unitPrice × quantity).
    lineTotal: number;
    discountAmount: number;
    isCourtesy: boolean;
  }[];
  // Current catalog entry per product id (missing = unknown product).
  catalog: Map<string, ProductCatalogEntry>;
  // Worker discount charged (sum of non-courtesy line discounts).
  chargedDiscount: number;
  courtesyTotal: number;
  // Result of checking the signed admin approval for the courtesy lines.
  courtesyApproved: boolean;
  worker: { status: WorkerStatus } | null;
  verification: WorkerVerification;
  // Result of checking the signed online-verification token, if one came.
  tokenValid: boolean;
  policy: {
    maxDiscountedSalesPerDay: number;
    maxDiscountPerMonth: number;
  } | null;
  // Usage *before* this sale.
  usage: { discountedSalesToday: number; discountThisMonth: number } | null;
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

  // Free products need an admin's approval, whoever the customer is.
  if (ctx.courtesyTotal > 0 && !ctx.courtesyApproved) {
    flags.add("COURTESY_NOT_APPROVED");
  }

  const discount = ctx.chargedDiscount;

  if (!ctx.worker) {
    if (discount > 0) flags.add("DISCOUNT_MISMATCH");
    return [...flags];
  }

  if (ctx.worker.status !== "active") flags.add("WORKER_NOT_ACTIVE");

  if (ctx.verification === "pin_offline") flags.add("OFFLINE_VERIFIED");
  if (
    ctx.verification === "none" ||
    (ctx.verification === "pin_online" && !ctx.tokenValid)
  ) {
    flags.add("INVALID_VERIFICATION");
  }

  if (discount > 0) {
    // Without a policy no worker discount is allowed at all. Otherwise each
    // line may take at most its product's % (checked per line, so a big
    // discount on one product can't hide behind small ones on others).
    const overLimit =
      !ctx.policy ||
      ctx.lines.some((line) => {
        if (line.isCourtesy) return line.discountAmount > 0;
        const percent = ctx.catalog.get(line.productId)?.workerDiscountPercent ?? 0;
        const max = round2((line.lineTotal * percent) / 100);
        return line.discountAmount - max >= CENT;
      });
    if (overLimit) flags.add("DISCOUNT_MISMATCH");

    if (ctx.policy && ctx.usage) {
      if (ctx.usage.discountedSalesToday >= ctx.policy.maxDiscountedSalesPerDay) {
        flags.add("DAILY_LIMIT_EXCEEDED");
      }
      if (
        ctx.usage.discountThisMonth + discount - ctx.policy.maxDiscountPerMonth >=
        CENT
      ) {
        flags.add("MONTHLY_LIMIT_EXCEEDED");
      }
    }
  }

  return [...flags];
}
