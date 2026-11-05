/**
 * Sandbox mode 0.1.0 — dry-run quote/settle previews that never move money.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * dryRun(spec) returns a full quote/settle preview with $0 spend:
 * every quote carries amount_cents:0 and mode:'sandbox', spend totals are
 * zero, and no settle adapter is ever invoked. Deterministic and offline:
 * the would-be estimate runs the REAL quote math (computeQuote from
 * ../suite-pricing.js: 1 GB free once per IP, then $0.25/GB, $1 card
 * minimum) over each item's input bytes — never a byte-length proxy, never
 * a rail call. Fail-closed: any live/settle adapter in the options is
 * refused with { ok:false } instead of running beside it.
 */
import { computeQuote } from "../suite-pricing.js";

export const SANDBOX_MODE = "sandbox";

/** Option keys that would let a preview touch real money. Refuse them all. */
const LIVE_KEYS = ["settle", "settleAdapter", "settleFn", "payout", "charge", "rail"];

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function text(v, fallback = "item") {
  const s = v == null ? "" : String(v);
  return s === "" ? fallback : s;
}

/**
 * Input bytes for one preview item: explicit byte fields win; otherwise the
 * canonical JSON length stands in as the input size. Pure, deterministic.
 */
export function bytesOf(item) {
  const src = isPlainObject(item) ? item : { value: item };
  for (const key of ["bytes", "input_bytes", "size_bytes"]) {
    const n = Number(src[key]);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return Buffer.byteLength(JSON.stringify(src), "utf8");
}

/**
 * Deterministic offline would-be estimate: the REAL quote math over the
 * item's input bytes (same free cap, rate, and card minimum production
 * charges). quoteFn is injectable (default computeQuote); a throwing or
 * malformed quoter fails safe to 0, never throws.
 */
export function estimateCents(item, quoteFn = computeQuote) {
  try {
    const src = isPlainObject(item) ? item : { value: item };
    const q = quoteFn({
      bytes: bytesOf(src),
      used_bytes: Number(src.used_bytes) || 0,
      sku: typeof src.sku === "string" ? src.sku : "",
      op: typeof src.op === "string" ? src.op : "compress",
      product: typeof src.product === "string" ? src.product : "auto",
    });
    const cents = Math.floor(Number(q && q.amount_cents));
    return Number.isSafeInteger(cents) && cents >= 0 ? cents : 0;
  } catch {
    return 0;
  }
}

function previewQuote(item, quoteFn) {
  const src = isPlainObject(item) ? item : { value: item };
  return {
    name: text(src.name || src.kind || src.op || src.task, "item"),
    mode: SANDBOX_MODE,
    amount_cents: 0,
    would_be_cents: estimateCents(src, quoteFn),
  };
}

/**
 * Dry-run a spec: full quote/settle preview, $0 spend, no adapter calls.
 * @param {object} spec quote/settle request shape (must be an object).
 * @param {object} [opts] must NOT carry a live or settle adapter.
 *   opts.quote injects the quote math (default computeQuote); pricing
 *   context (sku, used_bytes) travels on the items themselves.
 */
export function dryRun(spec, opts = {}) {
  if (!isPlainObject(spec)) return { ok: false, error: "invalid_spec" };
  const o = isPlainObject(opts) ? opts : {};
  for (const key of LIVE_KEYS) {
    if (o[key] != null) return { ok: false, error: "sandbox_refuses_live_adapter" };
  }
  if (o.adapter != null) {
    const a = o.adapter;
    if (isPlainObject(a) && (a.live === true || a.mode === "live")) {
      return { ok: false, error: "sandbox_refuses_live_adapter" };
    }
    if (typeof a === "function") return { ok: false, error: "sandbox_refuses_live_adapter" };
  }
  const quoteFn = o.quote === undefined ? computeQuote : o.quote;
  if (typeof quoteFn !== "function") return { ok: false, error: "invalid_quote_adapter" };

  const items = Array.isArray(spec.items) ? spec.items : [spec];
  const quotes = items.map((item) => previewQuote(item, quoteFn));
  const wouldBeTotal = quotes.reduce((sum, q) => sum + q.would_be_cents, 0);
  return {
    ok: true,
    mode: SANDBOX_MODE,
    spend_cents: 0,
    would_be_cents: wouldBeTotal,
    quotes,
    settle: {
      mode: SANDBOX_MODE,
      amount_cents: 0,
      total_cents: 0,
      touched_adapters: false,
      note: "preview only; no funds moved",
    },
    receipts: [],
  };
}
