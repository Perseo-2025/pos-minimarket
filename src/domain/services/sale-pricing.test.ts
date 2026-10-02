import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildWorkerDiscountRule,
  maxSaleDiscount,
  priceSale,
  saleLines,
  type WorkerDiscountRule,
} from "./sale-pricing";

const policy = {
  maxDiscountedUnitsPerSale: 3,
  maxDiscountedSalesPerDay: 2,
  pointsPerSol: 1,
  birthdayGiftMaxAmount: 10,
};

const worker: WorkerDiscountRule = { pointsPerSol: 1, unitsPerSale: 3 };
const birthday: WorkerDiscountRule = { ...worker, giftAllowed: true, giftMaxAmount: 10 };

describe("priceSale", () => {
  it("charges a regular customer full price, even on discounted products", () => {
    const result = priceSale([{ unitPrice: 5, quantity: 2, workerDiscountAmount: 1 }], null);
    assert.equal(result.subtotal, 10);
    assert.equal(result.discountTotal, 0);
    assert.equal(result.total, 10);
    assert.equal(result.pointsEarned, 0);
  });

  it("takes each product's soles off per unit for a worker", () => {
    // Gaseosa 5.00 −1 = 4.00 · Papas 3.00 −0.50 = 2.50 · Cerveza sin descuento
    const result = priceSale(
      [
        { unitPrice: 5, quantity: 1, workerDiscountAmount: 1 },
        { unitPrice: 3, quantity: 1, workerDiscountAmount: 0.5 },
        { unitPrice: 8, quantity: 1, workerDiscountAmount: 0 },
      ],
      worker,
    );
    assert.equal(result.subtotal, 16);
    assert.equal(result.discountTotal, 1.5);
    assert.equal(result.total, 14.5);
    assert.deepEqual(
      result.lines.map((l) => [l.discountUnitAmount, l.discountAmount, l.net]),
      [
        [1, 1, 4],
        [0.5, 0.5, 2.5],
        [0, 0, 8],
      ],
    );
    assert.equal(result.unitsCapped, false);
  });

  it("discounts only the first 3 units of the purchase", () => {
    // 5 gaseosas: 3 × 4.00 + 2 × 5.00
    const result = priceSale([{ unitPrice: 5, quantity: 5, workerDiscountAmount: 1 }], worker);
    assert.equal(result.lines[0].discountedQuantity, 3);
    assert.equal(result.discountTotal, 3);
    assert.equal(result.total, 22);
    assert.equal(result.unitsCapped, true);
  });

  it("spends the 3 units in basket order across products", () => {
    const result = priceSale(
      [
        { unitPrice: 5, quantity: 2, workerDiscountAmount: 1 },
        { unitPrice: 4, quantity: 2, workerDiscountAmount: 0.5 },
      ],
      worker,
    );
    assert.deepEqual(
      result.lines.map((l) => l.discountedQuantity),
      [2, 1],
    );
    assert.equal(result.discountTotal, 2.5);
  });

  it("does not spend units on products without discount", () => {
    const result = priceSale(
      [
        { unitPrice: 8, quantity: 4, workerDiscountAmount: 0 },
        { unitPrice: 5, quantity: 1, workerDiscountAmount: 1 },
      ],
      worker,
    );
    assert.equal(result.discountTotal, 1);
    assert.equal(result.unitsCapped, false);
  });

  it("never discounts more than the unit price", () => {
    const result = priceSale([{ unitPrice: 2, quantity: 1, workerDiscountAmount: 5 }], worker);
    assert.equal(result.discountTotal, 2);
    assert.equal(result.total, 0);
  });

  it("charges full price but awards points when the discount is not allowed", () => {
    const result = priceSale(
      [{ unitPrice: 5, quantity: 2, workerDiscountAmount: 1 }],
      { ...worker, discountAllowed: false },
    );
    assert.equal(result.discountTotal, 0);
    assert.equal(result.total, 10);
    assert.equal(result.pointsEarned, 10);
  });

  it("awards floor(total × pointsPerSol) points", () => {
    const result = priceSale(
      [{ unitPrice: 5.5, quantity: 1, workerDiscountAmount: 0 }],
      { ...worker, pointsPerSol: 2 },
    );
    assert.equal(result.pointsEarned, 11);
  });

  it("gives one unit free on the worker's birthday", () => {
    const result = priceSale(
      [{ unitPrice: 6, quantity: 1, workerDiscountAmount: 1, isGift: true }],
      birthday,
    );
    assert.equal(result.giftTotal, 6);
    assert.equal(result.discountTotal, 0);
    assert.equal(result.total, 0);
    assert.equal(result.lines[0].isGift, true);
  });

  it("discounts the other units of the gift line", () => {
    // 3 gaseosas: 1 gratis + 2 × 4.00
    const result = priceSale(
      [{ unitPrice: 5, quantity: 3, workerDiscountAmount: 1, isGift: true }],
      birthday,
    );
    assert.equal(result.giftTotal, 5);
    assert.equal(result.lines[0].discountedQuantity, 2);
    assert.equal(result.total, 8);
  });

  it("ignores the gift above the limit, without a birthday or a worker", () => {
    const expensive = [{ unitPrice: 12, quantity: 1, isGift: true }];
    assert.equal(priceSale(expensive, birthday).giftTotal, 0);
    const cheap = [{ unitPrice: 6, quantity: 1, isGift: true }];
    assert.equal(priceSale(cheap, worker).giftTotal, 0);
    assert.equal(priceSale(cheap, null).giftTotal, 0);
  });

  it("gives only one gift per sale", () => {
    const result = priceSale(
      [
        { unitPrice: 4, quantity: 1, isGift: true },
        { unitPrice: 3, quantity: 1, isGift: true },
      ],
      birthday,
    );
    assert.equal(result.giftTotal, 4);
    assert.deepEqual(
      result.lines.map((l) => l.isGift),
      [true, false],
    );
  });
});

describe("saleLines", () => {
  it("splits the gift unit into its own free line", () => {
    const basket = [
      { unitPrice: 5, quantity: 3, workerDiscountAmount: 1, isGift: true },
      { unitPrice: 2, quantity: 1 },
    ];
    const lines = saleLines(basket, priceSale(basket, birthday));
    assert.deepEqual(
      lines.map((l) => [l.index, l.quantity, l.lineTotal, l.discountAmount, l.isGift]),
      [
        [0, 2, 10, 2, false],
        [0, 1, 5, 0, true],
        [1, 1, 2, 0, false],
      ],
    );
  });
});

describe("maxSaleDiscount", () => {
  it("takes the best unit discounts up to the limit, in any order", () => {
    const max = maxSaleDiscount(
      [
        { quantity: 2, isGift: false, unitDiscount: 0.5 },
        { quantity: 2, isGift: false, unitDiscount: 1 },
        { quantity: 1, isGift: true, unitDiscount: 2 },
      ],
      3,
    );
    assert.equal(max, 2.5);
  });
});

describe("buildWorkerDiscountRule", () => {
  it("allows the discount below the daily cap", () => {
    const { rule, limitReached } = buildWorkerDiscountRule(
      policy,
      { discountedSalesToday: 1 },
      false,
    );
    assert.equal(limitReached, null);
    assert.equal(rule.discountAllowed, true);
    assert.equal(rule.unitsPerSale, 3);
    assert.equal(rule.giftAllowed, false);
  });

  it("blocks the discount once the daily cap is reached", () => {
    const { rule, limitReached } = buildWorkerDiscountRule(
      policy,
      { discountedSalesToday: 2 },
      true,
    );
    assert.equal(limitReached, "daily");
    assert.equal(rule.discountAllowed, false);
    // The birthday gift does not depend on the daily cap.
    assert.equal(rule.giftAllowed, true);
  });
});
