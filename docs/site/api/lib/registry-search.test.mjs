import test from "node:test";
import assert from "node:assert/strict";
import { searchRegistry, tokenize } from "./registry-search.mjs";

const tools = [
  { id: "spl_compress", description: "shrink context windows", tags: ["nlp"] },
  { id: "spl_fetch", description: "fetch urls fast", tags: ["compress-adjacent"] },
  { id: "spl_rerank", description: "rerank docs", tags: ["ranking"] },
];
const agents = [{ name: "compress-bot", description: "runs nightly jobs", tags: ["ops"] }];

test("name hits outrank tag and description hits", () => {
  const { results } = searchRegistry({ query: "compress", tools, agents });
  assert.equal(results[0].id, "compress-bot"); // name hit = 3, tie broken by id
  assert.equal(results[1].id, "spl_compress"); // name hit = 3
  const ids = results.map((r) => r.id);
  assert.ok(ids.includes("spl_fetch")); // tag hit = 2, ranked last
});

test("tag hits outrank description hits", () => {
  const res = searchRegistry({
    query: "rank",
    tools: [
      { id: "a-tool", description: "does rank work", tags: [] },
      { id: "z-tool", description: "unrelated", tags: ["ranker"] },
    ],
    agents: [],
  });
  assert.deepEqual(res.results.map((r) => r.id), ["z-tool", "a-tool"]);
});

test("thunk readers work; bad query/reader/limit fail closed", () => {
  assert.equal(searchRegistry({ query: "x", tools: () => tools, agents: () => agents }).ok, true);
  assert.equal(searchRegistry({ query: "  " }).reason, "bad_query");
  assert.equal(searchRegistry({ query: "x", tools: null, agents: [] }).reason, "bad_reader");
  assert.equal(searchRegistry({ query: "x", tools, agents, limit: 0 }).reason, "bad_limit");
});

test("tokenize splits on non-alnum runs", () => {
  assert.deepEqual(tokenize("shrink, WINDOWS!"), ["shrink", "windows"]);
  assert.deepEqual(tokenize("compress-bot"), ["compress", "bot"]);
  assert.deepEqual(tokenize("  "), []);
  assert.deepEqual(tokenize(null), []);
});

test("prefix token matches when no substring hit exists", () => {
  const res = searchRegistry({
    query: "comp",
    tools: [{ id: "spl_compress", description: "shrink bytes", tags: [] }],
    agents: [],
  });
  assert.equal(res.ok, true);
  assert.equal(res.results[0].id, "spl_compress");
});

test("multi-token query matches across words", () => {
  const res = searchRegistry({
    query: "shrink, windows!",
    tools,
    agents: [],
  });
  assert.equal(res.ok, true);
  assert.equal(res.results[0].id, "spl_compress");
});

test("punctuation-only query fails closed", () => {
  assert.equal(searchRegistry({ query: "!!!", tools, agents }).reason, "bad_query");
});

test("limit caps results", () => {
  const many = Array.from({ length: 10 }, (_, i) => ({ id: `t-${i}`, description: "shared word here" }));
  const { results } = searchRegistry({ query: "shared", tools: many, agents: [], limit: 3 });
  assert.equal(results.length, 3);
});
