/**
 * Stateless x402 Access claim tokens (HMAC).
 * spl1.<base64url(payload)>.<base64url(hmac-sha256)>
 *
 * Secret: X402_CLAIM_SECRET || STRIPE_SECRET_KEY || STRIPE_RESTRICTED_KEY
 */
import crypto from "crypto";

const TTL_SEC = 60 * 60 * 24 * 45; // 45 days

export function claimSecret() {
  return (
    process.env.X402_CLAIM_SECRET ||
    process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_RESTRICTED_KEY ||
    process.env.CLAIM_HMAC_SECRET ||
    ""
  );
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function b64urlJson(obj) {
  return b64url(JSON.stringify(obj));
}

function hmac(secret, body) {
  return b64url(crypto.createHmac("sha256", secret).update(body).digest());
}

/**
 * @param {object} fields
 * @param {string} fields.order_id
 * @param {string} fields.sku
 * @param {string|null} [fields.email]
 * @param {string|null} [fields.tx]
 * @param {string|null} [fields.network]
 * @param {number} [fields.amount_cents]
 */
export function signClaim(fields) {
  const secret = claimSecret();
  if (!secret) return { ok: false, error: "claim_secret_missing" };
  const iat = Math.floor(Date.now() / 1000);
  const payload = {
    v: 1,
    rail: "x402",
    order_id: String(fields.order_id || ""),
    sku: String(fields.sku || "").toLowerCase(),
    email: fields.email || null,
    tx: fields.tx || null,
    network: fields.network || null,
    amount_cents:
      typeof fields.amount_cents === "number" ? fields.amount_cents : null,
    iat,
    exp: iat + TTL_SEC,
  };
  if (!payload.order_id || !payload.sku) {
    return { ok: false, error: "claim_fields_incomplete" };
  }
  const body = b64urlJson(payload);
  const sig = hmac(secret, body);
  return {
    ok: true,
    token: `spl1.${body}.${sig}`,
    payload,
    expires_at: new Date(payload.exp * 1000).toISOString(),
  };
}

export function verifyClaim(token) {
  const secret = claimSecret();
  if (!secret) return { ok: false, error: "claim_secret_missing" };
  const raw = String(token || "").trim();
  const parts = raw.split(".");
  if (parts.length !== 3 || parts[0] !== "spl1") {
    return { ok: false, error: "claim_malformed" };
  }
  const [, body, sig] = parts;
  const expect = hmac(secret, body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: "claim_bad_sig" };
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    try {
      const pad = body + "=".repeat((4 - (body.length % 4)) % 4);
      payload = JSON.parse(
        Buffer.from(pad.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
      );
    } catch {
      return { ok: false, error: "claim_bad_payload" };
    }
  }
  if (!payload || payload.v !== 1 || payload.rail !== "x402") {
    return { ok: false, error: "claim_bad_version" };
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) {
    return { ok: false, error: "claim_expired", payload };
  }
  if (!payload.order_id || !payload.sku) {
    return { ok: false, error: "claim_incomplete", payload };
  }
  return { ok: true, payload };
}
