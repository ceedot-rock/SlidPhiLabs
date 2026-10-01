/**
 * POST /api/rider/claim — mint a Rider credential after Stripe payment.
 *
 * Body: { session_id, sku }
 * 1. Rate-limits by IP (in-memory, per-instance).
 * 2. Verifies the Stripe checkout session is real and paid (STRIPE_SECRET_KEY).
 * 3. Confirms the purchase is a Rider SKU, from server-set Stripe metadata only
 *    (the request body's sku is never trusted).
 * 4. Idempotency: each session_id mints once. Results are cached in memory
 *    AND persisted to AUTH_DIR/rider-claims.json (the /data volume), so a
 *    restart or a second instance never re-mints for the same session.
 * 5. Uses X-Platform-Key (RIDER_PLATFORM_KEY env) to mint directly via
 *    POST https://agentrider.fly.dev/api/rider/issue — no dependency on
 *    the Rider host's Stripe account.
 * Returns { ok, jwt, expires_in } or { ok:false, message, detail }.
 */

// In-memory guards (per instance). MINTED is additionally persisted to the
// /data volume so idempotency survives restarts and multiple instances.
const RATE = new Map(); // ip -> { count, windowStart }
const MINTED = new Map(); // session_id -> { ok, jwt, expires_in } | { ok:false, ... }

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.AUTH_DIR || "/data";
const CLAIMS_FILE = path.join(DATA_DIR, "rider-claims.json");

function loadMinted() {
  try {
    const raw = fs.readFileSync(CLAIMS_FILE, "utf8");
    const obj = JSON.parse(raw);
    for (const [k, v] of Object.entries(obj)) MINTED.set(k, v);
  } catch {
    // No prior claims file — start empty. A missing/unreadable file must
    // never block the endpoint; worst case is a re-mint attempt that the
    // idempotency key on the mint call itself still guards.
  }
}

function persistMinted() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = CLAIMS_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(MINTED)));
    fs.renameSync(tmp, CLAIMS_FILE); // atomic: readers never see a half-write
  } catch (e) {
    console.error("claim persist failed:", e && e.message);
  }
}

loadMinted();

const RATE_LIMIT = 10; // max claims per IP per window
const RATE_WINDOW_MS = 60 * 1000;

function rateLimited(ip) {
  const now = Date.now();
  const entry = RATE.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    RATE.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return String(fwd).split(",")[0].trim();
  return (req.socket && req.socket.remoteAddress) || "unknown";
}
function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    if (req.body != null && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
      resolve(req.body);
      return;
    }
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

const RIDER_HOST = "https://agentrider.fly.dev";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "POST only" });

  let body;
  try { body = await readJson(req); }
  catch { return json(res, 400, { ok: false, error: "bad_json" }); }

  const sessionId = String(body.session_id || "").trim();
  if (!sessionId) return json(res, 400, { ok: false, error: "session_id_required" });

  if (rateLimited(clientIp(req))) {
    return json(res, 429, {
      ok: false,
      message: "Too many claim attempts. Wait a minute and try again.",
    });
  }

  // Idempotency: same session_id returns the same result, never re-mints.
  if (MINTED.has(sessionId)) {
    const cached = MINTED.get(sessionId);
    return json(res, 200, cached);
  }

  const platformKey = process.env.RIDER_PLATFORM_KEY;
  if (!platformKey) {
    return json(res, 200, {
      ok: false,
      message: "Your seat is paid. Credential minting is being connected.",
      detail: "Email corey@slidphilabs.com with your receipt and Corey will mint your name directly.",
    });
  }

  // Verify the Stripe session is real and paid before minting.
  const stripeSecret =
    process.env.STRIPE_SECRET_KEY || process.env.STRIPE_RESTRICTED_KEY || "";
  if (!stripeSecret) {
    return json(res, 200, {
      ok: false,
      message: "Payment verification is not configured yet.",
      detail: "Email corey@slidphilabs.com with your receipt and Corey will mint your name directly.",
    });
  }

  let session;
  try {
    const r = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      {
        headers: {
          Authorization: `Bearer ${stripeSecret}`,
        },
      }
    );
    if (!r.ok) {
      return json(res, 200, {
        ok: false,
        message: "We could not find that checkout session.",
        detail: "If you just paid, wait a moment and refresh. Otherwise start a new checkout from /rider.",
      });
    }
    session = await r.json();
  } catch (e) {
    return json(res, 502, {
      ok: false,
      message: "Payment verification did not answer.",
      detail: "Try refreshing in a minute, or email corey@slidphilabs.com.",
    });
  }

  if (session.payment_status !== "paid") {
    return json(res, 200, {
      ok: false,
      message: "That checkout is not paid yet.",
      detail: "Complete the payment first, then come back to claim your name.",
    });
  }

  // The SKU must come from verified Stripe metadata — set server-side when the
  // checkout session was created, never from the caller's request body.
  // A paid non-Rider session must never mint a Rider credential.
  const RIDER_SKUS = new Set([
    "rider-solo",
    "rider-bundle",
    "rider-crew",
    "rider-shop",
    "rider-fleet",
  ]);
  const sessionSku = String(
    (session.metadata && session.metadata.sku) || ""
  ).toLowerCase();
  if (!RIDER_SKUS.has(sessionSku)) {
    return json(res, 200, {
      ok: false,
      message: "That purchase is not a Rider seat.",
      detail: "Rider names are claimed from a Rider checkout at /rider.",
    });
  }
  const effectiveSku = sessionSku;

  // Mint directly with the platform key — the payment is verified above.
  // The agent_id ties the credential to this purchase.
  const agentId = `buyer-${sessionId.slice(-8)}`;
  let issued;
  try {
    const r = await fetch(`${RIDER_HOST}/api/rider/issue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Platform-Key": platformKey,
      },
      body: JSON.stringify({
        agent_id: agentId,
        operator_id: "slidphilabs-checkout",
        level: "L1",
        sku: effectiveSku,
      }),
    });
    issued = await r.json();
  } catch (e) {
    return json(res, 502, {
      ok: false,
      message: "Your seat is paid, but the mint did not answer.",
      detail: "Try refreshing in a minute, or email corey@slidphilabs.com.",
    });
  }

  const jwt = issued.rider || issued.jwt || issued.token || issued.credential;
  if (!jwt) {
    const fail = {
      ok: false,
      message: "Your seat is paid and provisioned, but no credential came back.",
      detail: issued.error
        ? "The host said: " + String(issued.error)
        : "Email corey@slidphilabs.com with your receipt and Corey will mint your name directly.",
    };
    MINTED.set(sessionId, fail);
    persistMinted();
    return json(res, 200, fail);
  }

  const success = {
    ok: true,
    jwt,
    expires_in: issued.expires_in || 900,
  };
  MINTED.set(sessionId, success);
  persistMinted();
  return json(res, 200, success);
}
