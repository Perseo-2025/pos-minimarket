import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ValidationError } from "../errors";
import { aggregateQuantities, planStockCount } from "./stock-count";

describe("planStockCount", () => {
  it("records the first count as opening stock", () => {
    const plan = planStockCount({ current: 0, counted: 24, hasMovements: false });
    assert.deepEqual(plan, { type: "opening", delta: 24 });
  });

  it("allows an opening count of zero (product starts tracked, empty)", () => {
    const plan = planStockCount({ current: 0, counted: 0, hasMovements: false });
    assert.deepEqual(plan, { type: "opening", delta: 0 });
  });

  it("does nothing when a later count matches the system", () => {
    const plan = planStockCount({ current: 21, counted: 21, hasMovements: true });
    assert.equal(plan, null);
  });

  it("records a missing unit as a negative adjustment with its reason", () => {
    // System says 21 Coca-Cola on the shelf, 20 were counted.
    const plan = planStockCount({
      current: 21,
      counted: 20,
      hasMovements: true,
      note: "Faltante en conteo del turno mañana",
    });
    assert.deepEqual(plan, { type: "count_adjustment", delta: -1 });
  });

  it("brings negative stock (sold without stock) back to the counted amount", () => {
    const plan = planStockCount({
      current: -3,
      counted: 5,
      hasMovements: true,
      note: "Traslado no registrado",
    });
    assert.deepEqual(plan, { type: "count_adjustment", delta: 8 });
  });

  it("refuses an adjustment without a reason", () => {
    assert.throws(
      () => planStockCount({ current: 21, counted: 20, hasMovements: true, note: "  " }),
      ValidationError,
    );
  });

  it("refuses negative or fractional counts", () => {
    assert.throws(
      () => planStockCount({ current: 0, counted: -1, hasMovements: false }),
      ValidationError,
    );
    assert.throws(
      () => planStockCount({ current: 0, counted: 1.5, hasMovements: false }),
      ValidationError,
    );
  });
});

describe("aggregateQuantities", () => {
  it("sums the lines of the same product (paid + courtesy)", () => {
    const totals = aggregateQuantities([
      { productId: "coca", quantity: 2 },
      { productId: "papas", quantity: 1 },
      { productId: "coca", quantity: 1 },
    ]);
    assert.deepEqual([...totals], [
      ["coca", 3],
      ["papas", 1],
    ]);
  });
});
