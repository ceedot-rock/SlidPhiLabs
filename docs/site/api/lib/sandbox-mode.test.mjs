/** Sandbox mode tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { dryRun, SANDBOX_MODE } from "./sandbox-mode.mjs";

test("dryRun previews with $0 spend on every quote", () => {
  const r = dryRun({ task: "compress", items: [{ name: "a" }, { name: "b" }] });
  assert.equal(r.ok, true);
  assert.equal(r.mode, SANDBOX_MODE);
  assert.equal(r.spend_cents, 0);
  assert.equal(r.quotes.length, 2);
  for (const q of r.quotes) {
    assert.equal(q.amount_cents, 0);
    assert.equal(q.mode, SANDBOX_MODE);
  }
  assert.equal(r.settle.amount_cents, 0);
  assert.equal(r.settle.total_cents, 0);
  assert.equal(r.settle.mode, SANDBOX_MODE);
  assert.equal(r.settle.touched_adapters, false);
  assert.deepEqual(r.receipts, []);
});

test("single spec without items yields one quote", () => {
  const r = dryRun({ task: "score" });
  assert.equal(r.ok, true);
  assert.equal(r.quotes.length, 1);
  assert.equal(r.quotes[0].amount_cents, 0);
});

test("preview is deterministic offline", () => {
  const a = dryRun({ task: "x", items: [{ name: "a" }] });
  const b = dryRun({ task: "x", items: [{ name: "a" }] });
  assert.deepEqual(a, b);
  assert.ok(a.quotes[0].would_be_cents > 0);
});

test("settle adapters are never called", () => {
  let called = 0;
  const spy = () => {
    called += 1;
  };
  const r = dryRun({ task: "x" }, { quoter: spy });
  assert.equal(r.ok, true);
  assert.equal(called, 0);
});

test("live or settle adapters are refused fail-closed", () => {
  const live = () => {};
  for (const opts of [
    { settle: live },
    { settleAdapter: live },
    { settleFn: live },
    { payout: live },
    { charge: live },
    { rail: live },
    { adapter: live },
    { adapter: { live: true } },
    { adapter: { mode: "live" } },
  ]) {
    const r = dryRun({ task: "x" }, opts);
    assert.equal(r.ok, false, JSON.stringify(opts));
    assert.match(r.error, /live_adapter/);
  }
});

test("non-live adapter metadata does not trip refusal", () => {
  const r = dryRun({ task: "x" }, { adapter: { mode: "sandbox" } });
  assert.equal(r.ok, true);
});

test("invalid specs are fail-closed", () => {
  for (const bad of [null, undefined, "x", 42, ["task"]]) {
    assert.equal(dryRun(bad).ok, false);
  }
});
