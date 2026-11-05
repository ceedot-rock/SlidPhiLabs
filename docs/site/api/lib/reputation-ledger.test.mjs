/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * Tests for lib/reputation-ledger.mjs — deterministic, no network.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { recordRun, operatorReputation, DEFAULT_LEDGER_PATH } from "./reputation-ledger.mjs";

function isolate(name) {
  const ledgerPath = join(mkdtempSync(join(tmpdir(), `rep-${name}-`)), "reputation.jsonl");
  const adapters = { ledgerPath, nowMs: () => 1793805600000 };
  return adapters;
}

test("default ledger path honors LEDGER_PATH env", async (t) => {
  assert.match(DEFAULT_LEDGER_PATH, /reputation\.jsonl$/);
  t.after(() => {
    delete process.env.LEDGER_PATH;
  });
  process.env.LEDGER_PATH = join(tmpdir(), "env-ledger-test.jsonl");
  const { resolveLedgerPath } = await import("./reputation-ledger.mjs");
  assert.equal(resolveLedgerPath({}), process.env.LEDGER_PATH);
  assert.equal(resolveLedgerPath({ ledgerPath: "/tmp/x.jsonl" }), "/tmp/x.jsonl");
});

test("recordRun rejects bad input fail-closed", () => {
  const a = isolate("bad");
  assert.equal(recordRun({}, a).reason, "missing_rider_id");
  assert.equal(recordRun({ rider_id: "sr_1" }, a).reason, "bad_run");
  assert.equal(recordRun({ rider_id: "sr_1", ok: true, amount_cents: -5 }, a).reason, "bad_run");
  assert.equal(operatorReputation("", a).reason, "missing_rider_id");
});

test("empty ledger scores a fresh operator 1 with zero runs", () => {
  const a = isolate("empty");
  const r = operatorReputation("sr_fresh", a);
  assert.deepEqual(r, { ok: true, rider_id: "sr_fresh", runs: 0, disputes: 0, refunds: 0, score: 1 });
});

test("runs, disputes, refunds, and score accumulate deterministically", () => {
  const a = isolate("accum");
  assert.equal(recordRun({ rider_id: "sr_a", ok: true, amount_cents: 100 }, a).ok, true);
  assert.equal(recordRun({ rider_id: "sr_a", ok: true, amount_cents: 200 }, a).ok, true);
  assert.equal(recordRun({ rider_id: "sr_a", ok: false, amount_cents: 50 }, a).ok, true);
  assert.equal(recordRun({ rider_id: "sr_a", ok: true, amount_cents: 0, refund: true }, a).ok, true);
  assert.equal(recordRun({ rider_id: "sr_other", ok: true, amount_cents: 10 }, a).ok, true);
  const r = operatorReputation("sr_a", a);
  assert.equal(r.runs, 4);
  assert.equal(r.disputes, 1);
  assert.equal(r.refunds, 1);
  assert.equal(r.score, (4 - 1 - 0.5) / 4);
  const other = operatorReputation("sr_other", a);
  assert.equal(other.runs, 1);
  assert.equal(other.score, 1);
});

test("all-failed operator scores 0", () => {
  const a = isolate("zero");
  recordRun({ rider_id: "sr_z", ok: false, amount_cents: 10 }, a);
  recordRun({ rider_id: "sr_z", ok: false, amount_cents: 10 }, a);
  const r = operatorReputation("sr_z", a);
  assert.equal(r.score, 0);
});
