import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateSaleFlags, type SaleAuditContext } from "./sale-audit";

const PRODUCT = 1;
const OTHER = 2;

type Line = SaleAuditContext["lines"][number];
const line = (overrides: Partial<Line> = {}): Line => ({
  productId: PRODUCT,
  unitPrice: 10,
  lineTotal: 10,
  discountAmount: 1,
  isCourtesy: false,
  ...overrides,
});

function context(overrides: Partial<SaleAuditContext> = {}): SaleAuditContext {
  return {
    lines: [line()],
    catalog: new Map([[PRODUCT, { price: 10, workerDiscountPercent: 10 }]]),
    chargedDiscount: 1,
    courtesyTotal: 0,
    courtesyApproved: false,
    worker: { status: "active" },
    verification: "pin_online",
    tokenValid: true,
    policy: { maxDiscountedSalesPerDay: 2, maxDiscountPerMonth: 150 },
    usage: { discountedSalesToday: 0, discountThisMonth: 0 },
    ...overrides,
  };
}

describe("evaluateSaleFlags", () => {
  it("has no flags for a clean, online-verified worker sale", () => {
    assert.deepEqual(evaluateSaleFlags(context()), []);
  });

  it("has no flags for a regular customer at catalog price", () => {
    assert.deepEqual(
      evaluateSaleFlags(
        context({
          lines: [line({ discountAmount: 0 })],
          worker: null,
          chargedDiscount: 0,
          verification: "none",
        }),
      ),
      [],
    );
  });

  it("flags a price different from the catalog", () => {
    const flags = evaluateSaleFlags(
      context({ lines: [line({ unitPrice: 8, discountAmount: 0 })], chargedDiscount: 0 }),
    );
    assert.ok(flags.includes("PRICE_MISMATCH"));
  });

  it("flags an unknown product as a price mismatch", () => {
    const flags = evaluateSaleFlags(context({ catalog: new Map() }));
    assert.ok(flags.includes("PRICE_MISMATCH"));
  });

  it("flags a discount given without a worker", () => {
    const flags = evaluateSaleFlags(context({ worker: null, verification: "none" }));
    assert.deepEqual(flags, ["DISCOUNT_MISMATCH"]);
  });

  it("flags a line discounted above its product's percentage", () => {
    const flags = evaluateSaleFlags(
      context({ lines: [line({ discountAmount: 3 })], chargedDiscount: 3 }),
    );
    assert.ok(flags.includes("DISCOUNT_MISMATCH"));
  });

  it("checks each line against its own product, not the sale total", () => {
    // 10% on a product that allows 10%, plus 1.00 on one that allows 0%:
    // the total (2.00) is below 10% of 20, but the second line is not allowed.
    const flags = evaluateSaleFlags(
      context({
        lines: [line(), line({ productId: OTHER, discountAmount: 1 })],
        catalog: new Map([
          [PRODUCT, { price: 10, workerDiscountPercent: 10 }],
          [OTHER, { price: 10, workerDiscountPercent: 0 }],
        ]),
        chargedDiscount: 2,
      }),
    );
    assert.ok(flags.includes("DISCOUNT_MISMATCH"));
  });

  it("flags any worker discount when no policy is configured", () => {
    const flags = evaluateSaleFlags(context({ policy: null }));
    assert.ok(flags.includes("DISCOUNT_MISMATCH"));
  });

  it("accepts an approved courtesy", () => {
    const flags = evaluateSaleFlags(
      context({
        lines: [line({ discountAmount: 0, isCourtesy: true })],
        chargedDiscount: 0,
        courtesyTotal: 10,
        courtesyApproved: true,
        worker: null,
        verification: "none",
      }),
    );
    assert.deepEqual(flags, []);
  });

  it("flags a courtesy without a valid admin approval", () => {
    const flags = evaluateSaleFlags(
      context({
        lines: [line({ discountAmount: 0, isCourtesy: true })],
        chargedDiscount: 0,
        courtesyTotal: 10,
        worker: null,
        verification: "none",
      }),
    );
    assert.deepEqual(flags, ["COURTESY_NOT_APPROVED"]);
  });

  it("flags a worker that is not active", () => {
    const flags = evaluateSaleFlags(context({ worker: { status: "suspended" } }));
    assert.ok(flags.includes("WORKER_NOT_ACTIVE"));
  });

  it("marks offline verification as informative", () => {
    const flags = evaluateSaleFlags(context({ verification: "pin_offline", tokenValid: false }));
    assert.deepEqual(flags, ["OFFLINE_VERIFIED"]);
  });

  it("flags an online verification whose token is invalid", () => {
    const flags = evaluateSaleFlags(context({ tokenValid: false }));
    assert.ok(flags.includes("INVALID_VERIFICATION"));
  });

  it("flags a worker sale with no PIN verification at all", () => {
    const flags = evaluateSaleFlags(context({ verification: "none", tokenValid: false }));
    assert.ok(flags.includes("INVALID_VERIFICATION"));
  });

  it("flags the daily and monthly caps", () => {
    const flags = evaluateSaleFlags(
      context({ usage: { discountedSalesToday: 2, discountThisMonth: 149.5 } }),
    );
    assert.ok(flags.includes("DAILY_LIMIT_EXCEEDED"));
    assert.ok(flags.includes("MONTHLY_LIMIT_EXCEEDED"));
  });

  it("does not apply caps to worker sales without discount", () => {
    const flags = evaluateSaleFlags(
      context({
        lines: [line({ discountAmount: 0 })],
        chargedDiscount: 0,
        usage: { discountedSalesToday: 5, discountThisMonth: 500 },
      }),
    );
    assert.deepEqual(flags, []);
  });
});
