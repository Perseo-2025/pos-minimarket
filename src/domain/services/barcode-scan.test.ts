import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildBarcodeIndex, classifyKeyBurst } from "./barcode-scan";

const burst = (gap: number, length = 13) =>
  Array.from({ length }, (_, i) => 1000 + i * gap);

describe("classifyKeyBurst", () => {
  it("recognizes a Bluetooth reader burst", () => {
    assert.equal(classifyKeyBurst(burst(8)), "scan");
    assert.equal(classifyKeyBurst(burst(30)), "scan");
  });

  it("treats human typing as manual", () => {
    assert.equal(classifyKeyBurst(burst(120)), "manual");
  });

  it("is manual when one key came late (someone finishing a code by hand)", () => {
    const times = burst(8);
    times[times.length - 1] += 400;
    assert.equal(classifyKeyBurst(times), "manual");
  });

  it("needs a few characters to be a code", () => {
    assert.equal(classifyKeyBurst(burst(5, 3)), "manual");
  });
});

describe("buildBarcodeIndex", () => {
  it("resolves units and presentations", () => {
    const index = buildBarcodeIndex({
      units: [{ productId: 1, barcode: "7750182000123" }, { productId: 2, barcode: null }],
      presentations: [{ id: 9, productId: 1, barcode: "17750182000120" }],
    });
    assert.deepEqual(index.get("7750182000123"), { kind: "unit", productId: 1 });
    assert.deepEqual(index.get("17750182000120"), {
      kind: "presentation",
      productId: 1,
      presentationId: 9,
    });
    assert.equal(index.size, 2);
  });
});
