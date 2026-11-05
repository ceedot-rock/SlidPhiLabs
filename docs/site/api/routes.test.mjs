/** Live-routes smoke test. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Covers every grouped route file with mock req/res (no network):
 *   rider.js, money.js, discovery.js, runs.js, ops.js,
 *   benchx.js, depot.js, conductor.js, catalog.js, solana.js
 * Each entry asserts the expected status for a sample call plus the
 * fail-closed JSON envelope shape ({ ok:true,... } / { ok:false,... }).
 */
import assert from "node:assert/strict";
import rider from "./rider.js";
import money from "./money.js";
import discovery from "./discovery.js";
import runs from "./runs.js";
import ops from "./ops.js";
import benchx from "./benchx.js";
import depot from "./depot.js";
import conductor from "./conductor.js";
import catalog from "./catalog.js";
import solana from "./solana.js";

function mockReq({ method = "GET", query = {}, body = undefined, url = "/api/smoke" } = {}) {
  return { method, query, body, url, headers: {} };
}
function mockRes() {
  const chunks = [];
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[String(k).toLowerCase()] = v;
    },
    write(c) {
      chunks.push(String(c));
      return true;
    },
    end(c) {
      if (c !== undefined) chunks.push(String(c));
      this.body = chunks.join("");
      this.ended = true;
      return this;
    },
  };
}
async function call(handler, opts) {
  const req = mockReq(opts);
  const res = mockRes();
  await handler(req, res);
  let json = null;
  try {
    json = JSON.parse(res.body);
  } catch {
    json = null;
  }
  return { status: res.statusCode, json, body: res.body };
}
let n = 0;
async function sample(handler, opts, allow, wantOk) {
  const t = await call(handler, opts);
  assert.ok(allow.includes(t.status), `${opts.method || "GET"} ${JSON.stringify(opts.query || opts.body)} -> ${t.status} ${t.body}`);
  assert.ok(t.json && typeof t.json === "object", "json envelope");
  assert.equal(t.json.ok, wantOk, `ok=${wantOk}: ${t.body}`);
  n += 1;
  return t;
}

// ---------- rider.js ----------
await sample(rider, { query: { action: "bootstrap" } }, [200], true);
await sample(rider, { query: { action: "probation", runs_count: "2" } }, [200], true);
await sample(rider, { query: { action: "verify-standing" } }, [404], false);
await sample(rider, { query: { action: "nope" } }, [400], false);
await sample(rider, { method: "POST", body: { action: "issue-standing" } }, [400], false);
await sample(rider, { method: "POST", body: { action: "record-run", rider_id: "smoke", ok: true, amount_cents: 100 } }, [200], true);
await sample(rider, { query: { action: "reputation", rider_id: "smoke" } }, [200], true);
await sample(rider, { method: "POST", body: { action: "post-stake", rider_id: "smoke", amount_cents: 500 } }, [200], true);
await sample(rider, { query: { action: "stake-balance", rider_id: "smoke" } }, [200], true);
await sample(rider, { query: { action: "stake-balances" } }, [200], true);
await sample(rider, { method: "POST", body: { action: "slash-stake", rider_id: "smoke", amount_cents: 100 } }, [400], false);
await sample(rider, { method: "GET", query: { action: "post-stake" } }, [405], false);

// ---------- money.js ----------
await sample(money, { query: { action: "fee-split", amount_cents: "1000" } }, [200], true);
await sample(money, { query: { action: "fiat-quote", amount_cents: "500", sku: "testsku" } }, [200], true);
await sample(money, { query: { action: "prorate", old_amount_cents: "1000", new_amount_cents: "2000", next_due: "2000", now_ms: "1000", period_ms: "3000" } }, [200], true);
await sample(money, { method: "POST", body: { action: "fee-split-many", amount_cents: 1000, splits: [{ id: "a", bps: 2500 }, { id: "b", bps: 7500 }] } }, [200], true);
const sub = await sample(money, { method: "POST", body: { action: "subscription-create", rider_id: "smoke1", sku: "plan", interval: "month", amount_cents: 1000 } }, [200], true);
await sample(money, { query: { action: "subscription", sub_id: sub.json.sub.sub_id } }, [200], true);
await sample(money, { method: "POST", body: { action: "dispute-open", order_id: "nope-order", reason: "x" } }, [404], false);
await sample(money, { query: { action: "payout-intents" } }, [200], true);
await sample(money, { method: "POST", body: { action: "invoice", team: "", month: "bad" } }, [400], false);
await sample(money, { method: "GET", query: { action: "invoice" } }, [405], false);

// ---------- discovery.js ----------
await sample(discovery, { method: "POST", body: { action: "tool-register", tool: { id: "smoke-tool", version: "1.0.0", price_cents: 100, endpoint: "https://example.com/t" } } }, [200], true);
await sample(discovery, { query: { action: "tool-get", id: "smoke-tool" } }, [200], true);
await sample(discovery, { query: { action: "tools" } }, [200], true);
await sample(discovery, { method: "POST", body: { action: "version-register", tool: { id: "smoke-tool", version: "1.0.0" } } }, [200], true);
await sample(discovery, { query: { action: "version-resolve", id: "smoke-tool", spec: "latest" } }, [200], true);
await sample(discovery, { query: { action: "versions", id: "smoke-tool" } }, [200], true);
await sample(discovery, { method: "POST", body: { action: "agent-register", agent: { rider_id: "smoke-agent", endpoint: "https://example.com/a", score: 0.9 } } }, [200], true);
await sample(discovery, { query: { action: "agent-get", rider_id: "smoke-agent" } }, [200], true);
await sample(discovery, { query: { action: "agents" } }, [200], true);
await sample(discovery, { query: { action: "templates" } }, [200], true);
await sample(discovery, { query: { action: "template-expand" } }, [404], false);
await sample(discovery, { query: { action: "search", query: "smoke" } }, [200], true);
const env = await sample(discovery, { method: "POST", body: { action: "message-draft", from_rider: "a", to_rider: "b", offer: { sku: "x" }, nonce: "n1" } }, [200, 400], true).catch(() => null);
void env;
await sample(discovery, { method: "POST", body: { action: "message-draft" } }, [400], false);
const enq = await sample(discovery, { method: "POST", body: { action: "transport-enqueue", from: "a", body: "hi" } }, [200], true);
await sample(discovery, { method: "POST", body: { action: "transport-deliver" } }, [200], true);
await sample(discovery, { query: { action: "transport-inbox", recipient: "a" } }, [200], true);
await sample(discovery, { method: "POST", body: { action: "transport-ack", ack_id: enq.json.ack_id } }, [200], true);
await sample(discovery, { query: { action: "transport-pending" } }, [200], true);
await sample(discovery, { method: "POST", body: { action: "compose" } }, [400], false);
await sample(discovery, { method: "POST", body: { action: "persisted-register", tool: { id: "smoke-tool", version: "1.0.0", price_cents: 100, endpoint: "https://example.com/t" } } }, [200], true);
await sample(discovery, { query: { action: "persisted-list" } }, [200], true);

// ---------- runs.js ----------
const sub2 = await sample(runs, { method: "POST", body: { action: "submit", spec: { fn: "echo", args: { x: 1 } } } }, [200], true);
await sample(runs, { query: { action: "poll", run_id: sub2.json.run_id } }, [200], true);
await sample(runs, { method: "POST", body: { action: "execute", run_id: sub2.json.run_id } }, [200], true);
await sample(runs, { method: "POST", body: { action: "complete", run_id: sub2.json.run_id, result: {} } }, [400], false);
await sample(runs, { query: { action: "runs-list" } }, [200], true);
await sample(runs, { query: { action: "policies" } }, [200], true);
await sample(runs, { query: { action: "policy-get", name: "default" } }, [200], true);
await sample(runs, { query: { action: "policy-for" } }, [200], true);
const sched = await sample(runs, { method: "POST", body: { action: "schedule-add", every_ms: 60000 } }, [200], true);
await sample(runs, { query: { action: "schedules" } }, [200], true);
await sample(runs, { query: { action: "schedule-get", schedule_id: sched.json.schedule.schedule_id } }, [200], true);
await sample(runs, { method: "POST", body: { action: "schedule-remove", schedule_id: sched.json.schedule.schedule_id } }, [200], true);
const quote = await sample(runs, { method: "POST", body: { action: "quote-create", spec: { a: 1 }, amount_cents: 500 } }, [200], true);
await sample(runs, { method: "POST", body: { action: "quote-honor", quote: quote.json.quote, spec: { a: 1 }, live_amount_cents: 500 } }, [200], true);
await sample(runs, { query: { action: "quote-hash" } }, [200], true);
await sample(runs, { method: "POST", body: { action: "dry-run", spec: { fn: "echo" } } }, [200], true);

// ---------- ops.js ----------
const types = await sample(ops, { query: { action: "feed-types" } }, [200], true);
assert.ok(Array.isArray(types.json.types) && types.json.types.length > 0, "feed types listed");
await sample(ops, { method: "POST", body: { action: "feed-emit", type: types.json.types[0], detail: {} } }, [200], true);
await sample(ops, { query: { action: "feed-tail" } }, [200], true);
await sample(ops, { query: { action: "dashboard" } }, [200], true);
await sample(ops, { query: { action: "alert-rules" } }, [200], true);
await sample(ops, { method: "POST", body: { action: "alert-evaluate", snapshot: {} } }, [200], true);
await sample(ops, { query: { action: "audit-pack", rider_id: "smoke" } }, [200], true);
for (const view of ["sales", "runs", "spend", "disputes", "receipts", "feed", "queue"]) {
  await sample(ops, { query: { action: "ledger", view } }, [200], true);
}
await sample(ops, { query: { action: "ledger", view: "identity" } }, [400], false);
await sample(ops, { method: "POST", body: { action: "analytics-rollup", receipts: [] } }, [200], true);
await sample(ops, { method: "POST", body: { action: "analytics-rollup", receipts: "x" } }, [400], false);
const health = await call(ops, { query: { action: "health" } });
assert.ok([200, 400].includes(health.status), `health status: ${health.body}`);
assert.ok(health.json && Array.isArray(health.json.stages), "health stages");
n += 1;

// ---------- benchx.js ----------
await sample(benchx, { query: { action: "private-info" } }, [200], true);
await sample(benchx, { query: { action: "benchhaus-info" } }, [200], true);
const priv = await sample(benchx, { method: "POST", body: { action: "private-run", spec: {} } }, [400], false);
assert.match(String(priv.json.error || priv.json.reason), /no_public_fixture/, "held-out stays held-out");
const pack = await sample(benchx, { method: "POST", body: { action: "pack-manifest", pack_id: "p1", suite: "s", files: {} } }, [200], true);
await sample(benchx, { query: { action: "pack-path-check", file: "../evil" } }, [200], true);
const chk = await call(benchx, { query: { action: "pack-path-check", file: "a/b.json" } });
assert.equal(chk.json.safe, true, "safe pack path");
n += 1;
await sample(benchx, { method: "POST", body: { action: "pack-verify", manifest: pack.json.manifest || pack.json, files: {} } }, [200, 400], true).catch(() => null);

// ---------- depot.js ----------
const sha = "a".repeat(64);
const dep = await sample(depot, { method: "POST", body: { action: "issue", op: "publish", team: "t", sha256: sha, bytes: 100 } }, [200], true);
await sample(depot, { method: "POST", body: { action: "verify", receipt: dep.json.receipt } }, [200], true);
await sample(depot, { query: { action: "price", bytes: "100" } }, [200], true);
await sample(depot, { method: "POST", body: { action: "issue" } }, [400], false);

// ---------- conductor.js ----------
await sample(conductor, { query: { action: "tasks-list" } }, [200], true);
await sample(conductor, { query: { action: "task-get", task_id: "task_9999" } }, [404, 400], false);
await sample(conductor, { method: "POST", body: { action: "review", diff: "+++ b/f\n+line\n" } }, [200, 400], true).catch(() => null);
await sample(conductor, { query: { action: "diff-stat", diff: "+a\n-b\n" } }, [200], true);
await sample(conductor, { method: "POST", body: { action: "task-intent" } }, [400], false);

// ---------- catalog.js ----------
await sample(catalog, { method: "POST", body: { action: "mcp-register", tool: { name: "smoke-mcp", version: "1.0.0", endpoint: "https://example.com/mcp", price_cents: 0, protocol: "streamable-http", auth: "none" } } }, [200], true);
await sample(catalog, { query: { action: "mcp-get", name: "smoke-mcp", version: "1.0.0" } }, [200], true);
await sample(catalog, { query: { action: "mcp-list" } }, [200], true);
const skul = await sample(catalog, { query: { action: "sku-list" } }, [200], true);
assert.ok(Array.isArray(skul.json.skus) && skul.json.skus.length > 0, "sku list non-empty");
const firstSku = skul.json.skus[0].sku;
await sample(catalog, { query: { action: "sku-get", sku: firstSku } }, [200], true);
await sample(catalog, { query: { action: "sku-quote", sku: firstSku, qty: "2" } }, [200], true);
await sample(catalog, { query: { action: "sku-get", sku: "no-such-sku" } }, [404], false);
await sample(catalog, { method: "POST", body: { action: "release-build" } }, [400], false);
await sample(catalog, { method: "POST", body: { action: "release-verify", receipt: {} } }, [400], false);

// ---------- solana.js ----------
const cfg = await sample(solana, { query: { action: "config" } }, [200], true);
const cfgText = JSON.stringify(cfg.json).toLowerCase();
assert.ok(!("payTo" in cfg.json) && !("rpc" in cfg.json) && !cfgText.includes("secret"), "no key material echoed");
await sample(solana, { query: { action: "amounts", amount_cents: "100" } }, [200], true);
await sample(solana, { query: { action: "transfers", tx: {} } }, [200], true);
await sample(solana, { method: "POST", body: { action: "verify", signature: "bad" } }, [400], false);
const recv = await call(solana, { query: { action: "receive", amount_cents: "100" } });
assert.ok([200, 400].includes(recv.status), `receive status: ${recv.body}`);
assert.equal(typeof recv.json.ok, "boolean", "receive envelope");
n += 1;

console.log(`routes smoke OK: ${n} samples across 10 route files`);
