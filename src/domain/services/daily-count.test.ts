import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countOutcome, suggestDailyCount, type CountCandidate } from "./daily-count";

const today = "2026-10-01";
const base: CountCandidate = {
  productId: 1,
  balance: 10,
  lastCountedOn: "2026-09-30",
  unitsOutLastWeek: 0,
  hasExpiring: false,
  recentlyReceived: false,
};

describe("suggestDailyCount", () => {
  it("puts negative stock first, then never counted, then the rest", () => {
    const result = suggestDailyCount(
      [
        { ...base, productId: 1, lastCountedOn: "2026-09-20" },
        { ...base, productId: 2, balance: -3 },
        { ...base, productId: 3, lastCountedOn: null },
      ],
      today,
    );
    assert.deepEqual(result.map((r) => r.productId), [2, 3, 1]);
    assert.deepEqual(result[0].reasons, ["negative"]);
  });

  it("skips what was already counted today", () => {
    const result = suggestDailyCount([{ ...base, lastCountedOn: today, unitsOutLastWeek: 40 }], today);
    assert.equal(result.length, 0);
  });

  it("explains fast movers and expiring lots", () => {
    const [s] = suggestDailyCount([{ ...base, unitsOutLastWeek: 30, hasExpiring: true }], today);
    assert.deepEqual(s.reasons, ["expiring", "fast_moving"]);
  });

  it("returns at most `limit` products", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ ...base, productId: i + 1, lastCountedOn: null }));
    assert.equal(suggestDailyCount(many, today, 10).length, 10);
  });
});

describe("countOutcome", () => {
  it("a matching count closes; a different one waits for the admin", () => {
    assert.equal(countOutcome(24, 24), "matched");
    assert.equal(countOutcome(24, 22), "pending");
  });
});
