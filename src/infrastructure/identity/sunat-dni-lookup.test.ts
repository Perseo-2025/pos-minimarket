import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSunatName } from "./sunat-dni-lookup";

describe("parseSunatName", () => {
  it("reorders 'APELLIDOS, NOMBRES' into 'NOMBRES APELLIDOS'", () => {
    assert.equal(parseSunatName("PEREZ QUISPE, JUAN CARLOS"), "JUAN CARLOS PEREZ QUISPE");
  });

  it("normalizes spacing and case", () => {
    assert.equal(parseSunatName("  pérez   quispe ,  juan "), "JUAN PÉREZ QUISPE");
  });

  it("keeps the raw value when there is no comma", () => {
    assert.equal(parseSunatName("JUAN PEREZ"), "JUAN PEREZ");
  });

  it("returns null for an empty name", () => {
    assert.equal(parseSunatName(" , "), null);
  });
});
