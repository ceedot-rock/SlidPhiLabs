/** Rider paid call: identity plus x402 proof in one envelope.
 *  Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkPaidProof,
  verifyPaidCall,
  RIDER_PAID_CALL_VERSION,
} from "./rider-paid-call.mjs";

const TX = "0x" + "ab".repeat(32);
const SIG = "0x" + "cd".repeat(65);
const PROOF = { txHash: TX, payerSig: SIG, amount_cents: 25, rail: "base" };
const ADAPTERS = {
  verifyRider: () => ({ ok: true, rider_id: "rider-1" }),
  verifyChain: () => ({ ok: true, tx: TX, rail: "base", paid_cents: 25 }),
};

test("proof shape accepts the txHash scheme and rejects junk", () => {
  const good = checkPaidProof(PROOF);
  assert.equal(good.ok, true);
  assert.equal(good.norm.txHash, TX);
  assert.equal(checkPaidProof({}).reason, "bad_tx");
  assert.equal(checkPaidProof({ ...PROOF, txHash: "nope" }).ok, false);
  assert.equal(checkPaidProof({ ...PROOF, payerSig: "short" }).ok, false);
  assert.equal(checkPaidProof(null).ok, false);
});

test("verified rider plus verified chain completes the call", async () => {
  const r = await verifyPaidCall({ rider: "rider-1", payment: PROOF }, ADAPTERS);
  assert.equal(r.ok, true);
  assert.equal(r.rider_id, "rider-1");
  assert.equal(r.tx, TX);
  assert.equal(r.rail, "base");
});

test("missing rider or proof refuses before any adapter", async () => {
  let calls = 0;
  const counting = {
    verifyRider: () => { calls += 1; return { ok: true, rider_id: "r" }; },
    verifyChain: () => { calls += 1; return { ok: true }; },
  };
  assert.equal((await verifyPaidCall({ payment: PROOF }, counting)).reason, "bad_rider");
  assert.equal((await verifyPaidCall({ rider: "r", payment: {} }, counting)).reason, "bad_tx");
  assert.equal(calls, 0);
});

test("no adapters means no verification and a refusal", async () => {
  const r = await verifyPaidCall({ rider: "rider-1", payment: PROOF }, {});
  assert.equal(r.ok, false);
  assert.equal(r.reason, "adapter_required");
});

test("chain rejection fails the call closed", async () => {
  const r = await verifyPaidCall({ rider: "rider-1", payment: PROOF }, {
    verifyRider: ADAPTERS.verifyRider,
    verifyChain: () => ({ ok: false, reason: "tx_not_found" }),
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "tx_not_found");
});

test("underpaid calls refuse against the floor", async () => {
  const short = await verifyPaidCall(
    { rider: "rider-1", payment: { ...PROOF, amount_cents: 5 }, min_cents: 25 },
    ADAPTERS,
  );
  assert.equal(short.ok, false);
  assert.equal(short.reason, "underpaid");
  const exact = await verifyPaidCall(
    { rider: "rider-1", payment: PROOF, min_cents: 25 },
    ADAPTERS,
  );
  assert.equal(exact.ok, true);
});

test("version constant is pinned", () => {
  assert.match(RIDER_PAID_CALL_VERSION, /^\d+\.\d+\.\d+$/);
});
