import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { can, homePath, ROLE_PERMISSIONS, type UserRole } from "./user";

describe("permissions", () => {
  it("the admin can do everything", () => {
    assert.equal(can("admin", "manage"), true);
    assert.equal(can("admin", "sell"), true);
    assert.equal(can("admin", "stock"), true);
  });

  it("the cashier only sells", () => {
    assert.deepEqual(ROLE_PERMISSIONS.cashier, ["sell"]);
    assert.equal(can("cashier", "stock"), false);
  });

  it("the warehouse keeper only moves stock", () => {
    assert.deepEqual(ROLE_PERMISSIONS.warehouse, ["stock"]);
    assert.equal(can("warehouse", "sell"), false);
    assert.equal(can("warehouse", "manage"), false);
  });

  it("an unknown role can do nothing", () => {
    assert.equal(can("hacker" as UserRole, "sell"), false);
  });

  it("each role lands on its own screen", () => {
    assert.equal(homePath("admin"), "/admin");
    assert.equal(homePath("cashier"), "/pos");
    assert.equal(homePath("warehouse"), "/almacen");
  });
});
