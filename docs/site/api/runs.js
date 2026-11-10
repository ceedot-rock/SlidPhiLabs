/**
 * GET|POST /api/runs — grouped async-runs / executor / policies /
 * schedules / binding-quotes / sandbox dry-run route.
 *
 * Dispatches by `action` (query for GET, body or query for POST):
 *   GET  poll | runs-list | policies | policy-get | policy-for
 *        | schedules | schedule-get | quote-hash
 *   POST submit | complete | execute | schedule-add | schedule-remove
 *        | quote-create | quote-honor | dry-run
 *
 * Vercel-style default export(req, res). JSON envelope
 * { ok:true, ... } / { ok:false, error }. Fail-closed throughout.
 * Offline-safe: the run store is in-process memory; the wired executor
 * only serves the offline `echo` demo fn (unknown_fn otherwise), so no
 * network, no keys, and no arbitrary code execution over HTTP.
 */
import { createRunManager } from "./lib/async-runs.mjs";
import { logInternal } from "./lib/http-fail.mjs";
import { createRunExecutor } from "./lib/run-executor.mjs";
import { policyFor, getPolicy, listPolicies } from "./lib/run-policies.mjs";
import { createScheduleStore } from "./lib/scheduled-runs.mjs";
import { specHash, createQuote, honorQuote } from "./lib/binding-quotes.mjs";
import { dryRun } from "./lib/sandbox-mode.mjs";

const READ = new Set([
  "poll",
  "runs-list",
  "policies",
  "policy-get",
  "policy-for",
  "schedules",
  "schedule-get",
  "quote-hash",
]);
const WRITE = new Set([
  "submit",
  "complete",
  "execute",
  "schedule-add",
  "schedule-remove",
  "quote-create",
  "quote-honor",
  "dry-run",
]);

async function echoExecutor(spec) {
  if (!spec || typeof spec !== "object" || spec.fn !== "echo") {
    return { error: "unknown_fn", receipts: [] };
  }
  return { receipts: [{ ok: true, echoed: spec.args !== undefined ? spec.args : {} }] };
}
const runs = createRunManager({ executor: createRunExecutor({ registry: { echo: echoExecutor } }) });
// File-backed schedule book when SCHEDULES_FILE is set, else in-process
// memory (see lib/scheduled-runs.mjs file option).
const schedules = createScheduleStore(
  process.env.SCHEDULES_FILE ? { file: process.env.SCHEDULES_FILE } : {},
);

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
      case "submit":
        return out(res, runs.submitRun(input.spec || {}));
      case "poll":
        return out(res, runs.pollRun(input.run_id));
      case "complete":
        return out(res, runs.completeRun(input.run_id, input.result || {}));
      case "execute":
        return out(res, await runs.executeRun(input.run_id));
      case "runs-list":
        return send(res, 200, { ok: true, runs: runs.listRuns() });
      case "policies":
        return send(res, 200, { ok: true, policies: listPolicies() });
      case "policy-get":
        return out(res, getPolicy(input.name));
      case "policy-for":
        return send(res, 200, { ok: true, policy: policyFor(input.spec || {}, {}) });
      case "schedule-add":
        return out(res, schedules.addSchedule(input.schedule || input));
      case "schedule-get":
        return out(res, schedules.getSchedule(input.schedule_id));
      case "schedule-remove":
        return out(res, schedules.removeSchedule(input.schedule_id));
      case "schedules":
        return send(res, 200, { ok: true, schedules: schedules.listSchedules() });
      case "quote-create":
        return out(res, createQuote(input.spec || {}, input.amount_cents));
      case "quote-honor":
        return out(res, honorQuote(input.quote, input.spec || {}, input.live_amount_cents));
      case "quote-hash":
        return send(res, 200, { ok: true, spec_hash: specHash(input.spec || {}) });
      case "dry-run":
        return out(res, dryRun(input.spec || {}, {}));
      default:
        return fail(res, 400, "unknown_action");
    }
  } catch (e) {
    return fail(res, 500, "internal", { request_id: logInternal(req, "runs", e) });
  }
}
