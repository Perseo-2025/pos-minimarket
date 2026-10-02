import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { productMargin, profitWithWorkerDiscount } from "./product-margin";

describe("productMargin", () => {
  it("bought at 4, sold at 6: earns 2 (50% over cost, 33% of the price)", () => {
    assert.deepEqual(productMargin(6, 4), {
      profit: 2,
      markupPercent: 50,
      marginPercent: 33,
    });
  });

  it("is negative when sold below cost", () => {
    assert.equal(productMargin(3.5, 4)?.profit, -0.5);
  });

  it("is unknown without a purchase price", () => {
    assert.equal(productMargin(6, null), null);
  });
});

describe("profitWithWorkerDiscount", () => {
  it("a 10% worker discount on a 6.00 item bought at 4 leaves 1.40", () => {
    assert.equal(profitWithWorkerDiscount(6, 4, 10), 1.4);
  });

  it("a 50% discount sells it at a loss", () => {
    assert.equal(profitWithWorkerDiscount(6, 4, 50), -1);
  });
});
