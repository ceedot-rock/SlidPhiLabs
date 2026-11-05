import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { seatFromClaimHeader, applyClaimSeat, claimAuthError } from "./claim-seat.mjs";
import { signClaim } from "./x402-claim.mjs";

process.env.X402_CLAIM_SECRET = "test-claim-secret-0123456789abcdef";

const bearer = (t) => ({ headers: { authorization: `Bearer ${t}` } });

function expiredToken() {
  const secret = process.env.X402_CLAIM_SECRET;
  const b64 = (o) =>
    Buffer.from(JSON.stringify(o)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  const body = b64({
    v: 1,
    rail: "x402",
    order_id: "ord-old",
    sku: "gc-day",
    email: null,
    tx: null,
    network: null,
    amount_cents: null,
    iat: Math.floor(Date.now() / 1000) - 100000,
    exp: Math.floor(Date.now() / 1000) - 10,
  });
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return `spl1.${body}.${sig}`;
}

test("happy: valid claim verifies, stamps sku + seat id", () => {
  const s = signClaim({ order_id: "ord-1", sku: "GC-Day" });
  assert.equal(s.ok, true);
  const r = seatFromClaimHeader(bearer(s.token));
  assert.equal(r.ok, true);
  assert.equal(r.sku, "gc-day");
  assert.equal(r.seatId, "ord-1");
});

test("happy: applyClaimSeat stamps paid-seat headers", () => {
  const s = signClaim({ order_id: "ord-2", sku: "chamber-year" });
  const req = bearer(s.token);
  const r = applyClaimSeat(req);
  assert.equal(r.ok, true);
  assert.equal(req.headers["x-spl-seat"], "chamber-year");
  assert.equal(req.headers["x-spl-seat-id"], "ord-2");
});

test("happy: capital Authorization header works", () => {
  const s = signClaim({ order_id: "ord-3", sku: "lab-pass" });
  const r = seatFromClaimHeader({ headers: { Authorization: `Bearer ${s.token}` } });
  assert.equal(r.ok, true);
  assert.equal(r.seatId, "ord-3");
});

test("error: no header -> no_claim, caller proceeds as before", () => {
  assert.deepEqual(seatFromClaimHeader({ headers: {} }), { ok: false, reason: "no_claim" });
  assert.deepEqual(seatFromClaimHeader({}), { ok: false, reason: "no_claim" });
});

test("error: foreign Bearer token ignored as no_claim", () => {
  const r = seatFromClaimHeader(bearer("abc123"));
  assert.equal(r.ok, false);
  assert.equal(r.reason, "no_claim");
  assert.equal(r.tokenPresent, undefined);
});

test("error: spl1-shaped but malformed -> claim_malformed + tokenPresent", () => {
  const r = seatFromClaimHeader(bearer("spl1.not-a-token"));
  assert.equal(r.ok, false);
  assert.equal(r.reason, "claim_malformed");
  assert.equal(r.tokenPresent, true);
});

test("error: tampered signature -> claim_bad_sig", () => {
  const s = signClaim({ order_id: "ord-4", sku: "gc-day" });
  const bad = s.token.slice(0, -1) + (s.token.endsWith("A") ? "B" : "A");
  const r = seatFromClaimHeader(bearer(bad));
  assert.equal(r.ok, false);
  assert.equal(r.reason, "claim_bad_sig");
  assert.equal(r.tokenPresent, true);
});

test("error: expired claim -> claim_expired", () => {
  const r = seatFromClaimHeader(bearer(expiredToken()));
  assert.equal(r.ok, false);
  assert.equal(r.reason, "claim_expired");
  assert.equal(r.tokenPresent, true);
});

test("error: missing secret -> claim_secret_missing (fail-closed, no downgrade)", () => {
  const saved = {
    X402_CLAIM_SECRET: process.env.X402_CLAIM_SECRET,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_RESTRICTED_KEY: process.env.STRIPE_RESTRICTED_KEY,
    CLAIM_HMAC_SECRET: process.env.CLAIM_HMAC_SECRET,
  };
  delete process.env.X402_CLAIM_SECRET;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_RESTRICTED_KEY;
  delete process.env.CLAIM_HMAC_SECRET;
  try {
    const r = seatFromClaimHeader(bearer("spl1.anything.anything"));
    assert.equal(r.ok, false);
    assert.equal(r.reason, "claim_secret_missing");
    assert.equal(r.tokenPresent, true);
  } finally {
    for (const [k, v] of Object.entries(saved)) if (v !== undefined) process.env[k] = v;
  }
});

test("error: frozen headers -> header_stamp_failed, never throws", () => {
  const s = signClaim({ order_id: "ord-5", sku: "gc-day" });
  const req = bearer(s.token);
  Object.freeze(req.headers);
  const r = applyClaimSeat(req);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "header_stamp_failed");
});

test("claimAuthError maps reasons to plain-English 401 bodies", () => {
  const e = claimAuthError("claim_expired");
  assert.equal(e.ok, false);
  assert.equal(e.error, "invalid_claim");
  assert.equal(e.reason, "claim_expired");
  assert.match(e.message, /expired/);
  assert.match(e.message, /x402-products/);
  const unknown = claimAuthError("something_new");
  assert.match(unknown.message, /not valid/);
});
