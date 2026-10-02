import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  consumeFefo,
  expiryInfo,
  normalizeCountedLots,
  tracksExpiry,
} from "./expiry";

describe("expiryInfo", () => {
  const today = "2026-10-01";

  it("is still sellable on its expiry day", () => {
    assert.deepEqual(expiryInfo("2026-10-01", today, 30), { status: "soon", daysLeft: 0 });
  });

  it("is expired the day after", () => {
    assert.deepEqual(expiryInfo("2026-09-30", today, 30), { status: "expired", daysLeft: -1 });
  });

  it("warns inside the category window only", () => {
    assert.equal(expiryInfo("2026-10-31", today, 30).status, "soon");
    assert.equal(expiryInfo("2026-11-01", today, 30).status, "ok");
    assert.equal(expiryInfo("2026-10-10", today, 7).status, "ok");
  });
});

describe("tracksExpiry", () => {
  it("follows the category unless the product says otherwise", () => {
    assert.equal(tracksExpiry(null, true), true);
    assert.equal(tracksExpiry(false, true), false);
    assert.equal(tracksExpiry(true, false), true);
  });
});

describe("consumeFefo", () => {
  const lots = [
    { id: 2, expiresAt: "2026-12-20", quantity: 36 },
    { id: 1, expiresAt: "2026-10-05", quantity: 12 },
  ];

  it("sells from the lot that expires first", () => {
    assert.deepEqual(consumeFefo(lots, 3), {
      taken: [{ id: 1, expiresAt: "2026-10-05", quantity: 3 }],
      fromUndated: 0,
    });
  });

  it("moves on to the next lot when the first runs out", () => {
    assert.deepEqual(consumeFefo(lots, 15).taken, [
      { id: 1, expiresAt: "2026-10-05", quantity: 12 },
      { id: 2, expiresAt: "2026-12-20", quantity: 3 },
    ]);
  });

  it("takes the rest from undated stock", () => {
    assert.equal(consumeFefo(lots, 50).fromUndated, 2);
  });
});

describe("normalizeCountedLots", () => {
  it("merges lines with the same date", () => {
    assert.deepEqual(
      normalizeCountedLots(10, [
        { expiresAt: "2026-12-20", quantity: 4 },
        { expiresAt: "2026-10-05", quantity: 2 },
        { expiresAt: "2026-12-20", quantity: 4 },
      ]),
      [
        { expiresAt: "2026-10-05", quantity: 2 },
        { expiresAt: "2026-12-20", quantity: 8 },
      ],
    );
  });

  it("rejects lots that don't add up to the count", () => {
    assert.throws(
      () => normalizeCountedLots(10, [{ expiresAt: "2026-12-20", quantity: 8 }]),
      /suman 8 unidades, pero contaste 10/,
    );
  });
});
