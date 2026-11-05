/** Sandbox mode tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { dryRun, estimateCents, bytesOf, SANDBOX_MODE } from "./sandbox-mode.mjs";
import { computeQuote } from "../suite-pricing.js";

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
  const spec = { task: "x", items: [{ name: "a", bytes: 2 * 1024 * 1024 * 1024 }] };
  const a = dryRun(spec);
  const b = dryRun(spec);
  assert.deepEqual(a, b);
  assert.ok(a.quotes[0].would_be_cents > 0);
});

test("would-be cents run the real quote math, not byte length", () => {
  const GB = 1024 * 1024 * 1024;
  // Under the 1 GB free cap: honestly $0 would-be.
  const free = dryRun({ task: "x", items: [{ name: "a" }] });
  assert.equal(free.quotes[0].would_be_cents, 0);
  assert.equal(free.would_be_cents, 0);
  // 2 GB in: 1 GB billable at $0.25/GB = $0.25, under the $1 card floor.
  const two = dryRun({ task: "x", items: [{ name: "big", bytes: 2 * GB }] });
  assert.equal(two.quotes[0].would_be_cents, computeQuote({ bytes: 2 * GB }).amount_cents);
  assert.equal(two.quotes[0].would_be_cents, 100);
  // 20 GB in: 19 GB x 25c = $4.75, exactly production's number.
  const twenty = dryRun({ task: "x", items: [{ name: "huge", bytes: 20 * GB }] });
  assert.equal(twenty.quotes[0].would_be_cents, 475);
  assert.equal(twenty.would_be_cents, 475);
});

test("bytesOf prefers explicit byte fields over JSON length", () => {
  assert.equal(bytesOf({ name: "a", bytes: 10 }), 10);
  assert.equal(bytesOf({ name: "a", input_bytes: 11 }), 11);
  assert.equal(bytesOf({ name: "a", size_bytes: 12 }), 12);
  assert.ok(bytesOf({ name: "a" }) > 0);
});

test("quote adapter is injectable; failures fail safe to 0", () => {
  const r = dryRun({ task: "x", items: [{ name: "a" }] }, { quote: () => ({ amount_cents: 42 }) });
  assert.equal(r.ok, true);
  assert.equal(r.quotes[0].would_be_cents, 42);
  const boom = dryRun({ task: "x", items: [{ name: "a" }] }, { quote: () => { throw new Error("down"); } });
  assert.equal(boom.ok, true);
  assert.equal(boom.quotes[0].would_be_cents, 0);
  assert.equal(estimateCents({ name: "a" }, () => ({ amount_cents: "junk" })), 0);
  assert.equal(dryRun({ task: "x" }, { quote: 42 }).error, "invalid_quote_adapter");
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
