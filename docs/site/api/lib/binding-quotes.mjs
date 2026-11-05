/**
 * Binding quotes 0.1.0 — quote lock + honor check for priced runs.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * createQuote locks { quote_id, spec_hash, amount_cents, expires_at } over
 * a spec. honorQuote re-hashes the spec and compares the live price:
 * the live price must equal the locked price or the quote fails closed
 * with "price_changed" — no tolerance, no repricing. Deterministic and
 * offline (node:crypto only); the clock is injectable via opts.nowMs.
 * Check order in honorQuote: invalid_quote, invalid_spec,
 * invalid_amount, spec_mismatch, quote_expired, price_changed.
 * expires_at is inclusive: nowMs === expires_at is still valid.
 */

import { createHash } from "node:crypto";

export const BINDING_QUOTES_VERSION = "0.1.0";
export const DEFAULT_QUOTE_TTL_MS = 15 * 60 * 1000;

const HEX64 = /^[0-9a-f]{64}$/;

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function validAmount(v) {
  return Number.isSafeInteger(v) && v >= 0;
}

/** Canonical JSON: object keys sorted recursively, arrays preserved. */
function canonicalize(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonicalize).join(",")}]`;
  const keys = Object.keys(v).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(v[k])}`).join(",")}}`;
}

/** sha256 hex of the canonical form of a plain-object spec. */
export function specHash(spec) {
  const canon = canonicalize(spec);
  return createHash("sha256")
    .update(typeof canon === "string" ? canon : "null", "utf8")
    .digest("hex");
}

function toNowMs(v) {
  const n = Number(v);
  if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  return Date.now();
}

function toTtlMs(v) {
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return DEFAULT_QUOTE_TTL_MS;
}

function validQuote(q) {
  return (
    isPlainObject(q) &&
    typeof q.quote_id === "string" &&
    q.quote_id !== "" &&
    typeof q.spec_hash === "string" &&
    HEX64.test(q.spec_hash) &&
    validAmount(q.amount_cents) &&
    Number.isFinite(q.expires_at)
  );
}

/**
 * Lock a quote over a spec.
 * @param {object} spec plain-object run spec.
 * @param {number} amount_cents non-negative safe integer.
 * @param {object} [opts] { nowMs?, ttlMs?, quoteId? } all injectable.
 */
export function createQuote(spec, amount_cents, opts = {}) {
  if (!isPlainObject(spec)) return { ok: false, error: "invalid_spec" };
  if (!validAmount(amount_cents)) return { ok: false, error: "invalid_amount" };
  const o = isPlainObject(opts) ? opts : {};
  const nowMs = toNowMs(o.nowMs);
  const ttlMs = toTtlMs(o.ttlMs);
  let hash;
  try {
    hash = specHash(spec);
  } catch {
    return { ok: false, error: "invalid_spec" };
  }
  const quote_id =
    typeof o.quoteId === "string" && o.quoteId !== ""
      ? o.quoteId
      : `q_${createHash("sha256").update(`${hash}:${nowMs}`, "utf8").digest("hex").slice(0, 12)}`;
  return {
    ok: true,
    quote: { quote_id, spec_hash: hash, amount_cents, expires_at: nowMs + ttlMs },
  };
}

/**
 * Honor a locked quote against a live spec + live price. Fail-closed:
 * any mismatch returns { ok:false, error }, never throws, never reprices.
 */
export function honorQuote(quote, spec, liveAmountCents, opts = {}) {
  if (!validQuote(quote)) return { ok: false, error: "invalid_quote" };
  if (!isPlainObject(spec)) return { ok: false, error: "invalid_spec" };
  if (!validAmount(liveAmountCents)) return { ok: false, error: "invalid_amount" };
  const o = isPlainObject(opts) ? opts : {};
  const nowMs = toNowMs(o.nowMs);
  let hash;
  try {
    hash = specHash(spec);
  } catch {
    return { ok: false, error: "invalid_spec" };
  }
  if (hash !== quote.spec_hash) return { ok: false, error: "spec_mismatch" };
  if (nowMs > quote.expires_at) return { ok: false, error: "quote_expired" };
  if (liveAmountCents !== quote.amount_cents) {
    return { ok: false, error: "price_changed" };
  }
  return { ok: true, quote: { ...quote } };
}
