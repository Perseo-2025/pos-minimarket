import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isValidRuc } from "./ruc";

describe("isValidRuc", () => {
  it("accepts real company RUCs", () => {
    assert.equal(isValidRuc("20100055237"), true); // Alicorp
    assert.equal(isValidRuc("20100113610"), true); // Backus
    assert.equal(isValidRuc("20100190797"), true); // Gloria
  });

  it("rejects a typo in any digit", () => {
    assert.equal(isValidRuc("20100055238"), false);
    assert.equal(isValidRuc("20100065237"), false);
  });

  it("rejects wrong length or prefix", () => {
    assert.equal(isValidRuc("2010005523"), false);
    assert.equal(isValidRuc("30100055237"), false);
    assert.equal(isValidRuc("2010005523A"), false);
  });
});
