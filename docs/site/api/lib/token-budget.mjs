/**
 * Token budget 0.1.0 — ACN-native token thrift: per-agent budgets plus
 * memoized compression receipts so a run never pays twice for the same input.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Three primitives, all deterministic and offline:
 * 1. Budget tracker: createTokenBudget({ capTokens }) charges estimated
 *    tokens per key (rider id). Warns at 0.8 (same fraction as the
 *    tollkeeper spend-guard), fails closed at 1.0 with budget_exceeded.
 * 2. Memo store: digest -> compression receipt. memoizedCompress looks the
 *    input digest up first; a memo_hit returns the stored receipt with zero
 *    recompute tokens. Bounded (FIFO evict past 500 entries) so the memo
 *    itself cannot grow without limit.
 * 3. truncateToBudget: keeps highest-score chunks inside a token budget and
 *    reports kept/dropped. Score source is the caller's (usually the
 *    compressor's rerank scores); ties break by chunk index for determinism.
 *
 * Route note: served only through the metered ACN token-budget stage
 * (opt-in tokenBudget block on planAgenticRun / runAgenticRun). No direct
 * public route: a raw endpoint would bypass the rider identity the budget
 * is keyed on. Estimates are whitespace runs (est.), same convention as
 * context-compress; receipts say est.
 */
import { estimateTokens, sha256hex } from "./context-compress.mjs";

export const TOKEN_BUDGET_VERSION = "0.1.0";
export const BUDGET_WARN_FRACTION = 0.8;
export const MEMO_MAX_ENTRIES = 500;

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Default in-memory usage store: key -> used est. tokens. */
export function createMemoryUsageStore() {
  const used = new Map();
  return {
    load(key) { return used.get(key) || 0; },
    save(key, tokens) { used.set(key, tokens); },
  };
}

/** Default in-memory memo store: digest -> receipt, FIFO-capped. */
export function createMemoryMemoStore() {
  const order = [];
  const byDigest = new Map();
  return {
    lookup(digest) { return byDigest.has(digest) ? byDigest.get(digest) : null; },
    record(digest, receipt) {
      if (!byDigest.has(digest)) order.push(digest);
      byDigest.set(digest, receipt);
      while (order.length > MEMO_MAX_ENTRIES) byDigest.delete(order.shift());
    },
  };
}

/** Per-agent token budget. charge() fails closed once the cap is hit. */
export function createTokenBudget({ capTokens = 0, warnFraction = BUDGET_WARN_FRACTION, store } = {}) {
  const cap = num(capTokens, 0);
  const warnAt = Math.min(1, Math.max(0, num(warnFraction, BUDGET_WARN_FRACTION)));
  const usage = store && typeof store.load === "function" && typeof store.save === "function"
    ? store
    : createMemoryUsageStore();
  const keyOf = (key) => String(key ?? "anon").trim() || "anon";
  function status(key) {
    const k = keyOf(key);
    const used = num(usage.load(k), 0);
    const fraction = cap > 0 ? used / cap : 0;
    return {
      ok: true, key: k, used_tokens: used, cap_tokens: cap, fraction,
      remaining_tokens: Math.max(0, cap - used),
      warn: cap > 0 && fraction >= warnAt && fraction < 1,
    };
  }
  function charge(key, tokens) {
    const est = Math.max(0, Math.floor(num(tokens, 0)));
    const k = keyOf(key);
    const used = num(usage.load(k), 0);
    if (cap > 0 && used + est > cap) {
      return { ok: false, error: "budget_exceeded", key: k, used_tokens: used, cap_tokens: cap, wanted_tokens: est };
    }
    usage.save(k, used + est);
    return { ...status(k), charged_tokens: est };
  }
  return { cap_tokens: cap, warn_fraction: warnAt, status, charge };
}

/**
 * Memoized compression: digest lookup first, compressFn only on miss.
 * Returns { ok:true, hit:true|false, receipt, recompute_tokens } where
 * recompute_tokens is 0 on a hit (nothing re-spent).
 */
export function memoizedCompress({ text = "", query = "", digest } = {}, { memo, compressFn } = {}) {
  const input = String(text);
  const d = typeof digest === "string" && digest ? digest : sha256hex(query + "\n" + input);
  const store = memo && typeof memo.lookup === "function" && typeof memo.record === "function"
    ? memo
    : createMemoryMemoStore();
  const hit = store.lookup(d);
  if (hit) return { ok: true, hit: true, receipt: hit, recompute_tokens: 0, digest: d };
  if (typeof compressFn !== "function") return { ok: false, error: "adapter_required", digest: d };
  let receipt;
  try {
    receipt = compressFn({ text: input, query });
  } catch (e) {
    return { ok: false, error: "compress_failed", detail: String((e && e.message) || e).slice(0, 200), digest: d };
  }
  if (!receipt || receipt.ok !== true) {
    return { ok: false, error: (receipt && (receipt.reason || receipt.error)) || "compress_failed", digest: d };
  }
  store.record(d, receipt);
  return { ok: true, hit: false, receipt, recompute_tokens: estimateTokens(input), digest: d };
}

/**
 * Keep highest-score chunks inside budgetTokens (est.). Each chunk is
 * { text, score?, i? }. Returns { ok:true, kept, dropped, kept_tokens }.
 */
export function truncateToBudget(chunks, budgetTokens) {
  if (!Array.isArray(chunks)) return { ok: false, error: "bad_chunks" };
  const budget = Math.max(0, Math.floor(num(budgetTokens, 0)));
  const scored = chunks.map((c, n) => {
    const o = c && typeof c === "object" ? c : { text: String(c ?? "") };
    const text = String(o.text ?? "");
    return { text, score: num(o.score, 0), i: Number.isFinite(o.i) ? o.i : n, tokens: estimateTokens(text) };
  }).sort((a, b) => (b.score - a.score) || (a.i - b.i));
  const kept = [];
  let keptTokens = 0;
  for (const c of scored) {
    if (keptTokens + c.tokens <= budget) { kept.push(c); keptTokens += c.tokens; }
  }
  kept.sort((a, b) => a.i - b.i);
  const keptSet = new Set(kept);
  return {
    ok: true, kept: kept.map((c) => c.text), kept_tokens: keptTokens,
    dropped: scored.filter((c) => !keptSet.has(c)).map((c) => c.text),
  };
}
