/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * Tests for lib/standing-rider.mjs — deterministic, no network.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  issueStandingRider,
  verifyStandingRider,
  revokeStandingRider,
  safeguardsHash,
  STANDING_WAIVER_VERSION,
} from "./standing-rider.mjs";

const SAFEGUARDS = Object.freeze({
  spendCapCents: 5000,
  allowedCrossings: ["spend", "fetch"],
  velocityPerMin: 10,
  allowedTools: ["compress", "fetch"],
});
const WAIVER = Object.freeze({ accepted: true, version: STANDING_WAIVER_VERSION, at: 1793805600000 });

function adapters() {
  return { store: new Map(), nowMs: () => 1793805600000 };
}

test("issues a receipt when every safeguard is present and waiver accepted", () => {
  const r = issueStandingRider({ safeguards: { ...SAFEGUARDS }, waiver: { ...WAIVER } }, adapters());
  assert.equal(r.ok, true);
  assert.match(r.receipt.rider_id, /^sr_[0-9a-f]{24}$/);
  assert.equal(r.receipt.safeguards_hash, safeguardsHash(SAFEGUARDS));
  assert.equal(r.receipt.waiver_version, STANDING_WAIVER_VERSION);
  assert.deepEqual(Object.keys(r.receipt).sort(), ["rider_id", "safeguards_hash", "waiver_version"]);
});

test("issue is deterministic for identical input", () => {
  const a = issueStandingRider({ safeguards: { ...SAFEGUARDS }, waiver: { ...WAIVER } }, adapters());
  const b = issueStandingRider(
    {
      safeguards: { ...SAFEGUARDS, allowedTools: ["fetch", "compress"] },
      waiver: { ...WAIVER },
    },
    adapters()
  );
  assert.equal(a.receipt.rider_id, b.receipt.rider_id);
});

test("fail-closed on each missing safeguard", () => {
  for (const key of ["spendCapCents", "allowedCrossings", "velocityPerMin", "allowedTools"]) {
    const sg = { ...SAFEGUARDS };
    delete sg[key];
    const r = issueStandingRider({ safeguards: sg, waiver: { ...WAIVER } }, adapters());
    assert.equal(r.reason, "missing_safeguard");
    assert.equal(r.safeguard, key);
  }
  assert.equal(issueStandingRider({ waiver: { ...WAIVER } }, adapters()).reason, "missing_safeguard");
  assert.equal(
    issueStandingRider({ safeguards: { ...SAFEGUARDS, spendCapCents: 0 }, waiver: { ...WAIVER } }, adapters()).reason,
    "missing_safeguard"
  );
  assert.equal(
    issueStandingRider({ safeguards: { ...SAFEGUARDS, allowedTools: [] }, waiver: { ...WAIVER } }, adapters()).reason,
    "missing_safeguard"
  );
});

test("fail-closed when waiver is missing, declined, or unpinned", () => {
  const bad = [
    undefined,
    { accepted: false, version: STANDING_WAIVER_VERSION },
    { accepted: true, version: "waiver-v9" },
    { accepted: true },
  ];
  for (const waiver of bad) {
    const r = issueStandingRider({ safeguards: { ...SAFEGUARDS }, waiver }, adapters());
    assert.equal(r.ok, false);
    assert.equal(r.reason, "waiver_not_accepted");
  }
});

test("verify roundtrip, unknown rider, revoke -> revoked", () => {
  const a = adapters();
  const issued = issueStandingRider({ safeguards: { ...SAFEGUARDS }, waiver: { ...WAIVER } }, a);
  const v = verifyStandingRider(issued.receipt.rider_id, a);
  assert.equal(v.ok, true);
  assert.equal(v.safeguards_hash, issued.receipt.safeguards_hash);
  assert.equal(verifyStandingRider("sr_doesnotexist00000000", a).reason, "unknown_rider");
  assert.equal(verifyStandingRider(null, a).reason, "missing_rider_id");
  const rev = revokeStandingRider(issued.receipt.rider_id, a);
  assert.deepEqual(rev, { ok: true, rider_id: issued.receipt.rider_id, revoked: true });
  assert.equal(verifyStandingRider(issued.receipt, a).reason, "revoked");
  assert.equal(revokeStandingRider("sr_doesnotexist00000000", a).reason, "unknown_rider");
});
