import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeUnitsTotal, toUnits } from "./presentations";

describe("computeUnitsTotal", () => {
  it("nests: 1 Caja = 6 Displays × 24 Unidades = 144", () => {
    const units = computeUnitsTotal([
      { id: 2, parentId: 1, qtyOfParent: 6 }, // Caja of Displays
      { id: 1, parentId: null, qtyOfParent: 24 }, // Display of units
    ]);
    assert.equal(units.get(1), 24);
    assert.equal(units.get(2), 144);
  });

  it("allows several presentations straight from the unit (Pack x6, Caja x24)", () => {
    const units = computeUnitsTotal([
      { id: 1, parentId: null, qtyOfParent: 6 },
      { id: 2, parentId: null, qtyOfParent: 24 },
    ]);
    assert.deepEqual([...units.values()], [6, 24]);
  });

  it("rejects a presentation that contains itself", () => {
    assert.throws(
      () =>
        computeUnitsTotal([
          { id: 1, parentId: 2, qtyOfParent: 6 },
          { id: 2, parentId: 1, qtyOfParent: 4 },
        ]),
      /no puede contenerse a sí misma/,
    );
  });

  it("rejects a parent from another product and a quantity below 2", () => {
    assert.throws(() => computeUnitsTotal([{ id: 1, parentId: 9, qtyOfParent: 6 }]), /no existe/);
    assert.throws(() => computeUnitsTotal([{ id: 1, parentId: null, qtyOfParent: 1 }]), /al menos 2/);
  });
});

describe("toUnits", () => {
  it("3 Cajas of 144 are 432 units", () => {
    assert.equal(toUnits(3, 144), 432);
  });
});
