/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * Tests for lib/stake-slash.mjs — deterministic, no network.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  postStake,
  slashStake,
  stakeBalanceOf,
  stakeBalances,
  DEFAULT_STAKE_LEDGER_PATH,
} from "./stake-slash.mjs";

function isolate(name) {
  const ledgerPath = join(mkdtempSync(join(tmpdir(), `stake-${name}-`)), "stake.jsonl");
  return { ledgerPath, nowMs: () => 1793805600000 };
}

test("default ledger path ends in stake.jsonl", () => {
  assert.match(DEFAULT_STAKE_LEDGER_PATH, /stake\.jsonl$/);
});

test("post, slash, and balances accumulate per rider", () => {
  const a = isolate("accum");
  assert.equal(postStake({ rider_id: "sr_a", amount_cents: 1000 }, a).ok, true);
  assert.equal(postStake({ rider_id: "sr_a", amount_cents: 500 }, a).ok, true);
  assert.equal(slashStake({ rider_id: "sr_a", amount_cents: 300, reason: "late delivery" }, a).ok, true);
  const b = stakeBalanceOf("sr_a", a);
  assert.deepEqual(b, {
    ok: true,
    rider_id: "sr_a",
    staked_cents: 1500,
    slashed_cents: 300,
    balance_cents: 1200,
  });
  const all = stakeBalances(a);
  assert.equal(all.ok, true);
  assert.equal(all.balances.sr_a.balance_cents, 1200);
});

test("fresh riders report zero balances", () => {
  const a = isolate("fresh");
  assert.deepEqual(stakeBalanceOf("sr_new", a), {
    ok: true,
    rider_id: "sr_new",
    staked_cents: 0,
    slashed_cents: 0,
    balance_cents: 0,
  });
  assert.deepEqual(stakeBalances(a), { ok: true, balances: {} });
});

test("slash requires a reason and a sufficient balance", () => {
  const a = isolate("guard");
  postStake({ rider_id: "sr_g", amount_cents: 200 }, a);
  assert.equal(slashStake({ rider_id: "sr_g", amount_cents: 50 }, a).reason, "reason_required");
  assert.equal(slashStake({ rider_id: "sr_g", amount_cents: 50, reason: "   " }, a).reason, "reason_required");
  const over = slashStake({ rider_id: "sr_g", amount_cents: 201, reason: "fraud" }, a);
  assert.equal(over.reason, "insufficient_stake");
  assert.equal(over.balance_cents, 200);
  // Exact-balance slash drains to zero and is allowed.
  assert.equal(slashStake({ rider_id: "sr_g", amount_cents: 200, reason: "fraud" }, a).ok, true);
  assert.equal(stakeBalanceOf("sr_g", a).balance_cents, 0);
});

test("fail-closed on bad rider ids and amounts", () => {
  const a = isolate("bad");
  assert.equal(postStake({}, a).reason, "missing_rider_id");
  assert.equal(postStake({ rider_id: "sr_x", amount_cents: 0 }, a).reason, "bad_amount");
  assert.equal(postStake({ rider_id: "sr_x", amount_cents: -5 }, a).reason, "bad_amount");
  assert.equal(postStake({ rider_id: "sr_x", amount_cents: 1.5 }, a).reason, "bad_amount");
  assert.equal(slashStake({ rider_id: "sr_x", amount_cents: 10, reason: "r" }, a).reason, "insufficient_stake");
  assert.equal(stakeBalanceOf("", a).reason, "missing_rider_id");
});

test("riders are isolated from each other", () => {
  const a = isolate("iso");
  postStake({ rider_id: "sr_1", amount_cents: 100 }, a);
  postStake({ rider_id: "sr_2", amount_cents: 700 }, a);
  slashStake({ rider_id: "sr_1", amount_cents: 100, reason: "spam" }, a);
  assert.equal(stakeBalanceOf("sr_1", a).balance_cents, 0);
  assert.equal(stakeBalanceOf("sr_2", a).balance_cents, 700);
});
