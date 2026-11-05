import test from "node:test";
import assert from "node:assert/strict";
import { createVersionCatalog } from "./tool-versions.mjs";

function catalog() {
  const c = createVersionCatalog({ nowFn: () => Date.parse("2026-06-01T00:00:00Z") });
  c.register({ id: "spl_x", version: "1.0.0" });
  c.register({ id: "spl_x", version: "1.2.0" });
  c.register({ id: "spl_x", version: "2.0.0", deprecated: true, sunset_at: "2026-01-01T00:00:00Z" });
  return c;
}

test("latest/exact/range-pinned resolution", () => {
  const c = catalog();
  assert.equal(c.resolveVersion("spl_x", "latest").tool.version, "2.0.0");
  assert.equal(c.resolveVersion("spl_x", "1.0.0").tool.version, "1.0.0");
  assert.equal(c.resolveVersion("spl_x", "^1.0.0").tool.version, "1.2.0");
  assert.equal(c.resolveVersion("spl_x", "~1.0.0").tool.version, "1.0.0");
  assert.equal(c.resolveVersion("spl_x", ">=1.0.0").tool.version, "2.0.0");
});

test("deprecation + sunset warnings land in receipt", () => {
  const c = catalog();
  const r = c.resolveVersion("spl_x", "2.0.0");
  assert.equal(r.ok, true);
  assert.ok(r.receipt.warnings.includes("deprecated"));
  assert.ok(r.receipt.warnings.includes("sunset_passed"));
  assert.deepEqual(c.resolveVersion("spl_x", "1.0.0").receipt.warnings, []);
});

test("unknown tool/version and bad spec fail closed", () => {
  const c = catalog();
  assert.equal(c.resolveVersion("nope").reason, "unknown_tool");
  assert.equal(c.resolveVersion("spl_x", "9.9.9").reason, "unknown_version");
  assert.equal(c.resolveVersion("spl_x", "^9.0.0").reason, "unknown_version");
  assert.equal(c.resolveVersion("spl_x", "bogus").reason, "bad_spec");
  assert.equal(c.register({ id: "spl_x", version: "nope" }).reason, "bad_tool");
  assert.equal(c.register({ id: "spl_x", version: "1.0.0" }).reason, "duplicate_tool");
});
