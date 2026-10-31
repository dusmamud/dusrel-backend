import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AddressError, RESERVED_LOCAL_PARTS, validateAliasAddress } from "../src/index.js";

const PRIMARY = "arav@dusrel.example";

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof AddressError, "AddressError hi throw honi chahiye");
    return (e as AddressError).code;
  }
  assert.fail("Error throw honi chahiye thi");
}

describe("address", () => {
  it("reserved list verbatim 13 entries hai", () => {
    assert.equal(RESERVED_LOCAL_PARTS.size, 13);
    assert.deepEqual(
      [...RESERVED_LOCAL_PARTS].sort(),
      [
        "abuse",
        "account",
        "admin",
        "help",
        "hostmaster",
        "info",
        "mail",
        "no-reply",
        "noreply",
        "postmaster",
        "security",
        "support",
        "webmaster",
      ].sort(),
    );
  });

  it("valid alias lowercase return karta hai", () => {
    assert.equal(
      validateAliasAddress("Shop.News_1@Dusrel.Example", PRIMARY),
      "shop.news_1@dusrel.example",
    );
    assert.equal(validateAliasAddress("abc@dusrel.example", PRIMARY), "abc@dusrel.example");
    assert.equal(
      validateAliasAddress(`${"a".repeat(64)}@dusrel.example`, PRIMARY),
      `${"a".repeat(64)}@dusrel.example`,
    );
  });

  it("single address nahi to invalid_email", () => {
    assert.equal(codeOf(() => validateAliasAddress("no-at-sign", PRIMARY)), "invalid_email");
    assert.equal(
      codeOf(() => validateAliasAddress("a@b@dusrel.example", PRIMARY)),
      "invalid_email",
    );
  });

  it("doosre domain par invalid_domain", () => {
    assert.equal(
      codeOf(() => validateAliasAddress("shop@other.example", PRIMARY)),
      "invalid_domain",
    );
  });

  it("local part 3-64 ke bahar to invalid_email", () => {
    assert.equal(codeOf(() => validateAliasAddress("ab@dusrel.example", PRIMARY)), "invalid_email");
    assert.equal(
      codeOf(() => validateAliasAddress(`${"a".repeat(65)}@dusrel.example`, PRIMARY)),
      "invalid_email",
    );
  });

  it("galat characters to invalid_email", () => {
    assert.equal(
      codeOf(() => validateAliasAddress("a+b@dusrel.example", PRIMARY)),
      "invalid_email",
    );
    assert.equal(
      codeOf(() => validateAliasAddress("a!b@dusrel.example", PRIMARY)),
      "invalid_email",
    );
  });

  it("leading/trailing/consecutive dots to invalid_email", () => {
    assert.equal(
      codeOf(() => validateAliasAddress(".shop@dusrel.example", PRIMARY)),
      "invalid_email",
    );
    assert.equal(
      codeOf(() => validateAliasAddress("shop.@dusrel.example", PRIMARY)),
      "invalid_email",
    );
    assert.equal(
      codeOf(() => validateAliasAddress("sh..op@dusrel.example", PRIMARY)),
      "invalid_email",
    );
  });

  it("reserved local-part to reserved_email", () => {
    for (const name of ["admin", "postmaster", "support", "noreply", "account"]) {
      assert.equal(
        codeOf(() => validateAliasAddress(`${name}@dusrel.example`, PRIMARY)),
        "reserved_email",
      );
    }
  });

  it("primary address ke barabar (case-insensitive) to invalid_email", () => {
    assert.equal(
      codeOf(() => validateAliasAddress("ARAV@dusrel.example", PRIMARY)),
      "invalid_email",
    );
  });

  it("error messages mail-api v1 wale hi hain", () => {
    try {
      validateAliasAddress("shop@other.example", PRIMARY);
      assert.fail("Error throw honi chahiye thi");
    } catch (e) {
      assert.ok(e instanceof AddressError);
      assert.equal(e.message, "Alias must be on your own domain");
    }
    try {
      validateAliasAddress("admin@dusrel.example", PRIMARY);
      assert.fail("Error throw honi chahiye thi");
    } catch (e) {
      assert.ok(e instanceof AddressError);
      assert.equal(e.message, "This address is reserved");
    }
  });
});
