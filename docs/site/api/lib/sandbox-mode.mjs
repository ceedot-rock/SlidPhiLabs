/**
 * Sandbox mode 0.1.0 — dry-run quote/settle previews that never move money.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * dryRun(spec) returns a full quote/settle preview with $0 spend:
 * every quote carries amount_cents:0 and mode:'sandbox', spend totals are
 * zero, and no settle adapter is ever invoked. Deterministic and offline:
 * the would-be estimate derives from the spec bytes, never from a rail.
 * Fail-closed: any live/settle adapter in the options is refused with
 * { ok:false } instead of running beside it.
 */
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

/** Deterministic offline would-be estimate from the item's spec bytes. */
function estimateCents(item) {
  const bytes = Buffer.byteLength(JSON.stringify(item ?? null), "utf8");
  return bytes;
}

function previewQuote(item) {
  const src = isPlainObject(item) ? item : { value: item };
  return {
    name: text(src.name || src.kind || src.op || src.task, "item"),
    mode: SANDBOX_MODE,
    amount_cents: 0,
    would_be_cents: estimateCents(src),
  };
}

/**
 * Dry-run a spec: full quote/settle preview, $0 spend, no adapter calls.
 * @param {object} spec quote/settle request shape (must be an object).
 * @param {object} [opts] must NOT carry a live or settle adapter.
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

  const items = Array.isArray(spec.items) ? spec.items : [spec];
  const quotes = items.map(previewQuote);
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
