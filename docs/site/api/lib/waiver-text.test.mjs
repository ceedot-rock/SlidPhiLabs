/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * Tests for lib/waiver-text.mjs — deterministic, no network.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  WAIVER_VERSION,
  WAIVER_V1,
  ATTORNEY_REVIEW_PENDING,
  waiverHash,
  buildWaiverAcceptance,
  verifyWaiverAcceptance,
} from "./waiver-text.mjs";

function adapters() {
  return { nowMs: () => 1793805600000 };
}

test("waiver version is pinned to waiver-v1 and review is pending", () => {
  assert.equal(WAIVER_VERSION, "waiver-v1");
  assert.equal(ATTORNEY_REVIEW_PENDING, true);
  assert.equal(typeof WAIVER_V1, "string");
  assert.ok(WAIVER_V1.length > 200);
  assert.match(waiverHash(), /^[0-9a-f]{64}$/);
});

test("acceptance receipt pins version + hash and carries the review flag", () => {
  const r = buildWaiverAcceptance({ rider_id: "sr_a" }, adapters());
  assert.equal(r.ok, true);
  assert.equal(r.receipt.rider_id, "sr_a");
  assert.equal(r.receipt.waiver_version, "waiver-v1");
  assert.equal(r.receipt.waiver_hash, waiverHash());
  assert.equal(r.receipt.accepted, true);
  assert.equal(r.receipt.at, 1793805600000);
  assert.equal(r.receipt.attorney_review_pending, true);
});

test("receipt verifies, including through the { receipt } wrapper", () => {
  const { receipt } = buildWaiverAcceptance({ rider_id: "sr_a" }, adapters());
  const v = verifyWaiverAcceptance(receipt);
  assert.equal(v.ok, true);
  assert.equal(v.rider_id, "sr_a");
  assert.equal(v.attorney_review_pending, true);
  assert.equal(verifyWaiverAcceptance({ receipt }).ok, true);
});

test("fail-closed on missing rider, declined, drifted, or unpinned receipts", () => {
  assert.equal(buildWaiverAcceptance({}, adapters()).reason, "missing_rider_id");
  const { receipt } = buildWaiverAcceptance({ rider_id: "sr_a" }, adapters());
  assert.equal(verifyWaiverAcceptance({ ...receipt, accepted: false }).reason, "waiver_not_accepted");
  assert.equal(
    verifyWaiverAcceptance({ ...receipt, waiver_version: "waiver-v9" }).reason,
    "waiver_version_mismatch"
  );
  assert.equal(
    verifyWaiverAcceptance({ ...receipt, waiver_hash: "0".repeat(64) }).reason,
    "waiver_hash_mismatch"
  );
  assert.equal(verifyWaiverAcceptance(null).reason, "bad_receipt");
  assert.equal(verifyWaiverAcceptance({}).reason, "bad_receipt");
});
