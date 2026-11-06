/** SPL:ACN MCP client tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createMcpClient, MCP_SDK_VERSION, MCP_ENDPOINT } from "../src/client.mjs";

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

test("card reads the server card", async () => {
  const fetchFn = stubFetch([
    { method: "GET", url: MCP_ENDPOINT, status: 200, body: { name: "spl-acn", version: "1.20.2" } },
  ]);
  const c = createMcpClient({ fetchFn });
  const r = await c.card();
  assert.equal(r.ok, true);
  assert.equal(r.card.name, "spl-acn");
});

test("callTool posts JSON-RPC and returns the result", async () => {
  const fetchFn = stubFetch([
    {
      method: "POST", url: MCP_ENDPOINT, status: 200,
      body: { jsonrpc: "2.0", id: 1, result: { seats: 3 } },
    },
  ]);
  const c = createMcpClient({ fetchFn, apiKey: "spl1.test.key" });
  const r = await c.callTool("spl_catalog", {});
  assert.equal(r.ok, true);
  assert.deepEqual(r.result, { seats: 3 });
  assert.equal(fetchFn.calls[0].method, "POST");
});

test("HTTP 402 surfaces as payment_required, never a throw", async () => {
  const fetchFn = stubFetch([
    { method: "POST", url: MCP_ENDPOINT, status: 402, body: { accepts: [{ rail: "base" }] } },
  ]);
  const c = createMcpClient({ fetchFn });
  const r = await c.callTool("spl_compress", { data_b64: "eA==" });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "payment_required");
});

test("tool errors and missing names refuse closed", async () => {
  const fetchFn = stubFetch([
    { method: "POST", url: MCP_ENDPOINT, status: 200, body: { jsonrpc: "2.0", id: 1, error: { code: -32602, message: "bad args" } } },
  ]);
  const c = createMcpClient({ fetchFn });
  const r = await c.callTool("spl_compress", {});
  assert.equal(r.ok, false);
  const noName = await c.callTool("", {});
  assert.equal(noName.ok, false);
  assert.equal(noName.reason, "bad_tool");
  assert.equal(fetchFn.calls.length, 1);
});

test("version constant is pinned", () => {
  assert.match(MCP_SDK_VERSION, /^\d+\.\d+\.\d+$/);
});
