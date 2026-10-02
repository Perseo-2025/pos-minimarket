import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allowedResolutions,
  checkTransfer,
  receiptDiscrepancy,
  receiptLineUnitCost,
  receiptLineUnits,
  weightedAverageCost,
} from "./receiving";

describe("receipt lines", () => {
  const twoBoxes = { quantity: 2, unitsPerPresentation: 24, lineTotal: 96, isBonus: false };

  it("2 Cajas of 24 are 48 units at S/ 2.00 each", () => {
    assert.equal(receiptLineUnits(twoBoxes), 48);
    assert.equal(receiptLineUnitCost(twoBoxes), 2);
  });

  it("keeps 4 decimals: a Caja of 144 candies for S/ 12 costs 0.0833 each", () => {
    assert.equal(
      receiptLineUnitCost({ quantity: 1, unitsPerPresentation: 144, lineTotal: 12, isBonus: false }),
      0.0833,
    );
  });

  it("a bonus line costs 0", () => {
    assert.equal(receiptLineUnitCost({ ...twoBoxes, isBonus: true }), 0);
  });

  it("rejects a quantity of 0", () => {
    assert.throws(() => receiptLineUnits({ ...twoBoxes, quantity: 0 }), /mayor a 0/);
  });
});

describe("weightedAverageCost", () => {
  it("averages old stock and the new receipt", () => {
    // 10 units at 2.10 on hand + 48 bought for 96.00 (2.00 each).
    assert.equal(
      weightedAverageCost({ currentUnits: 10, currentCost: 2.1, inUnits: 48, inTotal: 96 }),
      2.0172,
    );
  });

  it("bonus units lower the average", () => {
    // 48 paid 96.00 + 6 free = 54 units for 96.00.
    assert.equal(
      weightedAverageCost({ currentUnits: 0, currentCost: null, inUnits: 54, inTotal: 96 }),
      1.7778,
    );
  });

  it("without stock on hand, the receipt's cost wins", () => {
    assert.equal(
      weightedAverageCost({ currentUnits: -3, currentCost: 2.5, inUnits: 10, inTotal: 20 }),
      2,
    );
  });
});

describe("checkTransfer", () => {
  it("allows moving what is in the warehouse", () => {
    assert.doesNotThrow(() => checkTransfer(54, 24));
  });

  it("refuses more than available", () => {
    assert.throws(() => checkTransfer(10, 24), /Solo hay 10 unidades/);
  });
});

describe("receiptDiscrepancy", () => {
  it("the invoice says 48 and 47 arrived: 1 missing", () => {
    assert.equal(receiptDiscrepancy(48, 47), -1);
  });

  it("no difference when everything arrived", () => {
    assert.equal(receiptDiscrepancy(48, 48), 0);
  });

  it("extra units are positive", () => {
    assert.equal(receiptDiscrepancy(48, 50), 2);
  });

  it("missing and extra units are resolved differently", () => {
    assert.deepEqual(allowedResolutions(-1), ["replenished", "credited", "written_off"]);
    assert.deepEqual(allowedResolutions(2), ["kept", "returned"]);
  });
});
