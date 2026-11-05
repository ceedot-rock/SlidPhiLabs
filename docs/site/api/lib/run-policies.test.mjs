/** Run policies tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  POLICIES,
  TOOL_POLICIES,
  policyFor,
  getPolicy,
  listPolicies,
  POLICY_DEFAULT,
  POLICY_LONG,
  POLICY_QUICK,
} from "./run-policies.mjs";

test("empty/invalid specs resolve to the default policy", () => {
  for (const bad of [undefined, null, "x", 42, {}]) {
    const p = policyFor(bad);
    assert.equal(p.name, POLICY_DEFAULT);
    assert.deepEqual({ ...p }, { ...POLICIES.default, name: POLICY_DEFAULT });
  }
  assert.ok(Object.isFrozen(policyFor({})));
});

test("explicit policy names select their table entry", () => {
  assert.equal(policyFor({ policy: "long" }).timeout_ms, POLICIES.long.timeout_ms);
  assert.equal(policyFor({ policy: "long" }).retries, POLICIES.long.retries);
  assert.equal(policyFor({ policy: "quick" }).name, POLICY_QUICK);
  assert.equal(policyFor({ policy: "default" }).name, POLICY_DEFAULT);
});

test("unknown policy names fall back to default (fail-closed)", () => {
  const p = policyFor({ policy: "ultra" });
  assert.equal(p.name, POLICY_DEFAULT);
  assert.equal(p.timeout_ms, POLICIES.default.timeout_ms);
});

test("built-in per-tool overrides resolve through the tool table", () => {
  assert.ok(typeof TOOL_POLICIES.compress === "string");
  const p = policyFor({ tool: "compress" });
  assert.equal(p.name, TOOL_POLICIES.compress);
});

test("explicit policy beats the per-tool default", () => {
  const p = policyFor({ tool: "compress", policy: "long" });
  assert.equal(p.name, POLICY_LONG);
});

test("injectable tools map layers over the built-in table", () => {
  const mine = policyFor({ tool: "mine" }, { tools: { mine: "long" } });
  assert.equal(mine.name, POLICY_LONG);
  const over = policyFor({ tool: "compress" }, { tools: { compress: "long" } });
  assert.equal(over.name, POLICY_LONG);
  const badTool = policyFor({ tool: "mine" }, { tools: { mine: "nope" } });
  assert.equal(badTool.name, POLICY_DEFAULT);
});

test("explicit numeric fields override the table after validation", () => {
  const p = policyFor({ policy: "quick", timeout_ms: 2500, retries: 3, backoff_ms: 5 });
  assert.equal(p.name, POLICY_QUICK);
  assert.equal(p.timeout_ms, 2500);
  assert.equal(p.retries, 3);
  assert.equal(p.backoff_ms, 5);
  const bad = policyFor({ timeout_ms: -1, retries: "x", backoff_ms: -4 });
  assert.equal(bad.timeout_ms, POLICIES.default.timeout_ms);
  assert.equal(bad.retries, POLICIES.default.retries);
  assert.equal(bad.backoff_ms, POLICIES.default.backoff_ms);
});

test("getPolicy envelopes known/unknown names; listPolicies covers the table", () => {
  const ok = getPolicy("long");
  assert.equal(ok.ok, true);
  assert.equal(ok.policy.name, POLICY_LONG);
  assert.deepEqual(getPolicy("nope"), { ok: false, error: "unknown_policy" });
  assert.deepEqual(getPolicy(null), { ok: false, error: "unknown_policy" });
  assert.deepEqual(listPolicies(), ["default", "long", "quick"]);
});
