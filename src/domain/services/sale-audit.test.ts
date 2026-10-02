import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateSaleFlags, type SaleAuditContext } from "./sale-audit";

const PRODUCT = 1;
const OTHER = 2;
// 02/10/2026, 10:00 in Lima.
const SOLD_AT = new Date("2026-10-02T15:00:00Z");

type Line = SaleAuditContext["lines"][number];
const line = (overrides: Partial<Line> = {}): Line => ({
  productId: PRODUCT,
  unitPrice: 5,
  quantity: 1,
  lineTotal: 5,
  discountAmount: 1,
  isGift: false,
  ...overrides,
});

const gift = (overrides: Partial<Line> = {}) =>
  line({ discountAmount: 0, isGift: true, ...overrides });

function context(overrides: Partial<SaleAuditContext> = {}): SaleAuditContext {
  return {
    lines: [line()],
    catalog: new Map([
      [PRODUCT, { price: 5, workerDiscountAmount: 1 }],
      [OTHER, { price: 12, workerDiscountAmount: 0 }],
    ]),
    chargedDiscount: 1,
    giftTotal: 0,
    soldAt: SOLD_AT,
    worker: { status: "active", birthDate: "1990-10-02" },
    policy: {
      maxDiscountedUnitsPerSale: 3,
      maxDiscountedSalesPerDay: 2,
      birthdayGiftMaxAmount: 10,
    },
    usage: { discountedSalesToday: 0, giftUsedThisYear: false },
    ...overrides,
  };
}

describe("evaluateSaleFlags", () => {
  it("has no flags for a clean worker sale", () => {
    assert.deepEqual(evaluateSaleFlags(context()), []);
  });

  it("has no flags for a regular customer at catalog price", () => {
    assert.deepEqual(
      evaluateSaleFlags(
        context({ lines: [line({ discountAmount: 0 })], worker: null, chargedDiscount: 0 }),
      ),
      [],
    );
  });

  it("flags a price different from the catalog", () => {
    const flags = evaluateSaleFlags(
      context({ lines: [line({ unitPrice: 4, discountAmount: 0 })], chargedDiscount: 0 }),
    );
    assert.ok(flags.includes("PRICE_MISMATCH"));
  });

  it("flags an unknown product as a price mismatch", () => {
    const flags = evaluateSaleFlags(
      context({ lines: [line({ productId: 99, discountAmount: 0 })], chargedDiscount: 0 }),
    );
    assert.ok(flags.includes("PRICE_MISMATCH"));
  });

  it("flags a discount without a worker", () => {
    const flags = evaluateSaleFlags(context({ worker: null }));
    assert.ok(flags.includes("DISCOUNT_MISMATCH"));
  });

  it("flags more soles off a unit than the product allows", () => {
    const flags = evaluateSaleFlags(
      context({ lines: [line({ discountAmount: 2 })], chargedDiscount: 2 }),
    );
    assert.ok(flags.includes("DISCOUNT_MISMATCH"));
  });

  it("flags a discount on a product that has none", () => {
    const flags = evaluateSaleFlags(
      context({
        lines: [line({ productId: OTHER, unitPrice: 12, lineTotal: 12, discountAmount: 1 })],
      }),
    );
    assert.ok(flags.includes("DISCOUNT_MISMATCH"));
  });

  it("accepts 3 discounted units out of 5", () => {
    const flags = evaluateSaleFlags(
      context({
        lines: [line({ quantity: 5, lineTotal: 25, discountAmount: 3 })],
        chargedDiscount: 3,
      }),
    );
    assert.deepEqual(flags, []);
  });

  it("flags more discounted units than allowed per purchase", () => {
    const flags = evaluateSaleFlags(
      context({
        lines: [line({ quantity: 5, lineTotal: 25, discountAmount: 5 })],
        chargedDiscount: 5,
      }),
    );
    assert.deepEqual(flags, ["UNITS_LIMIT_EXCEEDED"]);
  });

  it("flags a discount without an active policy", () => {
    const flags = evaluateSaleFlags(context({ policy: null }));
    assert.ok(flags.includes("DISCOUNT_MISMATCH"));
  });

  it("flags an inactive worker", () => {
    const flags = evaluateSaleFlags(
      context({ worker: { status: "suspended", birthDate: null } }),
    );
    assert.ok(flags.includes("WORKER_NOT_ACTIVE"));
  });

  it("flags a discounted purchase over the daily cap", () => {
    const flags = evaluateSaleFlags(
      context({ usage: { discountedSalesToday: 2, giftUsedThisYear: false } }),
    );
    assert.ok(flags.includes("DAILY_LIMIT_EXCEEDED"));
  });

  it("does not apply the daily cap to a sale without discount", () => {
    const flags = evaluateSaleFlags(
      context({
        lines: [line({ discountAmount: 0 })],
        chargedDiscount: 0,
        usage: { discountedSalesToday: 5, giftUsedThisYear: false },
      }),
    );
    assert.deepEqual(flags, []);
  });

  it("accepts the birthday gift on the birthday", () => {
    const flags = evaluateSaleFlags(
      context({ lines: [gift()], chargedDiscount: 0, giftTotal: 5 }),
    );
    assert.deepEqual(flags, []);
  });

  it("flags a gift on another day", () => {
    const flags = evaluateSaleFlags(
      context({
        lines: [gift()],
        chargedDiscount: 0,
        giftTotal: 5,
        worker: { status: "active", birthDate: "1990-05-01" },
      }),
    );
    assert.deepEqual(flags, ["GIFT_NOT_BIRTHDAY"]);
  });

  it("flags a gift without a worker", () => {
    const flags = evaluateSaleFlags(
      context({ lines: [gift()], chargedDiscount: 0, giftTotal: 5, worker: null }),
    );
    assert.deepEqual(flags, ["GIFT_NOT_BIRTHDAY"]);
  });

  it("flags a second gift in the same year", () => {
    const flags = evaluateSaleFlags(
      context({
        lines: [gift()],
        chargedDiscount: 0,
        giftTotal: 5,
        usage: { discountedSalesToday: 0, giftUsedThisYear: true },
      }),
    );
    assert.deepEqual(flags, ["GIFT_ALREADY_USED"]);
  });

  it("flags a gift above the limit or of several units", () => {
    const expensive = evaluateSaleFlags(
      context({
        lines: [gift({ productId: OTHER, unitPrice: 12, lineTotal: 12 })],
        chargedDiscount: 0,
        giftTotal: 12,
      }),
    );
    assert.deepEqual(expensive, ["GIFT_OVER_LIMIT"]);

    const twoUnits = evaluateSaleFlags(
      context({
        lines: [gift({ quantity: 2, lineTotal: 10 })],
        chargedDiscount: 0,
        giftTotal: 10,
      }),
    );
    assert.deepEqual(twoUnits, ["GIFT_OVER_LIMIT"]);
  });

  it("flags a discount on the gift line", () => {
    const flags = evaluateSaleFlags(
      context({ lines: [gift({ discountAmount: 1 })], chargedDiscount: 1, giftTotal: 5 }),
    );
    assert.ok(flags.includes("DISCOUNT_MISMATCH"));
  });
});
