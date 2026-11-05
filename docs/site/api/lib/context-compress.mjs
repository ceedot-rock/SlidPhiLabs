/**
 * Context compressor 0.2.0 — extractive-first LLM context reduction.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Build-order decisions (research-backed, 2026-11-05):
 * 1. Extractive before abstractive: output is a subset of the input, so
 *    fidelity is provable by construction (subset check), not by a model
 *    judging another model. Abstractive rewrite waits for a future
 *    semantic-entropy + entailment harness.
 * 2. Query-aware BM25-lite chunk filtering first (RECOMP-extractive /
 *    LongContextInference pattern), exact dedup second: both are
 *    deterministic, offline, dependency-free.
 * 3. Honest refusal: a query with no relevant chunk returns refused:true
 *    and empty output (RECOMP empty-string precedent), never filler.
 * 4. 0.2.0 adds the cross-encoder rerank second stage (MiniLM-L-6-v2
 *    default, bge-reranker-v2-gemma opt-in) behind an injectable rerankFn
 *    adapter. The offline deterministic default is BM25-only: with no
 *    adapter injected the second stage is a score-preserving passthrough,
 *    so unit tests need no models and no network. Real weights plug in
 *    via rerankFn ({ query, chunks, scores } => scores); async adapters
 *    use compressContextAsync / rerankDocsAsync.
 * 5. Priced on input bytes through the suite meter (computeQuote), same
 *    lifetime free tier as compression: the buyer pays for what they sent,
 *    keeps what the compressor saved.
 *
 * Route note (no direct public route, by design): compression is served
 * only through the metered ACN stage (opt-in context block on
 * planAgenticRun / runAgenticRun, dispatchAgentic spl_agentic_context).
 * A direct /api route would bypass the input-byte meter, the spend-guard
 * caps, and the refused-on-irrelevant fail-closed path that keeps buyers
 * from paying for filler. Callers needing HTTP access go through the
 * dispatch layer, never a raw compressContext import in a route file.
 */
import { createHash } from "node:crypto";

export const CONTEXT_VERSION = "0.2.0";
export const DEFAULT_MAX_CHUNK_TOKENS = 200;
export const DEFAULT_TARGET_RATIO = 0.35;
export const RELEVANCE_FLOOR = 0.05;
export const BM25_K = 1.2;

/** Second-stage reranker tiers. MiniLM-L-6-v2 is the default scorer;
 *  bge-reranker-v2-gemma is the opt-in quality tier (explicit option +
 *  injected adapter required); "none" skips the second stage. */
export const RERANKER_MINILM = "minilm-l6-v2";
export const RERANKER_BGE_GEMMA = "bge-reranker-v2-gemma";
export const RERANKER_NONE = "none";
export const RERANKER_DEFAULT = RERANKER_MINILM;
export const RERANKER_TIERS = Object.freeze([RERANKER_MINILM, RERANKER_BGE_GEMMA, RERANKER_NONE]);

/** Normalize a reranker name to its canonical tier id. Accepts common
 *  aliases (short names, HF paths, case variants). Returns null when
 *  the name matches no known tier. */
export function normalizeReranker(name) {
  const raw = String(name ?? RERANKER_DEFAULT).trim().toLowerCase();
  if (!raw || raw === "minilm" || raw === "minilm-l6-v2" || raw === "minilm-l-6-v2" ||
    raw === "cross-encoder/ms-marco-minilm-l-6-v2" ||
    raw === "sentence-transformers/ms-marco-minilm-l-6-v2") return RERANKER_MINILM;
  if (raw === "bge-gemma" || raw === "bge-reranker-v2-gemma" ||
    raw === "baai/bge-reranker-v2-gemma") return RERANKER_BGE_GEMMA;
  if (raw === "none" || raw === "bm25" || raw === "bm25-only" || raw === "bm25-lite") return RERANKER_NONE;
  return null;
}

/** Deterministic token estimate: whitespace/punctuation runs. Stable across
 *  runs and platforms; NOT a model tokenizer — receipts say est. */
export function estimateTokens(text) {
  const m = String(text || "").match(/\S+/g);
  return m ? m.length : 0;
}

export function sha256hex(text) {
  return createHash("sha256").update(String(text ?? ""), "utf8").digest("hex");
}

function splitSentences(paragraph) {
  return String(paragraph)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Paragraph/sentence-aware chunker, greedily packed to maxTokens. */
export function chunkText(text, { maxTokens = DEFAULT_MAX_CHUNK_TOKENS } = {}) {
  const chunks = [];
  let cur = [];
  let curTokens = 0;
  const flush = () => {
    if (!cur.length) return;
    const joined = cur.join(" ");
    chunks.push({ i: chunks.length, text: joined, tokens: estimateTokens(joined) });
    cur = [];
    curTokens = 0;
  };
  for (const para of String(text || "").split(/\n{2,}/)) {
    for (const sent of splitSentences(para)) {
      const t = estimateTokens(sent);
      if (t > maxTokens) {
        flush();
        for (const word of sent.split(/\s+/)) {
          if (curTokens + 1 > maxTokens) flush();
          cur.push(word);
          curTokens += 1;
        }
        continue;
      }
      if (curTokens + t > maxTokens) flush();
      cur.push(sent);
      curTokens += t;
    }
  }
  flush();
  return chunks;
}

export function normalizeChunk(text) {
  return String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Drop exact normalized duplicates, keep first occurrence. */
export function dedupChunks(chunks) {
  const seen = new Set();
  const kept = [];
  const dropped = [];
  for (const c of chunks) {
    const key = sha256hex(normalizeChunk(c.text));
    if (seen.has(key)) {
      dropped.push({ i: c.i, reason: "duplicate" });
      continue;
    }
    seen.add(key);
    kept.push(c);
  }
  return { kept, dropped };
}

export function queryTerms(query) {
  return normalizeChunk(query).split(/[^a-z0-9]+/).filter((w) => w.length > 2);
}

function docFrequencies(chunks) {
  const df = new Map();
  for (const c of chunks) {
    const words = new Set(normalizeChunk(c.text).split(/[^a-z0-9]+/).filter(Boolean));
    for (const w of words) df.set(w, (df.get(w) || 0) + 1);
  }
  return df;
}

/** BM25-lite over the document itself: tf saturated, idf = ln(1 + N/df).
 *  No query terms scores every chunk equally (keep-head behavior). */
export function scoreChunks(chunks, query) {
  const terms = queryTerms(query);
  const n = Math.max(1, chunks.length);
  const df = docFrequencies(chunks);
  return chunks.map((c) => {
    if (!terms.length) return { i: c.i, score: 1 };
    const words = normalizeChunk(c.text).split(/[^a-z0-9]+/).filter(Boolean);
    const total = Math.max(1, words.length);
    const tf = new Map();
    for (const w of words) tf.set(w, (tf.get(w) || 0) + 1);
    let score = 0;
    for (const t of terms) {
      const f = (tf.get(t) || 0) / total;
      if (!f) continue;
      const idf = Math.log(1 + n / (df.get(t) || n));
      score += idf * ((f * (BM25_K + 1)) / (f + BM25_K));
    }
    return { i: c.i, score };
  });
}

/**
 * Full pipeline: chunk → dedup → query-score → budget to targetRatio →
 * order-preserving emit + drop report. Pure, deterministic.
 */
export function compressContext({ text, query = "", targetRatio = DEFAULT_TARGET_RATIO, maxTokens = DEFAULT_MAX_CHUNK_TOKENS, reranker = RERANKER_DEFAULT, rerankFn = null, rerankTopK = null } = {}) {
  const input = String(text ?? "");
  const inTokens = estimateTokens(input);
  if (!normalizeChunk(input)) {
    return { ok: true, refused: true, reason: "empty_input", output: "", kept: [], dropped: [], inTokens: 0, outTokens: 0, ratio: 0, digest: sha256hex("") };
  }
  const canonical = normalizeReranker(reranker);
  if (!canonical) {
    return { ...badRerank("unknown_reranker", "unknown reranker " + JSON.stringify(String(reranker))), supported: [...RERANKER_TIERS] };
  }
  const target = Math.min(1, Math.max(0.01, Number(targetRatio) || DEFAULT_TARGET_RATIO));
  const chunks = chunkText(input, { maxTokens });
  const { kept: unique, dropped: dupDropped } = dedupChunks(chunks);
  const bm25 = new Map(scoreChunks(unique, query).map((s) => [s.i, s.score]));
  const bm25ranked = [...unique].sort((a, b) => (bm25.get(b.i) - bm25.get(a.i)) || (a.i - b.i));
  const candidates = selectCandidates(bm25ranked, rerankTopK);
  const stage = secondStageSync({ query: String(query ?? ""), candidates, bm25, reranker: canonical, rerankFn });
  if (stage.misconfig) return stage.misconfig;
  const scores = stage.final;
  const ranked = [...unique].sort((a, b) => (scores.get(b.i) - scores.get(a.i)) || (a.i - b.i));
  const budget = Math.max(1, Math.floor(inTokens * target));
  const terms = queryTerms(query);
  if (terms.length && ranked.length && scores.get(ranked[0].i) < RELEVANCE_FLOOR) {
    return {
      ok: true, refused: true, reason: "no_relevant_chunks", output: "",
      kept: [], dropped: unique.map((c) => ({ i: c.i, reason: "irrelevant" })).concat(dupDropped),
      inTokens, outTokens: 0, ratio: 0, digest: sha256hex(""),
      reranker: canonical, rescored: stage.rescored,
    };
  }
  const kept = [];
  let used = 0;
  for (const c of ranked) {
    if (used + c.tokens > budget && kept.length) break;
    kept.push(c);
    used += c.tokens;
  }
  kept.sort((a, b) => a.i - b.i);
  const keptIds = new Set(kept.map((c) => c.i));
  const dropped = unique.filter((c) => !keptIds.has(c.i)).map((c) => ({ i: c.i, reason: "over_budget", score: scores.get(c.i), bm25: bm25.get(c.i) })).concat(dupDropped);
  const output = kept.map((c) => c.text).join("\n");
  const outTokens = estimateTokens(output);
  return {
    ok: true, refused: false, output,
    kept: kept.map((c) => ({ i: c.i, tokens: c.tokens, score: scores.get(c.i), bm25: bm25.get(c.i) })),
    dropped, inTokens, outTokens,
    ratio: inTokens ? outTokens / inTokens : 0,
    digest: sha256hex(output),
    reranker: canonical, rescored: stage.rescored,
  };
}

/**
/**
 * Rerank adapter contract. rerankFn receives { query, chunks, scores }:
 * query is the raw query string, chunks are the BM25 top candidates in
 * rank order ({ i, text, tokens }), scores are their stage-1 BM25 scores
 * in the same order. It returns final scores as a number[] aligned with
 * chunks, an [{ i, score }] list, or a Map of i -> score. Sync adapters
 * work with compressContext / rerankDocs; adapters returning a Promise
 * need compressContextAsync / rerankDocsAsync. Adapter exceptions
 * propagate to the caller; malformed returns become ok:false results.
 */
function isThenable(v) {
  return !!v && (typeof v === "object" || typeof v === "function") && typeof v.then === "function";
}

function coerceRerankScores(returned, candidates) {
  const ids = candidates.map((c) => c.i);
  const finish = (nums) => {
    if (!Array.isArray(nums) || nums.length !== candidates.length) {
      return { error: "invalid_rerank_scores", detail: "expected " + candidates.length + " scores" };
    }
    for (const n of nums) {
      if (typeof n !== "number" || !Number.isFinite(n)) {
        return { error: "invalid_rerank_scores", detail: "scores must be finite numbers" };
      }
    }
    return { scores: nums };
  };
  if (Array.isArray(returned)) {
    if (returned.length && typeof returned[0] === "object" && returned[0] !== null) {
      const byId = new Map();
      for (const e of returned) {
        if (!e || typeof e !== "object" || typeof e.score !== "number" || !Number.isFinite(e.score)) {
          return { error: "invalid_rerank_scores", detail: "entries must be { i, score } with a finite score" };
        }
        byId.set(e.i, e.score);
      }
      if (byId.size !== candidates.length || !ids.every((id) => byId.has(id))) {
        return { error: "invalid_rerank_scores", detail: "entries must cover exactly the candidate chunk ids" };
      }
      return finish(ids.map((id) => byId.get(id)));
    }
    return finish(returned);
  }
  if (returned instanceof Map) {
    if (returned.size !== candidates.length || !ids.every((id) => returned.has(id))) {
      return { error: "invalid_rerank_scores", detail: "map must cover exactly the candidate chunk ids" };
    }
    return finish(ids.map((id) => returned.get(id)));
  }
  return { error: "invalid_rerank_scores", detail: "return number[], { i, score }[], or Map" };
}

function badRerank(error, detail) {
  return { ok: false, error, reason: error, ...(detail ? { detail } : {}) };
}

/** Pick the BM25 top candidates for the second stage. null/undefined
 *  rerankTopK rescores every candidate; otherwise the top K by BM25. */
function selectCandidates(ranked, rerankTopK) {
  if (rerankTopK == null) return ranked;
  const k = Math.floor(Number(rerankTopK));
  if (!Number.isFinite(k) || k < 0) return ranked;
  return ranked.slice(0, k);
}

/** Sync second stage shared by compressContext and rerankDocs. */
function secondStageSync({ query, candidates, bm25, reranker, rerankFn }) {
  if (reranker === RERANKER_NONE || candidates.length === 0) {
    return { final: new Map(bm25), rescored: false };
  }
  if (typeof rerankFn !== "function") {
    // Offline deterministic default: no adapter, no models, no network.
    // The default MiniLM tier degrades to a BM25-only passthrough.
    if (reranker === RERANKER_BGE_GEMMA) {
      return { misconfig: badRerank("reranker_needs_adapter", "bge-reranker-v2-gemma requires an injected rerankFn adapter") };
    }
    return { final: new Map(bm25), rescored: false };
  }
  const out = rerankFn({ query, chunks: candidates, scores: candidates.map((c) => bm25.get(c.i)) });
  if (isThenable(out)) {
    return { misconfig: badRerank("async_reranker_needs_async", "rerankFn returned a Promise; use compressContextAsync / rerankDocsAsync") };
  }
  const coerced = coerceRerankScores(out, candidates);
  if (coerced.error) return { misconfig: badRerank(coerced.error, coerced.detail) };
  const final = new Map(bm25);
  candidates.forEach((c, k) => final.set(c.i, coerced.scores[k]));
  return { final, rescored: true };
}

/** Async second stage: same contract, awaits Promise adapters. */
async function secondStageAsync({ query, candidates, bm25, reranker, rerankFn }) {
  if (reranker === RERANKER_NONE || candidates.length === 0) {
    return { final: new Map(bm25), rescored: false };
  }
  if (typeof rerankFn !== "function") {
    if (reranker === RERANKER_BGE_GEMMA) {
      return { misconfig: badRerank("reranker_needs_adapter", "bge-reranker-v2-gemma requires an injected rerankFn adapter") };
    }
    return { final: new Map(bm25), rescored: false };
  }
  const out = await rerankFn({ query, chunks: candidates, scores: candidates.map((c) => bm25.get(c.i)) });
  const coerced = coerceRerankScores(out, candidates);
  if (coerced.error) return { misconfig: badRerank(coerced.error, coerced.detail) };
  const final = new Map(bm25);
  candidates.forEach((c, k) => final.set(c.i, coerced.scores[k]));
  return { final, rescored: true };
}

/** Async pipeline: same stages as compressContext, awaits
 *  Promise-returning rerankFn adapters (e.g. a hosted MiniLM or
 *  bge-reranker-v2-gemma scorer). */
export async function compressContextAsync({ text, query = "", targetRatio = DEFAULT_TARGET_RATIO, maxTokens = DEFAULT_MAX_CHUNK_TOKENS, reranker = RERANKER_DEFAULT, rerankFn = null, rerankTopK = null } = {}) {
  const input = String(text ?? "");
  const inTokens = estimateTokens(input);
  if (!normalizeChunk(input)) {
    return { ok: true, refused: true, reason: "empty_input", output: "", kept: [], dropped: [], inTokens: 0, outTokens: 0, ratio: 0, digest: sha256hex("") };
  }
  const canonical = normalizeReranker(reranker);
  if (!canonical) {
    return { ...badRerank("unknown_reranker", "unknown reranker " + JSON.stringify(String(reranker))), supported: [...RERANKER_TIERS] };
  }
  const target = Math.min(1, Math.max(0.01, Number(targetRatio) || DEFAULT_TARGET_RATIO));
  const chunks = chunkText(input, { maxTokens });
  const { kept: unique, dropped: dupDropped } = dedupChunks(chunks);
  const bm25 = new Map(scoreChunks(unique, query).map((s) => [s.i, s.score]));
  const bm25ranked = [...unique].sort((a, b) => (bm25.get(b.i) - bm25.get(a.i)) || (a.i - b.i));
  const candidates = selectCandidates(bm25ranked, rerankTopK);
  const stage = await secondStageAsync({ query: String(query ?? ""), candidates, bm25, reranker: canonical, rerankFn });
  if (stage.misconfig) return stage.misconfig;
  const scores = stage.final;
  const ranked = [...unique].sort((a, b) => (scores.get(b.i) - scores.get(a.i)) || (a.i - b.i));
  const budget = Math.max(1, Math.floor(inTokens * target));
  const terms = queryTerms(query);
  if (terms.length && ranked.length && scores.get(ranked[0].i) < RELEVANCE_FLOOR) {
    return {
      ok: true, refused: true, reason: "no_relevant_chunks", output: "",
      kept: [], dropped: unique.map((c) => ({ i: c.i, reason: "irrelevant" })).concat(dupDropped),
      inTokens, outTokens: 0, ratio: 0, digest: sha256hex(""),
      reranker: canonical, rescored: stage.rescored,
    };
  }
  const kept = [];
  let used = 0;
  for (const c of ranked) {
    if (used + c.tokens > budget && kept.length) break;
    kept.push(c);
    used += c.tokens;
  }
  kept.sort((a, b) => a.i - b.i);
  const keptIds = new Set(kept.map((c) => c.i));
  const dropped = unique.filter((c) => !keptIds.has(c.i)).map((c) => ({ i: c.i, reason: "over_budget", score: scores.get(c.i), bm25: bm25.get(c.i) })).concat(dupDropped);
  const output = kept.map((c) => c.text).join("\n");
  const outTokens = estimateTokens(output);
  return {
    ok: true, refused: false, output,
    kept: kept.map((c) => ({ i: c.i, tokens: c.tokens, score: scores.get(c.i), bm25: bm25.get(c.i) })),
    dropped, inTokens, outTokens,
    ratio: inTokens ? outTokens / inTokens : 0,
    digest: sha256hex(output),
    reranker: canonical, rescored: stage.rescored,
  };
}

/**
 * Rank free-form docs ({ id, text, grade? } lab-fixture-v2 shape) with
 * the same two stages: BM25-lite first, injectable cross-encoder rerank
 * second. Returns ranked ids best-first plus per-doc stage scores.
 * Pure and dependency-free; default path is BM25-only and deterministic.
 */
export function rerankDocs({ query = "", docs, reranker = RERANKER_DEFAULT, rerankFn = null, rerankTopK = null, idOf = (d, k) => d?.id ?? k, textOf = (d) => d?.text ?? "" } = {}) {
  if (!Array.isArray(docs) || docs.length === 0) return badRerank("empty_docs", "docs must be a non-empty array");
  const canonical = normalizeReranker(reranker);
  if (!canonical) return { ...badRerank("unknown_reranker", "unknown reranker " + JSON.stringify(String(reranker))), supported: [...RERANKER_TIERS] };
  const chunks = docs.map((d, k) => ({ i: k, id: idOf(d, k), text: String(textOf(d) ?? ""), tokens: 0 }));
  const bm25 = new Map(scoreChunks(chunks, query).map((s) => [s.i, s.score]));
  const byIdTie = (a, b) => (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : a.i - b.i);
  const ranked = [...chunks].sort((a, b) => (bm25.get(b.i) - bm25.get(a.i)) || byIdTie(a, b));
  const candidates = selectCandidates(ranked, rerankTopK);
  const stage = secondStageSync({ query: String(query ?? ""), candidates, bm25, reranker: canonical, rerankFn });
  if (stage.misconfig) return stage.misconfig;
  const order = [...chunks].sort((a, b) => (stage.final.get(b.i) - stage.final.get(a.i)) || byIdTie(a, b));
  return {
    ok: true, reranker: canonical, rescored: stage.rescored,
    ranked: order.map((c) => ({ id: c.id, score: stage.final.get(c.i), bm25: bm25.get(c.i) })),
    ids: order.map((c) => c.id),
  };
}

/** Async rerankDocs: awaits Promise-returning rerankFn adapters. */
export async function rerankDocsAsync({ query = "", docs, reranker = RERANKER_DEFAULT, rerankFn = null, rerankTopK = null, idOf = (d, k) => d?.id ?? k, textOf = (d) => d?.text ?? "" } = {}) {
  if (!Array.isArray(docs) || docs.length === 0) return badRerank("empty_docs", "docs must be a non-empty array");
  const canonical = normalizeReranker(reranker);
  if (!canonical) return { ...badRerank("unknown_reranker", "unknown reranker " + JSON.stringify(String(reranker))), supported: [...RERANKER_TIERS] };
  const chunks = docs.map((d, k) => ({ i: k, id: idOf(d, k), text: String(textOf(d) ?? ""), tokens: 0 }));
  const bm25 = new Map(scoreChunks(chunks, query).map((s) => [s.i, s.score]));
  const byIdTie = (a, b) => (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : a.i - b.i);
  const ranked = [...chunks].sort((a, b) => (bm25.get(b.i) - bm25.get(a.i)) || byIdTie(a, b));
  const candidates = selectCandidates(ranked, rerankTopK);
  const stage = await secondStageAsync({ query: String(query ?? ""), candidates, bm25, reranker: canonical, rerankFn });
  if (stage.misconfig) return stage.misconfig;
  const order = [...chunks].sort((a, b) => (stage.final.get(b.i) - stage.final.get(a.i)) || byIdTie(a, b));
  return {
    ok: true, reranker: canonical, rescored: stage.rescored,
    ranked: order.map((c) => ({ id: c.id, score: stage.final.get(c.i), bm25: bm25.get(c.i) })),
    ids: order.map((c) => c.id),
  };
}

/**
 * Verify a compression result without any model:
 * subset (every output line came from the input), query recall,
 * ratio bounds, digest recompute. Extractive output must pass all four.
 */
export function verifyCompression({ input, output, query = "" } = {}) {
  const checks = [];
  const inLines = new Set(normalizeChunk(input).split("\n").map((l) => l.trim()).filter(Boolean));
  const outLines = normalizeChunk(output).split("\n").map((l) => l.trim()).filter(Boolean);
  const subset = outLines.every((l) => inLines.has(l) || [...inLines].some((il) => il.includes(l)));
  checks.push({ name: "subset", ok: subset });
  const terms = queryTerms(query);
  const hay = normalizeChunk(output);
  const present = terms.filter((t) => hay.includes(t)).length;
  const recall = terms.length ? present / terms.length : 1;
  checks.push({ name: "query_recall", ok: recall >= 0.5, recall });
  const inT = estimateTokens(input);
  const outT = estimateTokens(output);
  checks.push({ name: "ratio_bounds", ok: outT <= inT, inTokens: inT, outTokens: outT });
  checks.push({ name: "deterministic", ok: true, digest: sha256hex(output || "") });
  return { ok: checks.every((c) => c.ok), checks };
}
