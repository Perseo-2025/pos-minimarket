import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ageOn, birthdayGiftAvailable, isBirthdayAt, isBirthdayOn } from "./birthday";

describe("isBirthdayOn", () => {
  it("matches month and day, whatever the year", () => {
    assert.equal(isBirthdayOn("1990-10-02", "2026-10-02"), true);
    assert.equal(isBirthdayOn("1990-10-02", "2026-10-03"), false);
  });

  it("celebrates 29/02 on 28/02 in non-leap years", () => {
    assert.equal(isBirthdayOn("2000-02-29", "2027-02-28"), true);
    assert.equal(isBirthdayOn("2000-02-29", "2028-02-28"), false);
    assert.equal(isBirthdayOn("2000-02-29", "2028-02-29"), true);
  });
});

describe("isBirthdayAt", () => {
  it("uses the store's day (Lima), not UTC", () => {
    // 02/10 at 22:00 in Lima is already 03/10 in UTC.
    const lateNight = new Date("2026-10-03T03:00:00Z");
    assert.equal(isBirthdayAt("1990-10-02", lateNight), true);
    assert.equal(isBirthdayAt("1990-10-03", lateNight), false);
  });

  it("is never a birthday without a birth date", () => {
    assert.equal(isBirthdayAt(null, new Date()), false);
  });
});

describe("birthdayGiftAvailable", () => {
  const at = new Date("2026-10-02T15:00:00Z");

  it("is available on the birthday once a year", () => {
    const base = { birthDate: "1990-10-02", giftUsedThisYear: false, giftMaxAmount: 10, at };
    assert.equal(birthdayGiftAvailable(base), true);
    assert.equal(birthdayGiftAvailable({ ...base, giftUsedThisYear: true }), false);
    assert.equal(birthdayGiftAvailable({ ...base, giftMaxAmount: 0 }), false);
    assert.equal(birthdayGiftAvailable({ ...base, birthDate: "1990-10-01" }), false);
  });
});

describe("ageOn", () => {
  it("counts whole years", () => {
    assert.equal(ageOn("1990-10-02", "2026-10-01"), 35);
    assert.equal(ageOn("1990-10-02", "2026-10-02"), 36);
  });
});
