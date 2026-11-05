/**
 * GET|POST /api/catalog — MCP catalog + storefront skills +
 * release attestation route.
 *
 * Dispatches by `action` (query for GET, body or query for POST):
 *   GET  mcp-list | mcp-get | sku-get | sku-quote | sku-list
 *        | release-verify
 *   POST mcp-register | release-build | release-verify
 *
 * Vercel-style default export(req, res). JSON envelope
 * { ok:true, ... } / { ok:false, error|reason }. Fail-closed throughout.
 * Offline-safe: in-memory MCP catalog; SHA-256 default hash; no network.
 * No key material in code (env only).
 */
import { createMcpCatalog } from "./lib/mcp-catalog.mjs";
import { getSku, quoteSku, createSkuCatalog } from "./lib/storefront-skills.mjs";
import {
  buildReleaseReceipt,
  verifyReleaseReceipt,
} from "./lib/release-attest.mjs";

const READ = new Set([
  "mcp-list",
  "mcp-get",
  "sku-get",
  "sku-quote",
  "sku-list",
  "release-verify",
]);
const WRITE = new Set(["mcp-register", "release-build", "release-verify"]);

const mcps = createMcpCatalog();
const skus = createSkuCatalog();

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
  if (code.startsWith("unknown_") || code === "not_found") return 404;
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
      case "mcp-register":
        return out(res, mcps.register(input.tool || input));
      case "mcp-get":
        return out(res, mcps.get(input.name, input.version));
      case "mcp-list":
        return send(res, 200, { ok: true, tools: mcps.list() });
      case "sku-get":
        return out(res, getSku(input.sku));
      case "sku-quote": {
        const opts = {};
        if (input.qty !== undefined) opts.qty = Number(input.qty);
        return out(res, quoteSku(input.sku, opts));
      }
      case "sku-list":
        return send(res, 200, { ok: true, skus: skus.list() });
      case "release-build":
        return out(res, buildReleaseReceipt(input.receipt || input, {}));
      case "release-verify":
        return out(res, verifyReleaseReceipt(input.receipt || input, input.opts || {}));
      default:
        return fail(res, 400, "unknown_action");
    }
  } catch (e) {
    return fail(res, 500, "internal", { detail: String((e && e.message) || e).slice(0, 200) });
  }
}
