import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { hashPin, isValidPinHash, verifyPin } from "./pin-hash";
import { issueWorkerToken, verifyWorkerToken } from "./worker-token";

describe("pin-hash", () => {
  it("verifies the right PIN and rejects a wrong one", async () => {
    const stored = await hashPin("482915");
    assert.equal(await verifyPin("482915", stored), true);
    assert.equal(await verifyPin("482916", stored), false);
  });

  it("salts every hash", async () => {
    assert.notEqual(await hashPin("123456"), await hashPin("123456"));
  });

  it("accepts only well-formed hashes with enough iterations", async () => {
    assert.equal(isValidPinHash(await hashPin("123456")), true);
    assert.equal(isValidPinHash("123456"), false);
    const weak = (await hashPin("123456")).replace("$150000$", "$1000$");
    assert.equal(isValidPinHash(weak), false);
  });
});

describe("worker-token", () => {
  before(() => {
    process.env.AUTH_SECRET ??= "test-secret";
  });

  const expected = { workerId: 1, cashierId: 10, at: new Date() };

  it("accepts a token for the same worker and cashier", () => {
    assert.equal(verifyWorkerToken(issueWorkerToken(1, 10), expected), true);
  });

  it("rejects a token issued to another cashier or worker", () => {
    assert.equal(verifyWorkerToken(issueWorkerToken(1, 11), expected), false);
    assert.equal(verifyWorkerToken(issueWorkerToken(2, 10), expected), false);
  });

  it("rejects a tampered or missing token", () => {
    const token = issueWorkerToken(1, 10);
    assert.equal(verifyWorkerToken(`${token}x`, expected), false);
    assert.equal(verifyWorkerToken(undefined, expected), false);
  });

  it("rejects a sale made after the token expired", () => {
    const token = issueWorkerToken(1, 10);
    const later = new Date(Date.now() + 16 * 60 * 1000);
    assert.equal(verifyWorkerToken(token, { ...expected, at: later }), false);
  });
});

describe("courtesy-token", async () => {
  const { issueCourtesyToken, verifyCourtesyToken } = await import("./courtesy-token");
  before(() => {
    process.env.AUTH_SECRET ??= "test-secret";
  });

  const SALE = "11111111-1111-4111-8111-111111111111";
  const approval = { saleUuid: SALE, cashierId: 10, adminId: 100, amount: 7 };
  const expected = { saleUuid: SALE, cashierId: 10, amount: 7, at: new Date() };

  it("returns the approving admin for the exact sale, cashier and amount", () => {
    assert.equal(verifyCourtesyToken(issueCourtesyToken(approval), expected), 100);
  });

  it("rejects another sale, another cashier or a different amount", () => {
    const token = issueCourtesyToken(approval);
    assert.equal(verifyCourtesyToken(token, { ...expected, saleUuid: "22222222-2222-4222-8222-222222222222" }), null);
    assert.equal(verifyCourtesyToken(token, { ...expected, cashierId: 11 }), null);
    assert.equal(verifyCourtesyToken(token, { ...expected, amount: 7.01 }), null);
  });

  it("rejects a tampered or expired token", () => {
    const token = issueCourtesyToken(approval);
    assert.equal(verifyCourtesyToken(`${token}x`, expected), null);
    const late = { ...expected, at: new Date(Date.now() + 16 * 60 * 1000) };
    assert.equal(verifyCourtesyToken(token, late), null);
  });

  it("is not interchangeable with a worker token", () => {
    const workerToken = issueWorkerToken(1, 10);
    assert.equal(verifyCourtesyToken(workerToken, expected), null);
  });
});
