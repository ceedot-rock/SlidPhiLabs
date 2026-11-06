/** Depot store stage tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createDepotStore,
  DEPOT_STORE_VERSION,
} from "./depot-store.mjs";

const SHA = "ab".repeat(32);
const ENDPOINT = "https://depot.example";
const KEY = "test-key";

function stubFetch(routes) {
  const calls = [];
  const fn = async (url, opts = {}) => {
    calls.push({ url, method: (opts && opts.method) || "GET" });
    const hit = routes.find(
      (r) => url === ENDPOINT + r.suffix && ((opts && opts.method) || "GET") === r.method,
    );
    if (!hit) {
      return {
        ok: false,
        status: 404,
        json: async () => ({ error: "no_blob" }),
        arrayBuffer: async () => new ArrayBuffer(0),
      };
    }
    return {
      ok: hit.status < 300,
      status: hit.status,
      json: async () => hit.body,
      arrayBuffer: async () => new Uint8Array(hit.bytes || []).buffer,
    };
  };
  fn.calls = calls;
  return fn;
}

test("publish posts name, sha, size, and blob, then returns the receipt", async () => {
  const fetchFn = stubFetch([
    { method: "POST", suffix: "/api/depot/publish", status: 200, body: { published: "run-1", sha256: SHA, size: 4, team: "lab" } },
  ]);
  const store = createDepotStore({ endpoint: ENDPOINT, key: KEY, fetchFn });
  const r = await store.publish({ name: "run-1", bytes: Buffer.from("abcd"), provenance: { source: "acn-run" } });
  assert.equal(r.ok, true);
  assert.equal(r.name, "run-1");
  assert.equal(r.size, 4);
  assert.match(r.sha256, /^[0-9a-f]{64}$/);
  assert.equal(fetchFn.calls.length, 1);
  assert.equal(fetchFn.calls[0].method, "POST");
});

test("publish rejects a bad name without touching the network", async () => {
  const fetchFn = stubFetch([]);
  const store = createDepotStore({ endpoint: ENDPOINT, key: KEY, fetchFn });
  const r = await store.publish({ name: "", bytes: Buffer.from("abcd") });
  assert.equal(r.ok, false);
  assert.equal(fetchFn.calls.length, 0);
});

test("retrieve returns bytes for a known sha", async () => {
  const fetchFn = stubFetch([
    { method: "GET", suffix: "/api/blob/" + SHA, status: 200, body: {}, bytes: [104, 105] },
  ]);
  const store = createDepotStore({ endpoint: ENDPOINT, key: KEY, fetchFn });
  const r = await store.retrieve(SHA);
  assert.equal(r.ok, true);
  assert.equal(Buffer.from(r.bytes).toString("utf8"), "hi");
});

test("retrieve of an unknown sha fails closed", async () => {
  const fetchFn = stubFetch([]);
  const store = createDepotStore({ endpoint: ENDPOINT, key: KEY, fetchFn });
  const r = await store.retrieve(SHA);
  assert.equal(r.ok, false);
});

test("missing endpoint or key refuses without network", async () => {
  const fetchFn = stubFetch([]);
  const noEndpoint = createDepotStore({ endpoint: "", key: KEY, fetchFn });
  assert.equal((await noEndpoint.list()).ok, false);
  const noKey = createDepotStore({ endpoint: ENDPOINT, key: "", fetchFn });
  assert.equal((await noKey.list()).ok, false);
  assert.equal(fetchFn.calls.length, 0);
});

test("list returns the depot entries", async () => {
  const fetchFn = stubFetch([
    { method: "GET", suffix: "/api/depot/list", status: 200, body: { team: "lab", depots: [{ name: "run-1" }] } },
  ]);
  const store = createDepotStore({ endpoint: ENDPOINT, key: KEY, fetchFn });
  const r = await store.list();
  assert.equal(r.ok, true);
  assert.equal(r.depots.length, 1);
});

test("version constant is pinned", () => {
  assert.match(DEPOT_STORE_VERSION, /^\d+\.\d+\.\d+$/);
});
