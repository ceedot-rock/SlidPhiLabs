/** spl-acn CLI tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { run, usage, CLI_VERSION } from "../src/cli.mjs";
import { MCP_ENDPOINT } from "../src/client.mjs";

function stubFetch(routes) {
  const calls = [];
  const fn = async (url, opts = {}) => {
    calls.push({ url, method: (opts && opts.method) || "GET" });
    const hit = routes.find(
      (r) => url === r.url && ((opts && opts.method) || "GET") === r.method,
    );
    if (!hit) {
      return { ok: false, status: 404, json: async () => ({ error: "not_found" }) };
    }
    return { ok: hit.status < 300, status: hit.status, json: async () => hit.body };
  };
  fn.calls = calls;
  return fn;
}

const CARD = [{ method: "GET", url: MCP_ENDPOINT, status: 200, body: { name: "spl-acn" } }];

test("card facet prints the server card", async () => {
  const r = await run(["card"], { fetchFn: stubFetch(CARD), env: {} });
  assert.equal(r.code, 0);
  assert.equal(r.json.card.name, "spl-acn");
});

test("catalog facet calls spl_catalog", async () => {
  const fetchFn = stubFetch([
    ...CARD,
    { method: "POST", url: MCP_ENDPOINT, status: 200, body: { jsonrpc: "2.0", id: 1, result: { skus: ["suite"] } } },
  ]);
  const r = await run(["catalog"], { fetchFn, env: {} });
  assert.equal(r.code, 0);
  assert.deepEqual(r.json.result, { skus: ["suite"] });
});

test("call facet passes parsed JSON args", async () => {
  const fetchFn = stubFetch([
    { method: "POST", url: MCP_ENDPOINT, status: 200, body: { jsonrpc: "2.0", id: 1, result: { ok: true } } },
  ]);
  const r = await run(["call", "spl_quote", '{"gb":10}'], { fetchFn, env: {} });
  assert.equal(r.code, 0);
  assert.equal(r.json.ok, true);
});

test("missing tool and bad JSON never touch the network", async () => {
  const fetchFn = stubFetch(CARD);
  assert.equal((await run(["call"], { fetchFn, env: {} })).code, 2);
  assert.equal((await run(["call", "t", "{nope"], { fetchFn, env: {} })).code, 2);
  assert.equal((await run(["frobnicate"], { fetchFn, env: {} })).code, 2);
  assert.equal(fetchFn.calls.length, 0);
});

test("paid tool reports payment_required with exit 1", async () => {
  const fetchFn = stubFetch([
    { method: "POST", url: MCP_ENDPOINT, status: 402, body: { accepts: [{ rail: "base" }] } },
  ]);
  const r = await run(["call", "spl_compress", "{}"], { fetchFn, env: {} });
  assert.equal(r.code, 1);
  assert.equal(r.json.reason, "payment_required");
});

test("usage names every facet", () => {
  assert.match(usage(), /card/);
  assert.match(usage(), /catalog/);
  assert.match(usage(), /call/);
  assert.match(CLI_VERSION, /^\d+\.\d+\.\d+$/);
});
