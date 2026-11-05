/** HTTP rerank adapter tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. */
/* Offline convention: fetch is always an injected mock here, never the network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createHttpRerankFn, defaultProductionRerankFn, rerankEnv, isConfigured,
  RERANK_ENDPOINT_URL, RERANK_TIMEOUT_MS_DEFAULT,
} from "./rerank-http.mjs";
import { rerankDocsAsync } from "./context-compress.mjs";

const ENDPOINT = "https://rerank.test/v1";
const CHUNKS = [
  { i: 0, id: "a", text: "quantum error correction qubits", tokens: 4 },
  { i: 1, id: "b", text: "sourdough starter flour water", tokens: 4 },
  { i: 2, id: "c", text: "river bank fox dog", tokens: 4 },
];
const BM25 = [0.5, 0.2, 0.1];
const okRes = (data) => ({ ok: true, status: 200, json: async () => data });

test("falls back to BM25 scores when fetch throws", async () => {
  const fn = createHttpRerankFn({
    endpoint: ENDPOINT, token: "t",
    fetchImpl: async () => { throw new Error("down"); },
  });
  assert.deepEqual(await fn({ query: "q", chunks: CHUNKS, scores: BM25 }), BM25);
});

test("falls back to BM25 scores on timeout", async () => {
  const fn = createHttpRerankFn({
    endpoint: ENDPOINT, token: "t", timeoutMs: 20,
    fetchImpl: () => new Promise(() => {}),
  });
  const t0 = Date.now();
  assert.deepEqual(await fn({ query: "q", chunks: CHUNKS, scores: BM25 }), BM25);
  assert.ok(Date.now() - t0 < 5000, "timeout must win over a hanging fetch");
});

test("falls back on non-2xx and malformed bodies", async () => {
  const bodies = [
    { ok: false, status: 500, json: async () => ({ ok: false }) },
    okRes({ nope: true }),
    okRes([{ id: "a" }]),
    okRes([{ id: "a", score: "high" }]),
    { ok: true, status: 200, json: async () => { throw new Error("bad json"); } },
  ];
  for (const body of bodies) {
    const fn = createHttpRerankFn({ endpoint: ENDPOINT, fetchImpl: async () => body });
    assert.deepEqual(await fn({ query: "q", chunks: CHUNKS, scores: BM25 }), BM25);
  }
});

test("sends top_k covering all candidates", async () => {
  let seen = null;
  const fn = createHttpRerankFn({
    endpoint: ENDPOINT,
    fetchImpl: async (url, init) => {
      seen = { url, body: JSON.parse(init.body), auth: init.headers.authorization };
      return okRes([
        { id: "a", score: 1 }, { id: "b", score: 2 }, { id: "c", score: 3 },
      ]);
    },
  });
  assert.deepEqual(await fn({ query: "qq", chunks: CHUNKS, scores: BM25 }), [1, 2, 3]);
  assert.equal(seen.url, ENDPOINT);
  assert.equal(seen.body.query, "qq");
  assert.equal(seen.body.top_k, 3);
  assert.deepEqual(seen.body.docs.map((d) => d.id), ["a", "b", "c"]);
  assert.equal(seen.auth, undefined);
});

test("truncated response keeps BM25 for missing ids, ignores unknown ids", async () => {
  const fn = createHttpRerankFn({
    endpoint: ENDPOINT, token: "sek",
    fetchImpl: async (url, init) => {
      assert.equal(init.headers.authorization, "Bearer sek");
      return okRes([{ id: "c", score: 9 }, { id: "zzz", score: 99 }]);
    },
  });
  assert.deepEqual(
    await fn({ query: "q", chunks: CHUNKS, scores: BM25 }),
    [0.5, 0.2, 9],
  );
});

test("endpoint scores reorder docs end to end", async () => {
  const docs = [
    { id: "d0", text: "quantum error correction qubits" },
    { id: "d1", text: "sourdough starter flour water" },
    { id: "d2", text: "quantum qubits" },
  ];
  const fn = createHttpRerankFn({
    endpoint: ENDPOINT,
    fetchImpl: async (url, init) => {
      const body = JSON.parse(init.body);
      const score = { d0: 0.1, d1: 0.9, d2: 0.5 };
      return okRes(body.docs.map((d) => ({ id: d.id, score: score[d.id] })));
    },
  });
  const r = await rerankDocsAsync({ query: "sourdough", docs, rerankFn: fn });
  assert.equal(r.ok, true);
  assert.equal(r.rescored, true);
  assert.deepEqual(r.ids, ["d1", "d2", "d0"]);
  assert.deepEqual(r.ranked.map((x) => x.score), [0.9, 0.5, 0.1]);
});

test("isConfigured gates on RERANK_ENDPOINT presence (pure, no network)", () => {
  assert.equal(isConfigured({ env: {} }), false);
  assert.equal(isConfigured({ env: { RERANK_ENDPOINT: "" } }), false);
  assert.equal(isConfigured({ env: { RERANK_ENDPOINT: "   " } }), false);
  assert.equal(isConfigured({ env: { RERANK_ENDPOINT: ENDPOINT } }), true);
  assert.equal(isConfigured({ env: null }), false);
});

test("production default is null offline, an adapter when RERANK_ENDPOINT is set", () => {
  const keep = {
    endpoint: process.env.RERANK_ENDPOINT,
    token: process.env.RERANK_TOKEN,
    ms: process.env.RERANK_TIMEOUT_MS,
  };
  try {
    delete process.env.RERANK_ENDPOINT;
    delete process.env.RERANK_TOKEN;
    delete process.env.RERANK_TIMEOUT_MS;
    assert.equal(isConfigured(), false);
    assert.equal(defaultProductionRerankFn(), null);
    assert.deepEqual(
      rerankEnv(),
      { endpoint: "", token: "", timeoutMs: RERANK_TIMEOUT_MS_DEFAULT },
    );
    process.env.RERANK_ENDPOINT = ENDPOINT;
    process.env.RERANK_TOKEN = "sek";
    process.env.RERANK_TIMEOUT_MS = "1500";
    assert.equal(isConfigured(), true);
    const fn = defaultProductionRerankFn();
    assert.equal(typeof fn, "function");
    assert.deepEqual(rerankEnv(), { endpoint: ENDPOINT, token: "sek", timeoutMs: 1500 });
    assert.ok(RERANK_ENDPOINT_URL.startsWith("https://"));
  } finally {
    if (keep.endpoint === undefined) delete process.env.RERANK_ENDPOINT;
    else process.env.RERANK_ENDPOINT = keep.endpoint;
    if (keep.token === undefined) delete process.env.RERANK_TOKEN;
    else process.env.RERANK_TOKEN = keep.token;
    if (keep.ms === undefined) delete process.env.RERANK_TIMEOUT_MS;
    else process.env.RERANK_TIMEOUT_MS = keep.ms;
  }
});
