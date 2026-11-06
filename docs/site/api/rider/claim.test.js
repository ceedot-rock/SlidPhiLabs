/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * Tests for api/rider/claim.js — fully offline, no network.
 *
 * claim.js reads its config from the environment (RIDER_PLATFORM_KEY,
 * STRIPE_SECRET_KEY, AUTH_DIR) and from the global fetch, so each test
 * loads a FRESH module instance (query-tagged import) against its own
 * temp AUTH_DIR and injects its adapters that way: env keys in, a stubbed
 * global fetch, and a per-test temp dir. Any unexpected network call
 * throws, so a passing suite proves no real traffic happens.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLAIM_URL = new URL("./claim.js", import.meta.url).href;
let freshTag = 0;

/** Import a fresh claim.js bound to authDir (DATA_DIR is read at import). */
async function loadClaim(authDir) {
  const saved = process.env.AUTH_DIR;
  process.env.AUTH_DIR = authDir;
  try {
    const mod = await import(`${CLAIM_URL}?fresh=${Date.now()}-${freshTag++}`);
    return mod.default;
  } finally {
    if (saved === undefined) delete process.env.AUTH_DIR;
    else process.env.AUTH_DIR = saved;
  }
}

function newAuthDir() {
  return mkdtempSync(join(tmpdir(), "rider-claim-test-"));
}

/** Set (or clear) the key env knobs claim.js reads per request. */
function withKeys({ platform = true, stripe = true } = {}) {
  const saved = {
    RIDER_PLATFORM_KEY: process.env.RIDER_PLATFORM_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_RESTRICTED_KEY: process.env.STRIPE_RESTRICTED_KEY,
  };
  if (platform) process.env.RIDER_PLATFORM_KEY = "test-platform-key";
  else delete process.env.RIDER_PLATFORM_KEY;
  if (stripe) process.env.STRIPE_SECRET_KEY = "sk_test_123";
  else {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_RESTRICTED_KEY;
  }
  return () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
}

/**
 * Stub global fetch. Stripe sessions and mint answers are injected;
 * anything else (including real network) throws.
 */
function stubFetch({ stripeSession = null, issued = null } = {}) {
  const saved = globalThis.fetch;
  const calls = { stripe: 0, mint: 0 };
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("api.stripe.com")) {
      calls.stripe += 1;
      if (stripeSession instanceof Error) throw stripeSession;
      if (stripeSession && stripeSession.notFound) return { ok: false };
      return { ok: true, json: async () => stripeSession };
    }
    if (u.includes("agentrider.fly.dev")) {
      calls.mint += 1;
      if (issued instanceof Error) throw issued;
      return { ok: true, json: async () => issued };
    }
    throw new Error(`unexpected network call: ${u}`);
  };
  return { calls, restore() { globalThis.fetch = saved; } };
}

function mockReq(body, ip = "9.9.9.9") {
  return { method: "POST", headers: {}, socket: { remoteAddress: ip }, body };
}

function mockRes() {
  const chunks = [];
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; },
    end(c) {
      if (c !== undefined) chunks.push(String(c));
      this.body = chunks.join("");
      this.ended = true;
      return this;
    },
  };
}

async function post(handler, sessionId, extraBody, ip) {
  const req = mockReq({ session_id: sessionId, ...(extraBody || {}) }, ip);
  const res = mockRes();
  await handler(req, res);
  return { status: res.statusCode, json: JSON.parse(res.body) };
}

test("fail-soft with no keys: paid seat acknowledged, no network touched", async () => {
  const claim = await loadClaim(newAuthDir());
  const restoreKeys = withKeys({ platform: false, stripe: false });
  const net = stubFetch();
  try {
    const r = await post(claim, "cs_test_nokeys");
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, false);
    assert.match(r.json.message, /being connected/);
    assert.equal(net.calls.stripe, 0);
    assert.equal(net.calls.mint, 0);
  } finally {
    net.restore();
    restoreKeys();
  }
});

test("fail-soft when only the stripe key is missing", async () => {
  const claim = await loadClaim(newAuthDir());
  const restoreKeys = withKeys({ platform: true, stripe: false });
  const net = stubFetch();
  try {
    const r = await post(claim, "cs_test_nostripe");
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, false);
    assert.match(r.json.message, /not configured/);
    assert.equal(net.calls.stripe, 0);
    assert.equal(net.calls.mint, 0);
  } finally {
    net.restore();
    restoreKeys();
  }
});

test("refuses a paid non-Rider SKU and never calls mint", async () => {
  const claim = await loadClaim(newAuthDir());
  const restoreKeys = withKeys({ platform: true, stripe: true });
  const net = stubFetch({
    stripeSession: { payment_status: "paid", metadata: { sku: "gc-day" } },
    issued: { rider: "jwt-must-never-mint" },
  });
  try {
    // The body sku is attacker-controlled and must be ignored: Stripe says
    // gc-day, so no Rider credential may mint even though the body begs.
    const r = await post(claim, "cs_test_badsku", { sku: "rider-solo" });
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, false);
    assert.match(r.json.message, /not a Rider seat/);
    assert.equal(net.calls.stripe, 1);
    assert.equal(net.calls.mint, 0);
  } finally {
    net.restore();
    restoreKeys();
  }
});

test("mints once per session_id and replays from disk after reload", async () => {
  const authDir = newAuthDir();
  const claim = await loadClaim(authDir);
  const restoreKeys = withKeys({ platform: true, stripe: true });
  const net = stubFetch({
    stripeSession: { payment_status: "paid", metadata: { sku: "rider-solo" } },
    issued: { rider: "jwt-test-1", expires_in: 900 },
  });
  try {
    const r1 = await post(claim, "cs_test_idem");
    assert.equal(r1.status, 200);
    assert.equal(r1.json.ok, true);
    assert.equal(r1.json.jwt, "jwt-test-1");
    const r2 = await post(claim, "cs_test_idem");
    assert.deepEqual(r2.json, r1.json);
    assert.equal(net.calls.mint, 1);
    assert.equal(net.calls.stripe, 1);
  } finally {
    net.restore();
    restoreKeys();
  }
  // Simulate a restart: a fresh module on the same AUTH_DIR must replay the
  // persisted receipt without touching the network at all.
  const claim2 = await loadClaim(authDir);
  const restoreKeys2 = withKeys({ platform: true, stripe: true });
  const dead = stubFetch({
    stripeSession: new Error("must not call stripe after restart"),
    issued: new Error("must not call mint after restart"),
  });
  try {
    const r3 = await post(claim2, "cs_test_idem");
    assert.equal(r3.status, 200);
    assert.equal(r3.json.ok, true);
    assert.equal(r3.json.jwt, "jwt-test-1");
  } finally {
    dead.restore();
    restoreKeys2();
  }
});

test("rate-limits an IP after 10 claims per minute", async () => {
  const claim = await loadClaim(newAuthDir());
  const restoreKeys = withKeys({ platform: false, stripe: false });
  const net = stubFetch();
  try {
    for (let i = 0; i < 10; i++) {
      const r = await post(claim, `cs_test_rl_${i}`);
      assert.equal(r.status, 200);
    }
    const limited = await post(claim, "cs_test_rl_10");
    assert.equal(limited.status, 429);
    assert.equal(limited.json.ok, false);
    assert.match(limited.json.message, /Too many claim attempts/);
    // A different IP still has its own budget.
    const other = await post(claim, "cs_test_rl_other", null, "8.8.8.8");
    assert.equal(other.status, 200);
    assert.equal(net.calls.stripe, 0);
    assert.equal(net.calls.mint, 0);
  } finally {
    net.restore();
    restoreKeys();
  }
});
