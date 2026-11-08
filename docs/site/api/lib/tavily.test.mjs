import test from "node:test";
import assert from "node:assert/strict";
import { searchTavily, formatContext, tavilyKey, TAVILY_VERSION } from "./tavily.mjs";

const KEY = "tvly-test-key";
const OLD = process.env.TAVILY_API_KEY;

function restoreEnv() {
  if (OLD === undefined) delete process.env.TAVILY_API_KEY;
  else process.env.TAVILY_API_KEY = OLD;
}

function stubFetch(handler) {
  const calls = [];
  const fn = async (url, opts = {}) => {
    calls.push({ url, body: opts && opts.body ? JSON.parse(opts.body) : null });
    return handler(calls);
  };
  fn.calls = calls;
  return fn;
}

const okFetch = (results) =>
  stubFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ results }),
  }));

test("missing key refuses closed with a hint, no network", async () => {
  delete process.env.TAVILY_API_KEY;
  const fetchFn = stubFetch(async () => ({ ok: true, status: 200, json: async () => ({}) }));
  const r = await searchTavily({ query: "x", fetchFn });
  assert.equal(r.ok, false);
  assert.equal(r.error, "tavily_unset");
  assert.match(r.hint, /TAVILY_API_KEY/);
  assert.equal(fetchFn.calls.length, 0);
  restoreEnv();
});

test("empty query refuses before the network", async () => {
  const fetchFn = stubFetch(async () => ({ ok: true, status: 200, json: async () => ({}) }));
  const r = await searchTavily({ query: "  ", apiKey: KEY, fetchFn });
  assert.equal(r.ok, false);
  assert.equal(r.error, "bad_query");
  assert.equal(fetchFn.calls.length, 0);
});

test("success maps results and clamps fields", async () => {
  const fetchFn = okFetch([
    { title: "T", url: "https://e.com", content: "C", score: 0.9, published_date: "2026-11-07", extra: 1 },
  ]);
  const r = await searchTavily({ query: "lab", apiKey: KEY, fetchFn });
  assert.equal(r.ok, true);
  assert.equal(r.depth, "basic");
  assert.deepEqual(Object.keys(r.results[0]).sort(), ["content", "published_date", "score", "title", "url"]);
  assert.equal(fetchFn.calls[0].body.max_results, 5);
  assert.equal(fetchFn.calls[0].body.include_answer, undefined);
});

test("max_results clamps to 1..10, advanced + answer pass through", async () => {
  const fetchFn = okFetch([]);
  await searchTavily({ query: "lab", apiKey: KEY, max_results: 99, search_depth: "advanced", include_answer: true, fetchFn });
  assert.equal(fetchFn.calls[0].body.max_results, 10);
  assert.equal(fetchFn.calls[0].body.search_depth, "advanced");
  assert.equal(fetchFn.calls[0].body.include_answer, true);
});

test("transport faults and bad shapes refuse closed", async () => {
  const down = stubFetch(async () => { throw new Error("boom"); });
  assert.equal((await searchTavily({ query: "x", apiKey: KEY, fetchFn: down })).error, "network_failed");
  const http = stubFetch(async () => ({ ok: false, status: 401, json: async () => ({}) }));
  const e = await searchTavily({ query: "x", apiKey: KEY, fetchFn: http });
  assert.equal(e.error, "tavily_error");
  assert.equal(e.status, 401);
  const shape = okFetch({ nope: 1 });
  assert.equal((await searchTavily({ query: "x", apiKey: KEY, fetchFn: shape })).error, "bad_response");
});

test("explicit key wins over env, env fallback works", () => {
  process.env.TAVILY_API_KEY = "tvly-env";
  assert.equal(tavilyKey("tvly-explicit"), "tvly-explicit");
  assert.equal(tavilyKey(), "tvly-env");
  restoreEnv();
});

test("formatContext builds a bounded block, ignores failures", () => {
  const block = formatContext({
    ok: true, query: "x", depth: "basic",
    results: [{ title: "T", url: "https://e.com", content: "C".repeat(5000) }],
  }, 200);
  assert.ok(block.includes("Tavily"));
  assert.ok(block.length <= 200);
  assert.equal(formatContext({ ok: false, error: "tavily_unset" }), "");
});

test("version is pinned", () => {
  assert.match(TAVILY_VERSION, /^\d+\.\d+\.\d+$/);
});
