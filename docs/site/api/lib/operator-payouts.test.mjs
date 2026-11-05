import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  quotePayout,
  claimPayout,
  recordExecuted,
  getIntent,
  listIntents,
  MIN_PAYOUT_CENTS,
  USDC_BASE_MAINNET,
  USDC_SOLANA_MAINNET,
  CHAIN_BASE,
  CHAIN_SOLANA,
} from "./operator-payouts.mjs";

const EVM_TO = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const SOL_TO = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const NOW = "2026-11-05T00:00:00.000Z";

function stubs(ids) {
  let i = 0;
  return { now: () => NOW, id: () => ids[i++] };
}

function isolate() {
  const d = mkdtempSync(join(tmpdir(), "payouts-test-"));
  process.env.PAYOUTS_DIR = d;
  delete process.env.AUTH_DIR;
  return d;
}

test("quote base_evm builds unsigned USDC instruction", () => {
  isolate();
  const r = quotePayout(
    { rider_id: "rider-1", amount_cents: 100, rail: "base_evm", to: EVM_TO },
    stubs(["po_aaa"]),
  );
  assert.equal(r.ok, true);
  assert.equal(r.intent.status, "quoted");
  assert.deepEqual(r.intent.instruction, {
    to: EVM_TO,
    amount: "1000000", // 100 cents * 10^4
    asset: USDC_BASE_MAINNET,
    chain: CHAIN_BASE,
  });
  assert.equal(r.intent.asset, USDC_BASE_MAINNET); // USDC-only, fixed per rail
});

test("quote solana builds unsigned USDC instruction", () => {
  isolate();
  const r = quotePayout(
    { rider_id: "rider-2", amount_cents: 250, rail: "solana", to: SOL_TO },
    stubs(["po_bbb"]),
  );
  assert.equal(r.ok, true);
  assert.deepEqual(r.intent.instruction, {
    to: SOL_TO,
    amount: "2500000",
    asset: USDC_SOLANA_MAINNET,
    chain: CHAIN_SOLANA,
  });
});

test("$1 minimum enforced", () => {
  isolate();
  assert.equal(MIN_PAYOUT_CENTS, 100);
  const low = quotePayout(
    { rider_id: "rider-1", amount_cents: 99, rail: "base_evm", to: EVM_TO },
    stubs(["po_low"]),
  );
  assert.equal(low.ok, false);
  assert.equal(low.error, "below_minimum");
  const edge = quotePayout(
    { rider_id: "rider-1", amount_cents: 100, rail: "base_evm", to: EVM_TO },
    stubs(["po_edge"]),
  );
  assert.equal(edge.ok, true);
});

test("bad inputs fail closed", () => {
  isolate();
  const a = stubs(["x1", "x2", "x3", "x4", "x5", "x6"]);
  assert.equal(quotePayout({ rider_id: "", amount_cents: 100, rail: "base_evm", to: EVM_TO }, a).error, "bad_rider_id");
  assert.equal(quotePayout({ rider_id: "r", amount_cents: 0, rail: "base_evm", to: EVM_TO }, a).error, "bad_amount");
  assert.equal(quotePayout({ rider_id: "r", amount_cents: 100, rail: "polygon", to: EVM_TO }, a).error, "bad_rail");
  assert.equal(quotePayout({ rider_id: "r", amount_cents: 100, rail: "base_evm", to: "nope" }, a).error, "bad_destination");
  assert.equal(quotePayout({ rider_id: "r", amount_cents: 100, rail: "solana", to: EVM_TO }, a).error, "bad_destination");
  assert.equal(quotePayout({ rider_id: "r", amount_cents: 100, rail: "base_evm", to: SOL_TO }, a).error, "bad_destination");
});

test("duplicate quotes are idempotent on same terms, conflict on recycled keys", () => {
  isolate();
  const args = { rider_id: "rider-1", amount_cents: 100, rail: "base_evm", to: EVM_TO };
  const first = quotePayout(args, stubs(["po_same"]));
  assert.equal(first.ok, true);
  const retry = quotePayout(args, stubs(["po_same"]));
  assert.equal(retry.ok, true);
  assert.equal(retry.duplicate, true);
  assert.equal(retry.intent.id, "po_same");
  for (const changed of [
    { ...args, amount_cents: 200 },
    { ...args, to: "0x0000000000000000000000000000000000000001" },
    { ...args, rider_id: "rider-2" },
  ]) {
    const clash = quotePayout(changed, stubs(["po_same"]));
    assert.equal(clash.ok, false, JSON.stringify(changed));
    assert.equal(clash.error, "idempotency_conflict");
  }
  // The original intent is untouched by the conflicts.
  assert.equal(getIntent("po_same", {}).intent.amount_cents, 100);
});

test("claim flow requires operator signature, never signs", () => {
  isolate();
  const a = stubs(["po_claim"]);
  quotePayout({ rider_id: "rider-9", amount_cents: 500, rail: "solana", to: SOL_TO }, a);
  const c = claimPayout({ intent_id: "po_claim" }, a);
  assert.equal(c.ok, true);
  assert.equal(c.claim.requires, "operator_signature");
  assert.deepEqual(Object.keys(c.claim.instruction).sort(), ["amount", "asset", "chain", "to"]);
  const blob = JSON.stringify(c.claim);
  for (const secret of ["secret", "private", "mnemonic", "seed"]) {
    assert.ok(!blob.toLowerCase().includes(secret), `claim must not contain ${secret}`);
  }
  assert.ok(!("signature" in c.claim || "signed" in c.claim || "signer" in c.claim));
  const dup = claimPayout({ intent_id: "po_claim" }, a);
  assert.equal(dup.duplicate, true);
  assert.equal(claimPayout({ intent_id: "po_missing" }, a).error, "unknown_intent");
});

test("execute records operator execution, only after claim", () => {
  isolate();
  const a = stubs(["po_exec"]);
  quotePayout({ rider_id: "rider-9", amount_cents: 500, rail: "base_evm", to: EVM_TO }, a);
  assert.equal(recordExecuted({ intent_id: "po_exec", tx: "0x1", signer: "0xop" }, a).error, "not_claimed");
  claimPayout({ intent_id: "po_exec" }, a);
  const e = recordExecuted({ intent_id: "po_exec", tx: "0xdead", signer: "0xoperator" }, a);
  assert.equal(e.ok, true);
  assert.equal(e.intent.status, "executed");
  assert.equal(e.intent.execution.tx, "0xdead");
  const dup = recordExecuted({ intent_id: "po_exec", tx: "0xdead", signer: "0xoperator" }, a);
  assert.equal(dup.duplicate, true);
  assert.equal(recordExecuted({ intent_id: "po_exec", tx: "", signer: "0xop" }, a).error, "bad_tx");
  assert.equal(recordExecuted({ intent_id: "nope-never", tx: "0x1", signer: "0xop" }, a).error, "unknown_intent");
});

test("corrupt ledger fails closed with corrupt_store, never saved over", () => {
  const d = isolate();
  quotePayout(
    { rider_id: "rider-c", amount_cents: 100, rail: "base_evm", to: EVM_TO },
    stubs(["po_c"]),
  );
  const f = join(d, "payouts.json");
  writeFileSync(f, "{corrupt");
  assert.equal(
    quotePayout(
      { rider_id: "rider-c", amount_cents: 100, rail: "base_evm", to: EVM_TO },
      stubs(["po_c2"]),
    ).error,
    "corrupt_store",
  );
  assert.equal(claimPayout({ intent_id: "po_c" }, {}).error, "corrupt_store");
  assert.equal(recordExecuted({ intent_id: "po_c", tx: "0x1", signer: "0xop" }, {}).error, "corrupt_store");
  assert.equal(getIntent("po_c", {}).error, "corrupt_store");
  assert.equal(listIntents({}).error, "corrupt_store");
  assert.equal(readFileSync(f, "utf8"), "{corrupt");
});

test("intents persist to ledger file, misses fail closed", () => {
  isolate();
  const a = stubs(["po_l1", "po_l2"]);
  quotePayout({ rider_id: "r-a", amount_cents: 100, rail: "base_evm", to: EVM_TO }, a);
  quotePayout({ rider_id: "r-b", amount_cents: 200, rail: "solana", to: SOL_TO }, a);
  const list = listIntents({});
  assert.equal(list.ok, true);
  assert.equal(list.intents.length, 2);
  assert.equal(getIntent("po_l1", {}).intent.rider_id, "r-a");
  assert.equal(getIntent("po_missing", {}).error, "unknown_intent");
  assert.equal(getIntent("", {}).error, "bad_intent_id");
});
