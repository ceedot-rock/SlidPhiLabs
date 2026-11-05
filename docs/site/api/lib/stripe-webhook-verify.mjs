/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * Stripe webhook signature verification + sale extraction (pure, offline).
 *
 * Stripe scheme: header "Stripe-Signature: t=<unix>,v1=<hmac-hex>[,v0=...]".
 * Signed payload is `<t>.<raw-body-bytes>` with HMAC-SHA256 keyed by the
 * endpoint's signing secret (whsec_...). At least one v1 entry must match
 * with timing-safe compare, and |now - t| must be within tolerance.
 *
 * 0.1.0: checkout.session.completed only. Everything else is acked ignored.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const STRIPE_WEBHOOK_VERSION = "0.1.0";
export const DEFAULT_TOLERANCE_SEC = 300;

/** Parse "t=..,v1=..[,v1=..][,v0=..]" into { t, v1: [] }. Returns null on garbage. */
export function parseStripeSignatureHeader(header) {
  if (!header || typeof header !== "string") return null;
  let t = null;
  const v1 = [];
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq < 1) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k === "t" && /^\d+$/.test(v)) t = Number(v);
    else if (k === "v1" && /^[a-f0-9]{64}$/i.test(v)) v1.push(v.toLowerCase());
  }
  if (t === null || v1.length === 0) return null;
  return { t, v1 };
}

/**
 * Verify a Stripe webhook delivery. rawBody: Buffer|string of exact request bytes.
 * Returns { ok:true, t } or { ok:false, reason } — never throws on bad input.
 */
export function verifyStripeSignature(rawBody, header, secret, opts = {}) {
  const toleranceSec = Number(opts.toleranceSec ?? DEFAULT_TOLERANCE_SEC);
  const nowSec = Number(opts.nowSec ?? Math.floor(Date.now() / 1000));
  if (!secret || typeof secret !== "string") return { ok: false, reason: "missing_secret" };
  const parsed = parseStripeSignatureHeader(header);
  if (!parsed) return { ok: false, reason: "bad_header" };
  if (!Number.isFinite(nowSec) || Math.abs(nowSec - parsed.t) > toleranceSec) {
    return { ok: false, reason: "stale_timestamp" };
  }
  const raw = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody ?? ""), "utf8");
  const payload = Buffer.concat([Buffer.from(String(parsed.t), "utf8"), Buffer.from("."), raw]);
  for (const sig of parsed.v1) {
    const expect = createHmac("sha256", secret).update(payload).digest();
    let got;
    try {
      got = Buffer.from(sig, "hex");
    } catch {
      continue;
    }
    if (got.length === expect.length && timingSafeEqual(got, expect)) {
      return { ok: true, t: parsed.t };
    }
  }
  return { ok: false, reason: "bad_signature" };
}

/**
 * Extract a ledger sale from a verified event. Returns { sale } for
 * checkout.session.completed, { ignored:true } otherwise. Never throws.
 */
export function extractStripeSale(event) {
  if (!event || typeof event !== "object") return { ignored: true, reason: "bad_event" };
  if (event.type !== "checkout.session.completed") return { ignored: true, reason: "unhandled_type" };
  const s = event.data && event.data.object ? event.data.object : {};
  if (s.payment_status && s.payment_status !== "paid") return { ignored: true, reason: "unpaid" };
  const meta = s.metadata && typeof s.metadata === "object" ? s.metadata : {};
  return {
    sale: {
      sku: String(meta.sku || s.client_reference_id || "unknown"),
      amountCents: Math.round(Number(s.amount_total) || 0),
      currency: String(s.currency || "usd").toLowerCase(),
      orderId: String(s.id || ""),
      rail: "stripe",
    },
  };
}
