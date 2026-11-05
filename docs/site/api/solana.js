/**
 * GET|POST /api/solana — Solana rail + receipt verification route.
 *
 * Dispatches by `action` (query for GET, body or query for POST):
 *   GET  config | receive | amounts | transfers | verify
 *   POST verify
 *
 * Vercel-style default export(req, res). JSON envelope
 * { ok:true, ... } / { ok:false, error }. Fail-closed throughout:
 * without a configured payTo the rail reports rail_disabled; without
 * an RPC adapter, verification reports keystore_locked and never
 * touches the network. Config values come from env only — no key
 * material in code, and secret env values are never echoed.
 */
import {
  solanaRailConfig,
  centsToRaw as railCentsToRaw,
  buildReceiveInstruction,
  verifySolanaReceiptSync,
} from "./lib/solana-rail.mjs";
import {
  centsToRaw as verifyCentsToRaw,
  extractTransfers,
  verifyReceiptSync,
} from "./lib/solana-verify.mjs";

const READ = new Set(["config", "receive", "amounts", "transfers", "verify"]);
const WRITE = new Set(["verify"]);

function publicConfig(cfg) {
  return {
    network: cfg.network,
    asset: cfg.asset,
    decimals: cfg.decimals,
    enabled: cfg.enabled,
    configured: cfg.enabled === true,
  };
}

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
  return fail(res, 400, (r && (r.error || r.reason)) || "request_failed", rest);
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
      case "config":
        return send(res, 200, { ok: true, ...publicConfig(solanaRailConfig()) });
      case "receive":
        return out(res, buildReceiveInstruction({ amount_cents: input.amount_cents }));
      case "amounts": {
        const cents = Math.floor(Number(input.amount_cents));
        return send(res, 200, {
          ok: true,
          amount_cents: cents,
          rail_raw: railCentsToRaw(input.amount_cents),
          verify_raw: verifyCentsToRaw(input.amount_cents),
        });
      }
      case "transfers":
        return send(res, 200, { ok: true, transfers: extractTransfers(input.tx || {}) });
      case "verify": {
        const first = verifyReceiptSync(
          { signature: input.signature, expected: input.expected },
          {},
        );
        if (first && first.ok) {
          const { ok, ...rest } = first;
          return send(res, 200, { ok: true, ...rest });
        }
        const second = verifySolanaReceiptSync({ tx: input.signature || input.tx }, {});
        if (second && second.ok) {
          const { ok, ...rest } = second;
          return send(res, 200, { ok: true, ...rest });
        }
        return fail(res, 400, (first && first.error) || "verify_failed", {
          rail: second && second.error ? second.error : undefined,
        });
      }
      default:
        return fail(res, 400, "unknown_action");
    }
  } catch (e) {
    return fail(res, 500, "internal", { detail: String((e && e.message) || e).slice(0, 200) });
  }
}
