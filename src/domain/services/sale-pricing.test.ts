import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildWorkerDiscountRule, priceSale } from "./sale-pricing";

const policy = {
  maxDiscountedSalesPerDay: 2,
  maxDiscountPerMonth: 150,
  pointsPerSol: 1,
};

const worker = { pointsPerSol: 1 };

describe("priceSale", () => {
  it("charges a regular customer full price, even on discounted products", () => {
    const result = priceSale(
      [{ unitPrice: 3.5, quantity: 2, workerDiscountPercent: 10 }],
      null,
    );
    assert.equal(result.subtotal, 7);
    assert.equal(result.discountTotal, 0);
    assert.equal(result.total, 7);
    assert.equal(result.pointsEarned, 0);
  });

  it("applies each product's own percentage for a worker", () => {
    // Inca Kola 3.50 −10% = 0.35 · Papas 3.00 −20% = 0.60 · Cerveza sin descuento
    const result = priceSale(
      [
        { unitPrice: 3.5, quantity: 1, workerDiscountPercent: 10 },
        { unitPrice: 3, quantity: 1, workerDiscountPercent: 20 },
        { unitPrice: 8, quantity: 1, workerDiscountPercent: 0 },
      ],
      worker,
    );
    assert.equal(result.subtotal, 14.5);
    assert.equal(result.discountTotal, 0.95);
    assert.equal(result.total, 13.55);
    assert.deepEqual(
      result.lines.map((l) => [l.discountPercent, l.discountAmount, l.net]),
      [
        [10, 0.35, 3.15],
        [20, 0.6, 2.4],
        [0, 0, 8],
      ],
    );
    // Mixed rates: no single sale-level percentage.
    assert.equal(result.discountPercent, 0);
    assert.equal(result.pointsEarned, 13);
  });

  it("reports the shared percentage when every line uses the same one", () => {
    const result = priceSale(
      [
        { unitPrice: 10, quantity: 1, workerDiscountPercent: 10 },
        { unitPrice: 5, quantity: 1, workerDiscountPercent: 0 },
      ],
      worker,
    );
    assert.equal(result.discountPercent, 10);
  });

  it("rounds each line to cents (half up)", () => {
    // 3 × 3.35 = 10.05 → 10% = 1.005 → 1.01
    const result = priceSale(
      [{ unitPrice: 3.35, quantity: 3, workerDiscountPercent: 10 }],
      worker,
    );
    assert.equal(result.discountTotal, 1.01);
    assert.equal(result.total, 9.04);
  });

  it("caps the discount at the remaining monthly allowance, in cart order", () => {
    const result = priceSale(
      [
        { unitPrice: 50, quantity: 1, workerDiscountPercent: 10 },
        { unitPrice: 30, quantity: 1, workerDiscountPercent: 10 },
      ],
      { ...worker, maxDiscount: 6 },
    );
    assert.deepEqual(
      result.lines.map((l) => l.discountAmount),
      [5, 1],
    );
    assert.equal(result.discountTotal, 6);
    assert.equal(result.capped, true);
  });

  it("still earns points when the discount is not allowed today", () => {
    const result = priceSale(
      [{ unitPrice: 20, quantity: 1, workerDiscountPercent: 10 }],
      { ...worker, discountAllowed: false },
    );
    assert.equal(result.discountTotal, 0);
    assert.equal(result.total, 20);
    assert.equal(result.pointsEarned, 20);
  });

  it("gives a courtesy line away for anyone, without using worker caps", () => {
    const result = priceSale(
      [
        { unitPrice: 3.5, quantity: 2, isCourtesy: true, workerDiscountPercent: 10 },
        { unitPrice: 10, quantity: 1, workerDiscountPercent: 10 },
      ],
      { ...worker, maxDiscount: 1 },
    );
    assert.equal(result.courtesyTotal, 7);
    assert.equal(result.discountTotal, 1);
    assert.equal(result.total, 9);
    assert.equal(result.lines[0].net, 0);
    assert.equal(result.lines[0].discountAmount, 0);
  });

  it("gives courtesies to regular customers too", () => {
    const result = priceSale([{ unitPrice: 4, quantity: 1, isCourtesy: true }], null);
    assert.equal(result.courtesyTotal, 4);
    assert.equal(result.total, 0);
  });
});

describe("buildWorkerDiscountRule", () => {
  it("allows the discount within the caps", () => {
    const { rule, limitReached, remainingThisMonth } = buildWorkerDiscountRule(policy, {
      discountedSalesToday: 1,
      discountThisMonth: 40,
    });
    assert.equal(limitReached, null);
    assert.equal(rule.discountAllowed, true);
    assert.equal(remainingThisMonth, 110);
  });

  it("stops the discount once the daily purchases are used", () => {
    const { rule, limitReached } = buildWorkerDiscountRule(policy, {
      discountedSalesToday: 2,
      discountThisMonth: 0,
    });
    assert.equal(limitReached, "daily");
    assert.equal(rule.discountAllowed, false);
  });

  it("stops the discount once the monthly cap is reached", () => {
    const { limitReached } = buildWorkerDiscountRule(policy, {
      discountedSalesToday: 0,
      discountThisMonth: 150,
    });
    assert.equal(limitReached, "monthly");
  });
});
