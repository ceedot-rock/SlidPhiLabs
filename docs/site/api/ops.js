/**
 * GET|POST /api/ops — grouped operations route (feed, dashboard, alerts,
 * audit export, ledger readers, usage analytics, network health).
 *
 * Dispatches by `action` (query for GET, body or query for POST):
 *   GET  feed-tail | feed-types | dashboard | alert-rules | audit-pack
 *        | ledger | analytics-info | health
 *   POST feed-emit | alert-evaluate | analytics-rollup
 *
 * Vercel-style default export(req, res). JSON envelope
 * { ok:true, ... } / { ok:false, error }. Fail-closed throughout.
 * Offline-safe: the ops feed is in-process memory; ledger readers fall
 * back to empty sets when ledger files are absent; health probes run
 * local checks only (no network). No key material in code (env only).
 */
import { createOpsFeed, OPS_EVENTS } from "./lib/ops-feed.mjs";
import { buildDashboard } from "./lib/ops-dashboard.mjs";
import { evaluate, RULES } from "./lib/alert-rules.mjs";
import { buildAuditPack } from "./lib/audit-export.mjs";
import { createLedgerReaders } from "./lib/ledger-readers.mjs";
import { rollupUsage } from "./lib/usage-analytics.mjs";
import { createHealthChecker } from "./lib/network-health.mjs";

const READ = new Set([
  "feed-tail",
  "feed-types",
  "dashboard",
  "alert-rules",
  "audit-pack",
  "ledger",
  "analytics-info",
  "health",
]);
const WRITE = new Set(["feed-emit", "alert-evaluate", "analytics-rollup"]);

const feed = createOpsFeed();
const readers = createLedgerReaders();
const health = createHealthChecker();

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function fail(res, status, error, extra) {
  send(res, status, { ok: false, error, ...(extra || {}) });
}

function statusFor(r) {
  const code = String(r.error || r.reason || "");
  if (code === "not_found" || code.startsWith("unknown_")) return 404;
  return 400;
}

function out(res, r) {
  if (r && r.ok) {
    const { ok, ...rest } = r;
    return send(res, 200, { ok: true, ...rest });
  }
  const rest = {};
  if (r) {
    for (const [k, v] of Object.entries(r)) {
      if (k !== "ok" && k !== "error" && k !== "reason") rest[k] = v;
    }
  }
  return fail(
    res,
    statusFor(r || {}),
    (r && (r.error || r.reason)) || "request_failed",
    rest,
  );
}

function readInput(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return { __badJson: true };
    }
  }
  if (!body || typeof body !== "object") body = {};
  return { ...(req.query || {}), ...body };
}

function ledgerView(input) {
  const id = input.id || input.rider_id || null;
  switch (String(input.view || "sales")) {
    case "sales":
      return { ok: true, sales: readers.listSales() };
    case "runs":
      return { ok: true, runs: readers.listRuns(id) };
    case "spend":
      return { ok: true, ...(id ? readers.readSpend(id) : { spend_cents: 0 }) };
    case "disputes":
      return { ok: true, disputes: readers.listDisputes(id) };
    case "receipts":
      return { ok: true, receipts: readers.listReceipts(id) };
    case "feed":
      return { ok: true, feed: readers.tailFeed(input.n !== undefined ? Number(input.n) : 100) };
    case "queue":
      return { ok: true, ...(readers.readQueue() || { depth: 0 }) };
    case "identity":
      if (!id) return { ok: false, error: "missing_identity" };
      return { ok: true, identity: readers.readIdentity(id) };
    default:
      return { ok: false, error: "unknown_view" };
  }
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  const input = readInput(req);
  if (input.__badJson) return fail(res, 400, "invalid_json");
  const action = String(input.action || "").trim();
  if (!action) return fail(res, 400, "missing_action", { actions: [...READ, ...WRITE] });

  const isGet = req.method === "GET";
  const isPost = req.method === "POST";
  if (isGet && !READ.has(action)) {
    return fail(res, WRITE.has(action) ? 405 : 400,
      WRITE.has(action) ? "method_not_allowed" : "unknown_action");
  }
  if (isPost && !WRITE.has(action)) {
    return fail(res, READ.has(action) ? 405 : 400,
      READ.has(action) ? "method_not_allowed" : "unknown_action");
  }
  if (!isGet && !isPost) return fail(res, 405, "method_not_allowed");

  try {
    switch (action) {
      case "feed-emit":
        return out(res, feed.emit(input.type, input.detail || {}));
      case "feed-tail":
        return send(res, 200, {
          ok: true,
          events: feed.tail(input.n !== undefined ? Number(input.n) : 10),
        });
      case "feed-types":
        return send(res, 200, { ok: true, types: OPS_EVENTS });
      case "dashboard":
        return out(res, await buildDashboard({}));
      case "alert-rules":
        return send(res, 200, { ok: true, rules: RULES.map((r) => r.id || r) });
      case "alert-evaluate": {
        const opts = {};
        if (Array.isArray(input.rules)) opts.rules = input.rules.filter((r) => typeof r === "string");
        return out(res, evaluate(input.snapshot || {}, opts));
      }
      case "audit-pack":
        return out(res, await buildAuditPack(input.query || input, {}));
      case "ledger":
        return out(res, ledgerView(input));
      case "analytics-rollup":
        return out(res, rollupUsage(input.receipts || []));
      case "analytics-info":
        return send(res, 200, { ok: true, info: "POST analytics-rollup with { receipts: [...] }" });
      case "health":
        return out(res, await health.check());
      default:
        return fail(res, 400, "unknown_action");
    }
  } catch (e) {
    return fail(res, 500, "internal", { detail: String((e && e.message) || e).slice(0, 200) });
  }
}
