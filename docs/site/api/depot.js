/**
 * GET|POST /api/depot — gitdepot receipt route.
 *
 * Dispatches by `action` (query for GET, body or query for POST):
 *   GET  verify | price | repo-get | repos-list | pr-get | prs-list | blame
 *   POST issue | verify | repo-create | branch-create | commit-record
 *        | pr-open | pr-review | pr-merge
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
import {
  createRepo,
  getRepo,
  listRepos,
  createBranch,
  recordCommit,
  openPr,
  getPr,
  listPrs,
  reviewPr,
  mergePr,
  blame,
} from "./lib/gitforge.mjs";

const READ = new Set(["verify", "price", "repo-get", "repos-list", "pr-get", "prs-list", "blame"]);
const WRITE = new Set([
  "issue",
  "verify",
  "repo-create",
  "branch-create",
  "commit-record",
  "pr-open",
  "pr-review",
  "pr-merge",
]);

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
  const code = String((r && (r.error || r.reason)) || "");
  if (code === "not_found" || code.endsWith("_not_found") || code.startsWith("unknown_")) return 404;
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
      case "repo-create":
        return out(res, createRepo(input.repo && typeof input.repo === "object" ? input.repo : input));
      case "branch-create":
        return out(res, createBranch(input.branch && typeof input.branch === "object" ? input.branch : input));
      case "commit-record":
        return out(res, recordCommit(input.commit || input));
      case "pr-open":
        return out(res, openPr(input.pr || input));
      case "pr-review":
        return out(res, reviewPr(input));
      case "pr-merge":
        return out(res, mergePr(input));
      case "repo-get":
        return out(res, getRepo(input.repo ?? input.full ?? input.ref ?? input.name));
      case "repos-list":
        return send(res, 200, { ok: true, repos: listRepos() });
      case "pr-get":
        return out(res, getPr(input));
      case "prs-list": {
        if (input.repo) return out(res, listPrs(input.repo));
        return send(res, 200, { ok: true, prs: listPrs() });
      }
      case "blame":
        return out(res, blame(input.blame || input));
      default:
        return fail(res, 400, "unknown_action");
    }
  } catch (e) {
    return fail(res, 500, "internal", { detail: String((e && e.message) || e).slice(0, 200) });
  }
}
