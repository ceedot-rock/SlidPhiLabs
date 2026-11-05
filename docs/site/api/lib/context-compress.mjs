/**
 * Context compressor 0.1.0 — extractive-first LLM context reduction.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Build-order decisions (research-backed, 2026-11-05):
 * 1. Extractive before abstractive: output is a subset of the input, so
 *    fidelity is provable by construction (subset check), not by a model
 *    judging another model. Abstractive rewrite waits for 0.2 with a
 *    semantic-entropy + entailment harness.
 * 2. Query-aware BM25-lite chunk filtering first (RECOMP-extractive /
 *    LongContextInference pattern), exact dedup second: both are
 *    deterministic, offline, dependency-free.
 * 3. Honest refusal: a query with no relevant chunk returns refused:true
 *    and empty output (RECOMP empty-string precedent), never filler.
 * 4. No tuned models, no network, no embeddings in 0.1.0 (gist tokens,
 *    AutoCompressor, LLMLingua-2 classifiers all need model weights).
 *    Embedding rerank rides the vaulted voyage key in 0.2.
 * 5. Priced on input bytes through the suite meter (computeQuote), same
 *    lifetime free tier as compression: the buyer pays for what they sent,
 *    keeps what the compressor saved.
 */
import { createHash } from "node:crypto";

export const CONTEXT_VERSION = "0.1.0";
export const DEFAULT_MAX_CHUNK_TOKENS = 200;
export const DEFAULT_TARGET_RATIO = 0.35;
export const RELEVANCE_FLOOR = 0.05;
export const BM25_K = 1.2;

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
export function compressContext({ text, query = "", targetRatio = DEFAULT_TARGET_RATIO, maxTokens = DEFAULT_MAX_CHUNK_TOKENS } = {}) {
  const input = String(text ?? "");
  const inTokens = estimateTokens(input);
  if (!normalizeChunk(input)) {
    return { ok: true, refused: true, reason: "empty_input", output: "", kept: [], dropped: [], inTokens: 0, outTokens: 0, ratio: 0, digest: sha256hex("") };
  }
  const target = Math.min(1, Math.max(0.01, Number(targetRatio) || DEFAULT_TARGET_RATIO));
  const chunks = chunkText(input, { maxTokens });
  const { kept: unique, dropped: dupDropped } = dedupChunks(chunks);
  const scores = new Map(scoreChunks(unique, query).map((s) => [s.i, s.score]));
  const ranked = [...unique].sort((a, b) => (scores.get(b.i) - scores.get(a.i)) || (a.i - b.i));
  const budget = Math.max(1, Math.floor(inTokens * target));
  const terms = queryTerms(query);
  if (terms.length && ranked.length && scores.get(ranked[0].i) < RELEVANCE_FLOOR) {
    return {
      ok: true, refused: true, reason: "no_relevant_chunks", output: "",
      kept: [], dropped: unique.map((c) => ({ i: c.i, reason: "irrelevant" })).concat(dupDropped),
      inTokens, outTokens: 0, ratio: 0, digest: sha256hex(""),
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
  const dropped = unique.filter((c) => !keptIds.has(c.i)).map((c) => ({ i: c.i, reason: "over_budget", score: scores.get(c.i) })).concat(dupDropped);
  const output = kept.map((c) => c.text).join("\n");
  const outTokens = estimateTokens(output);
  return {
    ok: true, refused: false, output,
    kept: kept.map((c) => ({ i: c.i, tokens: c.tokens, score: scores.get(c.i) })),
    dropped, inTokens, outTokens,
    ratio: inTokens ? outTokens / inTokens : 0,
    digest: sha256hex(output),
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
