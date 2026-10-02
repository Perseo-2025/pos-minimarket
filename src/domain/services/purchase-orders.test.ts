import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { purchaseOrderStatus, remainingUnits } from "./purchase-orders";

const ordered = new Map([
  [1, 120], // 5 Cajas of Inca Kola
  [2, 48],
]);

describe("purchaseOrderStatus", () => {
  it("is pending until something arrives", () => {
    assert.equal(purchaseOrderStatus(ordered, new Map()), "pending");
  });

  it("is partial when only part arrived", () => {
    assert.equal(purchaseOrderStatus(ordered, new Map([[1, 120]])), "partial");
    assert.equal(purchaseOrderStatus(ordered, new Map([[1, 10], [2, 48]])), "partial");
  });

  it("is received when every product arrived (extra units are fine)", () => {
    assert.equal(purchaseOrderStatus(ordered, new Map([[1, 130], [2, 48]])), "received");
  });
});

describe("remainingUnits", () => {
  it("lists only what is still missing", () => {
    assert.deepEqual(
      [...remainingUnits(ordered, new Map([[1, 100], [2, 60]]))],
      [[1, 20]],
    );
  });
});
