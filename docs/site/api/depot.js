/**
 * GET|POST /api/depot — gitdepot receipt route.
 *
 * Dispatches by `action` (query for GET, body or query for POST):
 *   GET  verify | price
 *   POST issue | verify
 *
 * Vercel-style default export(req, res). JSON envelope
 * { ok:true, ... } / { ok:false, error|reason }. Fail-closed: issue
 * returns null on bad input (mapped to 400) and never throws.
 * Offline-safe: pure functions, no disk, no network. No keys in code.
 */
import {
  buildDepotReceipt,
  verifyDepotReceipt,
  defaultDepotPrice,
} from "./lib/depot-receipts.mjs";

const READ = new Set(["verify", "price"]);
const WRITE = new Set(["issue", "verify"]);

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
      case "issue": {
        const receipt = buildDepotReceipt(input);
        if (!receipt) return fail(res, 400, "invalid_receipt_input");
        return send(res, 200, { ok: true, receipt });
      }
      case "verify": {
        const r = verifyDepotReceipt(input.receipt || input);
        if (r && r.ok) {
          const { ok, ...rest } = r;
          return send(res, 200, { ok: true, ...rest });
        }
        return fail(res, 400, (r && (r.reason || r.error)) || "invalid_receipt");
      }
      case "price": {
        const bytes = Math.floor(Number(input.bytes));
        if (!Number.isSafeInteger(bytes) || bytes < 0) return fail(res, 400, "bad_bytes");
        return send(res, 200, { ok: true, bytes, quoted_cents: defaultDepotPrice(bytes) });
      }
      default:
        return fail(res, 400, "unknown_action");
    }
  } catch (e) {
    return fail(res, 500, "internal", { detail: String((e && e.message) || e).slice(0, 200) });
  }
}
