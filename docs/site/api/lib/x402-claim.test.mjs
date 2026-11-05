/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * Tests for lib/x402-claim.mjs — deterministic, no network.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  signClaim,
  verifyClaim,
  claimSecret,
  claimTtlSec,
  DEFAULT_TTL_SEC,
} from "./x402-claim.mjs";

const SECRET = "test-claim-secret-32bytes-minimum";

function withSecret(env = {}) {
  const keep = {
    secret: process.env.X402_CLAIM_SECRET,
    ttl: process.env.X402_CLAIM_TTL_SEC,
  };
  process.env.X402_CLAIM_SECRET = SECRET;
  delete process.env.X402_CLAIM_TTL_SEC;
  Object.assign(process.env, env);
  return () => {
    if (keep.secret === undefined) delete process.env.X402_CLAIM_SECRET;
    else process.env.X402_CLAIM_SECRET = keep.secret;
    if (keep.ttl === undefined) delete process.env.X402_CLAIM_TTL_SEC;
    else process.env.X402_CLAIM_TTL_SEC = keep.ttl;
  };
}

test("sign + verify round-trips a claim", () => {
  const restore = withSecret();
  try {
    const s = signClaim({ order_id: "ord-1", sku: "GC-Day", email: "a@b.c", tx: "0x1", network: "base", amount_cents: 100 });
    assert.equal(s.ok, true);
    assert.match(s.token, /^spl1\./);
    assert.ok(s.expires_at);
    const v = verifyClaim(s.token);
    assert.equal(v.ok, true);
    assert.equal(v.payload.order_id, "ord-1");
    assert.equal(v.payload.sku, "gc-day");
    assert.equal(v.payload.rail, "x402");
  } finally {
    restore();
  }
});

test("default TTL is 45 days; env tunes it", () => {
  assert.equal(DEFAULT_TTL_SEC, 45 * 24 * 60 * 60);
  assert.equal(claimTtlSec({}), DEFAULT_TTL_SEC);
  assert.equal(claimTtlSec({ X402_CLAIM_TTL_SEC: "3600" }), 3600);
  assert.equal(claimTtlSec({ X402_CLAIM_TTL_SEC: "0" }), DEFAULT_TTL_SEC);
  assert.equal(claimTtlSec({ X402_CLAIM_TTL_SEC: "-5" }), DEFAULT_TTL_SEC);
  assert.equal(claimTtlSec({ X402_CLAIM_TTL_SEC: "junk" }), DEFAULT_TTL_SEC);
  assert.equal(claimTtlSec(null), DEFAULT_TTL_SEC);
  const restore = withSecret({ X402_CLAIM_TTL_SEC: "60" });
  try {
    const s = signClaim({ order_id: "ord-ttl", sku: "x" });
    assert.equal(s.ok, true);
    assert.equal(s.payload.exp - s.payload.iat, 60);
  } finally {
    restore();
  }
});

test("missing secret fails closed on sign and verify", () => {
  const keep = {
    claim: process.env.X402_CLAIM_SECRET,
    stripe: process.env.STRIPE_SECRET_KEY,
    restricted: process.env.STRIPE_RESTRICTED_KEY,
    hmac: process.env.CLAIM_HMAC_SECRET,
  };
  delete process.env.X402_CLAIM_SECRET;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_RESTRICTED_KEY;
  delete process.env.CLAIM_HMAC_SECRET;
  try {
    assert.equal(claimSecret(), "");
    assert.equal(signClaim({ order_id: "o", sku: "s" }).error, "claim_secret_missing");
    assert.equal(verifyClaim("spl1.a.b").error, "claim_secret_missing");
  } finally {
    Object.assign(process.env, Object.fromEntries(Object.entries(keep).filter(([, v]) => v !== undefined)));
  }
});

test("incomplete fields fail closed", () => {
  const restore = withSecret();
  try {
    assert.equal(signClaim({ order_id: "", sku: "s" }).error, "claim_fields_incomplete");
    assert.equal(signClaim({ order_id: "o", sku: "" }).error, "claim_fields_incomplete");
  } finally {
    restore();
  }
});

test("tampered, malformed, and cross-secret tokens fail closed", () => {
  const restore = withSecret();
  try {
    const s = signClaim({ order_id: "ord-9", sku: "s" });
    assert.equal(verifyClaim("junk").error, "claim_malformed");
    assert.equal(verifyClaim("spl1.only-two").error, "claim_malformed");
    assert.equal(verifyClaim(`${s.token}x`).error, "claim_bad_sig");
    const parts = s.token.split(".");
    const badBody = `${parts[0]}.e30.${parts[2]}`;
    assert.equal(verifyClaim(badBody).error, "claim_bad_sig");
  } finally {
    restore();
  }
  let token = null;
  const first = withSecret();
  try {
    token = signClaim({ order_id: "ord-x", sku: "s" }).token;
    assert.equal(verifyClaim(token).ok, true);
  } finally {
    first();
  }
  const second = withSecret();
  try {
    process.env.X402_CLAIM_SECRET = "a-different-secret-value-here!";
    assert.equal(verifyClaim(token).error, "claim_bad_sig");
  } finally {
    second();
  }
});
