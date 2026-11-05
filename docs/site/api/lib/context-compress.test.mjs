/** Context compressor 0.2.0 tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { join } from "node:path";
import {
  estimateTokens, sha256hex, chunkText, dedupChunks, queryTerms,
  scoreChunks, compressContext, compressContextAsync, rerankDocs, rerankDocsAsync,
  normalizeReranker, verifyCompression, CONTEXT_VERSION,
  RERANKER_DEFAULT, RERANKER_MINILM, RERANKER_BGE_GEMMA, RERANKER_NONE, RERANKER_TIERS,
} from "./context-compress.mjs";

const DOC = [
  "The quick brown fox jumps over the lazy dog near the river bank.",
  "Quantum error correction protects fragile qubits from decoherence noise.",
  "The quick brown fox jumps over the lazy dog near the river bank.",
  "Pack my box with five dozen liquor jugs for the moving van tomorrow.",
  "Quantum error correction protects fragile qubits from decoherence noise.",
  "Sourdough starter needs daily feeding with flour and warm water.",
].join("\n\n");

test("version pinned", () => assert.equal(CONTEXT_VERSION, "0.2.0"));

test("token estimate deterministic", () => {
  assert.equal(estimateTokens(DOC), estimateTokens(DOC));
  assert.ok(estimateTokens(DOC) > 50);
  assert.equal(estimateTokens(""), 0);
});

test("chunker packs and covers all text", () => {
  const chunks = chunkText(DOC, { maxTokens: 20 });
  assert.ok(chunks.length >= 3);
  for (const c of chunks) assert.ok(c.tokens <= 20, JSON.stringify(c));
  const rejoined = chunks.map((c) => c.text).join(" ");
  for (const w of ["Quantum", "Sourdough", "liquor"]) assert.ok(rejoined.includes(w));
});

test("dedup drops exact repeats, keeps first", () => {
  const { kept, dropped } = dedupChunks([
    { i: 0, text: "hello world", tokens: 2 },
    { i: 1, text: "other words here", tokens: 3 },
    { i: 2, text: "  Hello   WORLD ", tokens: 2 },
  ]);
  assert.equal(kept.length, 2);
  assert.equal(kept[0].i, 0);
  assert.equal(dropped.length, 1);
  assert.deepEqual(dropped[0], { i: 2, reason: "duplicate" });
});

test("scoring ranks query-relevant chunks first", () => {
  const chunks = chunkText(DOC, { maxTokens: 20 });
  const scores = scoreChunks(chunks, "quantum error correction qubits");
  const top = [...scores].sort((a, b) => b.score - a.score)[0];
  assert.ok(chunks[top.i].text.includes("Quantum"));
  const flat = scoreChunks(chunks, "");
  assert.ok(flat.every((s) => s.score === 1));
});

test("compress hits budget and preserves order", () => {
  const r = compressContext({ text: DOC, query: "sourdough starter feeding", targetRatio: 0.35, maxTokens: 20 });
  assert.equal(r.ok, true);
  assert.equal(r.refused, false);
  assert.ok(r.ratio <= 0.45, "ratio " + r.ratio);
  assert.ok(r.output.includes("Sourdough"));
  const ids = r.kept.map((k) => k.i);
  assert.deepEqual(ids, [...ids].sort((a, b) => a - b));
  assert.equal(r.digest, sha256hex(r.output));
});

test("refuses honestly on empty and irrelevant", () => {
  const e = compressContext({ text: "   \n  ", query: "anything" });
  assert.equal(e.refused, true);
  assert.equal(e.reason, "empty_input");
  assert.equal(e.output, "");
  const ir = compressContext({ text: DOC, query: "xylophone zebra granite" });
  assert.equal(ir.refused, true);
  assert.equal(ir.reason, "no_relevant_chunks");
});

test("verify passes honest output, catches tampering", () => {
  const r = compressContext({ text: DOC, query: "liquor jugs box", targetRatio: 0.5, maxTokens: 20 });
  const v = verifyCompression({ input: DOC, output: r.output, query: "liquor jugs box" });
  assert.equal(v.ok, true);
  assert.ok(v.checks.every((c) => c.ok));
  const bad = verifyCompression({ input: DOC, output: r.output + "\nThe moon is made of green cheese.", query: "liquor" });
  assert.equal(bad.ok, false);
  assert.equal(bad.checks.find((c) => c.name === "subset").ok, false);
});

test("deterministic: same input same digest", () => {
  const a = compressContext({ text: DOC, query: "fox dog", targetRatio: 0.4, maxTokens: 20 });
  const b = compressContext({ text: DOC, query: "fox dog", targetRatio: 0.4, maxTokens: 20 });
  assert.equal(a.digest, b.digest);
  assert.equal(a.output, b.output);
});

// ---- ACN stage wiring (opt-in; defaults frozen) ----

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "acn-context-"));
process.env.WARRANT_DIR = join(dir, "w");
process.env.WARRANT_SECRET = "context-test-secret-min-32-bytes!!";

const {
  planAgenticRun, runAgenticRun, dispatchAgentic, AGENTILL_MAP,
} = await import("./agentic-platform.mjs");

test("plan default has no context stage", () => {
  const p = planAgenticRun({ demo: true, action: "fetch", host: "h.test", url: "https://example.com/a" });
  assert.deepEqual(p.plan.stages, ["rider", "warrant", "tollkeeper", "quikgater", "pcc", "awlpay", "psi", "conductor"]);
  assert.equal("context" in p.plan, false);
});

test("plan with context adds stage plus preview", () => {
  const p = planAgenticRun({ demo: true, action: "fetch", host: "h.test", context: { text: DOC, query: "sourdough", targetRatio: 0.5, maxTokens: 20 } });
  assert.deepEqual(p.plan.stages, ["rider", "warrant", "tollkeeper", "quikgater", "context", "pcc", "awlpay", "psi", "conductor"]);
  assert.equal(p.plan.context.refused, false);
  assert.ok(p.plan.context.ratio < 1);
  assert.match(p.plan.context.digest, /^[a-f0-9]{64}$/);
});

test("run compresses then meters shipped bytes", async () => {
  const spec = { demo: true, action: "fetch", host: "h.test", context: { text: DOC, query: "quantum qubits", targetRatio: 0.4, maxTokens: 20 } };
  const r = await runAgenticRun(spec, { settleFn: async (i) => ({ captured: true }) });
  assert.equal(r.ok, true);
  const ctx = r.receipts.find((s) => s.stage === "context");
  assert.equal(ctx.ok, true);
  assert.equal(ctx.verified, true);
  assert.equal(ctx.toolVersion, "0.2.0");
  const pcc = r.receipts.find((s) => s.stage === "pcc");
  assert.ok(pcc.bytes > 0);
  assert.ok(pcc.bytes < Buffer.byteLength(DOC));
});

test("run refuses on irrelevant query", async () => {
  const r = await runAgenticRun(
    { demo: true, action: "fetch", host: "h.test", context: { text: DOC, query: "xylophone zebra granite", maxTokens: 20 } }, {}
  );
  assert.equal(r.ok, false);
  assert.equal(r.stage, "context");
  assert.equal(r.reason, "no_relevant_chunks");
});

test("run compresses fetched body when no text given", async () => {
  const body = "Alpha beta gamma delta. ".repeat(40) + "Needle haystack question answer. ".repeat(4);
  const fetch402 = async () => ({ status: 200, body });
  const r = await runAgenticRun(
    { demo: true, action: "fetch", host: "h.test", url: "https://example.com/big", context: { query: "needle answer", targetRatio: 0.3, maxTokens: 30 } },
    { fetch402, settleFn: async (i) => ({ captured: true }) }
  );
  assert.equal(r.ok, true);
  const ctx = r.receipts.find((s) => s.stage === "context");
  assert.ok(ctx.outTokens < ctx.inTokens);
});

test("dispatch context tool quotes on input bytes", async () => {
  const r = await dispatchAgentic("spl_agentic_context", { text: DOC, query: "fox", targetRatio: 0.5, maxTokens: 20 });
  assert.equal(r.ok, true);
  assert.equal(r.stage, "context");
  assert.equal(r.verified, true);
  assert.ok(r.quote && typeof r.quote.amount_cents === "number");
  const bad = await dispatchAgentic("spl_agentic_context", { text: DOC, query: "xylophone zebra granite", maxTokens: 20 });
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, "no_relevant_chunks");
});

test("agentill map covers context", () => {
  assert.ok("context" in AGENTILL_MAP);
});

// ---- 0.2.0 second-stage rerank (MiniLM default, bge-gemma opt-in) ----

const TINY = [
  "Quantum error correction protects fragile qubits from decoherence noise.",
  "Sourdough starter needs daily feeding with flour and warm water.",
  "Pack my box with five dozen liquor jugs for the moving van tomorrow.",
].join("\n\n");

const tinyOpts = { text: TINY, query: "quantum error correction qubits", targetRatio: 0.9, maxTokens: 50 };

test("rerank tier ids are pinned", () => {
  assert.equal(RERANKER_DEFAULT, "minilm-l6-v2");
  assert.equal(RERANKER_MINILM, "minilm-l6-v2");
  assert.equal(RERANKER_BGE_GEMMA, "bge-reranker-v2-gemma");
  assert.equal(RERANKER_NONE, "none");
  assert.deepEqual([...RERANKER_TIERS], ["minilm-l6-v2", "bge-reranker-v2-gemma", "none"]);
});

test("rerank names normalize across aliases", () => {
  assert.equal(normalizeReranker(undefined), "minilm-l6-v2");
  assert.equal(normalizeReranker("MiniLM-L-6-v2"), "minilm-l6-v2");
  assert.equal(normalizeReranker("cross-encoder/ms-marco-MiniLM-L-6-v2"), "minilm-l6-v2");
  assert.equal(normalizeReranker("bge-gemma"), "bge-reranker-v2-gemma");
  assert.equal(normalizeReranker("BAAI/bge-reranker-v2-gemma"), "bge-reranker-v2-gemma");
  assert.equal(normalizeReranker("bm25"), "none");
  assert.equal(normalizeReranker("nope"), null);
});

test("default path is offline BM25-only with deterministic vectors", () => {
  const r = compressContext(tinyOpts);
  assert.equal(r.ok, true);
  assert.equal(r.refused, false);
  assert.equal(r.reranker, "minilm-l6-v2");
  assert.equal(r.rescored, false);
  assert.equal(r.kept.length, 1);
  assert.equal(r.kept[0].score, r.kept[0].bm25);
  assert.ok(Math.abs(r.kept[0].score - 0.15481459870374414) < 1e-12, "pinned BM25 vector, got " + r.kept[0].score);
  const again = compressContext(tinyOpts);
  assert.deepEqual(again.kept, r.kept);
  assert.equal(again.digest, r.digest);
  const none = compressContext({ ...tinyOpts, reranker: "none" });
  assert.equal(none.rescored, false);
  assert.deepEqual(none.kept, r.kept);
});

test("adapter injection reorders kept chunks, preserves stage-1 scores", () => {
  const opts = { ...tinyOpts, targetRatio: 0.4, maxTokens: 12 };
  const base = compressContext(opts);
  assert.equal(base.refused, false);
  assert.ok(base.output.includes("Quantum"));
  let seen = null;
  const boosted = compressContext({
    ...opts,
    rerankFn: ({ query, chunks, scores }) => {
      seen = { query, n: chunks.length, m: scores.length };
      return chunks.map((c) => (c.text.includes("Sourdough") ? 99 : 0));
    },
  });
  assert.deepEqual(seen, { query: "quantum error correction qubits", n: 4, m: 4 });
  assert.equal(boosted.rescored, true);
  assert.equal(boosted.reranker, "minilm-l6-v2");
  assert.ok(boosted.output.includes("Sourdough"));
  assert.ok(!boosted.output.includes("Quantum"));
  assert.deepEqual(boosted.kept.map((k) => k.i), [1]);
  assert.equal(boosted.kept[0].score, 99);
  assert.equal(boosted.kept[0].bm25, 0);
});

test("bge-gemma tier needs an explicit adapter", () => {
  const miss = compressContext({ ...tinyOpts, reranker: "bge-reranker-v2-gemma" });
  assert.equal(miss.ok, false);
  assert.equal(miss.reason, "reranker_needs_adapter");
  const hit = compressContext({
    ...tinyOpts, reranker: "bge-gemma", rerankFn: ({ chunks }) => chunks.map(() => 0.5),
  });
  assert.equal(hit.ok, true);
  assert.equal(hit.reranker, "bge-reranker-v2-gemma");
  assert.equal(hit.rescored, true);
  assert.ok(hit.kept.every((k) => k.score === 0.5));
});
test("async adapters use the async pipeline; sync rejects them honestly", async () => {
  const r = await compressContextAsync({
    ...tinyOpts, rerankFn: async ({ chunks }) => chunks.map(() => 1),
  });
  assert.equal(r.ok, true);
  assert.equal(r.rescored, true);
  assert.ok(r.kept.every((k) => k.score === 1));
  const sync = compressContext({ ...tinyOpts, rerankFn: async ({ chunks }) => chunks.map(() => 1) });
  assert.equal(sync.ok, false);
  assert.equal(sync.reason, "async_reranker_needs_async");
  const short = compressContext({ ...tinyOpts, rerankFn: () => [1, 2, 3, 4] });
  assert.equal(short.ok, false);
  assert.equal(short.reason, "invalid_rerank_scores");
  const unk = compressContext({ ...tinyOpts, reranker: "nope" });
  assert.equal(unk.ok, false);
  assert.equal(unk.reason, "unknown_reranker");
  assert.ok(Array.isArray(unk.supported));
});

test("rerankTopK limits second-stage candidates", () => {
  let seen = -1;
  const r = compressContext({
    text: DOC, query: "quantum", targetRatio: 0.9, maxTokens: 20, rerankTopK: 2,
    rerankFn: ({ chunks }) => { seen = chunks.length; return chunks.map(() => 1); },
  });
  assert.equal(seen, 2);
  assert.equal(r.rescored, true);
});

test("lab-fixture-v2 eval: BM25-only baseline vs oracle rerank", async () => {
  const { RETRIEVAL_DOCS, RETRIEVAL_QUERY, gradeRetrievalPrecision } = await import("./benchhaus.mjs");
  const base = rerankDocs({ query: RETRIEVAL_QUERY, docs: RETRIEVAL_DOCS });
  assert.equal(base.ok, true);
  assert.equal(base.reranker, "minilm-l6-v2");
  assert.equal(base.rescored, false);
  assert.equal(base.ids.length, 50);
  const g0 = gradeRetrievalPrecision(base.ids);
  assert.ok(Math.abs(g0.ndcg10 - 0.6952585455054701) < 1e-12, "pinned lab-fixture-v2 BM25 value, got " + g0.ndcg10);
  // Lexical gap the second stage exists to close: grade-1 bakery hard
  // negatives outrank lexically thinned grade-3 anchors on BM25 alone.
  const gradeById = new Map(RETRIEVAL_DOCS.map((d) => [d.id, d.grade]));
  const top10 = base.ids.slice(0, 10).map((id) => gradeById.get(id));
  assert.ok(top10.includes(1), "a hard negative reaches top10, got " + top10);
  assert.ok(top10.filter((g) => g === 3).length < 5, "BM25-only misses grade-3s, got " + top10);
  const oracle = ({ chunks }) => chunks.map((c) => gradeById.get(c.id) ?? 0);
  const re = rerankDocs({ query: RETRIEVAL_QUERY, docs: RETRIEVAL_DOCS, rerankFn: oracle });
  assert.equal(re.rescored, true);
  const g1 = gradeRetrievalPrecision(re.ids);
  assert.equal(g1.ndcg10, 1);
  assert.ok(g1.ndcg10 - g0.ndcg10 > 0.3, "rerank delta " + (g1.ndcg10 - g0.ndcg10));
  const again = rerankDocs({ query: RETRIEVAL_QUERY, docs: RETRIEVAL_DOCS });
  assert.deepEqual(again.ids, base.ids);
  const asyncRe = await rerankDocsAsync({ query: RETRIEVAL_QUERY, docs: RETRIEVAL_DOCS, rerankFn: async (a) => oracle(a) });
  assert.deepEqual(asyncRe.ids, re.ids);
});

test("run forwards adapters.rerankFn and reports the reranker", async () => {
  let calls = 0;
  const spec = { demo: true, action: "fetch", host: "h.test", context: { text: DOC, query: "quantum qubits", targetRatio: 0.4, maxTokens: 20 } };
  const r = await runAgenticRun(spec, {
    settleFn: async (i) => ({ captured: true }),
    rerankFn: ({ scores }) => { calls++; return scores; },
  });
  assert.equal(r.ok, true);
  assert.equal(calls, 1);
  const ctx = r.receipts.find((s) => s.stage === "context");
  assert.equal(ctx.ok, true);
  assert.equal(ctx.reranker, "minilm-l6-v2");
  assert.equal(ctx.rescored, true);
});

test("dispatch forwards adapters.rerankFn into the second stage", async () => {
  let calls = 0;
  const r = await dispatchAgentic(
    "spl_agentic_context",
    { text: DOC, query: "fox", targetRatio: 0.5, maxTokens: 20 },
    { rerankFn: ({ query, chunks, scores }) => { calls++; assert.equal(query, "fox"); assert.ok(chunks.length > 0); return scores; } },
  );
  assert.equal(calls, 1);
  assert.equal(r.ok, true);
  assert.equal(r.verified, true);
  assert.equal(r.rescored, true);
  assert.equal(r.reranker, "minilm-l6-v2");
});
