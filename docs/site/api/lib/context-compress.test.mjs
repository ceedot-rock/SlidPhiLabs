/** Context compressor 0.1.0 tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { join } from "node:path";
import {
  estimateTokens, sha256hex, chunkText, dedupChunks, queryTerms,
  scoreChunks, compressContext, verifyCompression, CONTEXT_VERSION,
} from "./context-compress.mjs";

const DOC = [
  "The quick brown fox jumps over the lazy dog near the river bank.",
  "Quantum error correction protects fragile qubits from decoherence noise.",
  "The quick brown fox jumps over the lazy dog near the river bank.",
  "Pack my box with five dozen liquor jugs for the moving van tomorrow.",
  "Quantum error correction protects fragile qubits from decoherence noise.",
  "Sourdough starter needs daily feeding with flour and warm water.",
].join("\n\n");

test("version pinned", () => assert.equal(CONTEXT_VERSION, "0.1.0"));

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
  assert.equal(ctx.toolVersion, "0.1.0");
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
