import test from "node:test";
import assert from "node:assert/strict";
import { listTemplates, expandTemplate } from "./warrant-templates.mjs";

test("listTemplates exposes vertical bundles", () => {
  const list = listTemplates();
  assert.ok(list.length >= 4);
  for (const t of list) {
    assert.ok(t.id);
    assert.ok(Array.isArray(t.crossings) && t.crossings.length);
    assert.ok(t.max_usd >= 0 && t.max_calls >= 1 && t.ttl >= 30);
  }
});

test("expandTemplate maps to warrant-issue params", () => {
  const r = expandTemplate("compress");
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.params).sort(), ["actions", "max_calls", "max_usd", "ttl_seconds"]);
  assert.deepEqual(r.params.actions, ["compress"]);
});

test("unknown template fail-closed", () => {
  const r = expandTemplate("nope");
  assert.equal(r.ok, false);
  assert.equal(r.reason, "unknown_template");
});

test("overrides may narrow but never widen", () => {
  const base = expandTemplate("spend").params;
  const narrow = expandTemplate("spend", { max_usd: 1, max_calls: 1 });
  assert.equal(narrow.ok, true);
  assert.ok(narrow.params.max_usd <= base.max_usd);
  assert.equal(expandTemplate("spend", { max_usd: base.max_usd + 1 }).reason, "widening_denied");
  assert.equal(expandTemplate("spend", { actions: ["compress"] }).reason, "bad_override");
});
