import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { expectedAmounts, salesStillSyncing, shiftDifferences } from "./cash-shift";

describe("expectedAmounts", () => {
  it("cash = starting cash + cash sales + money in − money out", () => {
    assert.deepEqual(
      expectedAmounts({
        openingCash: 100,
        cashSales: 320.5,
        yapeSales: 88,
        cardSales: 35,
        cashIn: 50,
        cashOut: 96,
      }),
      { cash: 374.5, yape: 88, card: 35 },
    );
  });
});

describe("shiftDifferences", () => {
  it("negative when money is missing, positive when there is extra", () => {
    assert.deepEqual(
      shiftDifferences({ cash: 112, yape: 15, card: 12 }, { cash: 115, yape: 15, card: 10 }),
      { cash: -3, yape: 0, card: 2 },
    );
  });

  it("does not leave floating point noise", () => {
    assert.equal(shiftDifferences({ cash: 0.3, yape: 0, card: 0 }, { cash: 0.1, yape: 0, card: 0 }).cash, 0.2);
  });
});

describe("salesStillSyncing", () => {
  it("counts sales the device made that haven't arrived yet", () => {
    assert.equal(salesStillSyncing(12, 9), 3);
    assert.equal(salesStillSyncing(12, 12), 0);
    assert.equal(salesStillSyncing(null, 5), 0);
  });
});
