/**
 * GET|POST /api/conductor — conductor tasks + review route.
 *
 * Dispatches by `action` (query for GET, body or query for POST):
 *   GET  task-get | tasks-list | diff-stat
 *   POST task-intent | task-push | task-review | task-approve | task-reject
 *        | review
 *
 * Vercel-style default export(req, res). JSON envelope
 * { ok:true, ... } / { ok:false, error }. Fail-closed throughout;
 * review runs with no LLM hook (deterministic offline grading only).
 * Offline-safe: in-memory task store, no disk, no network.
 */
import {
  intentTask,
  pushTask,
  reviewTask,
  approveTask,
  rejectTask,
  getTask,
  listTasks,
} from "./lib/conductor-tasks.mjs";
import { reviewChanges, diffStat, diffFiles } from "./lib/conductor-review.mjs";

const READ = new Set(["task-get", "tasks-list", "diff-stat"]);
const WRITE = new Set([
  "task-intent",
  "task-push",
  "task-review",
  "task-approve",
  "task-reject",
  "review",
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
  const outBody = Array.isArray(body) ? {} : body;
  return { ...(req.query || {}), ...outBody, __rawBody: body };
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
      case "task-intent":
        return out(res, intentTask(input.task || input));
      case "task-push":
        return out(res, pushTask(input.task_id, input.detail));
      case "task-review":
        return out(res, reviewTask(input.task_id, input.review || input));
      case "task-approve":
        return out(res, approveTask(input.task_id, input.detail));
      case "task-reject":
        return out(res, rejectTask(input.task_id, input.review || input));
      case "task-get":
        return out(res, getTask(input.task_id));
      case "tasks-list":
        return out(res, Array.isArray(listTasks()) ? { ok: true, tasks: listTasks() } : listTasks());
      case "review":
        return out(res, reviewChanges(input.review || input, {}));
      case "diff-stat": {
        const diff = typeof input.diff === "string" ? input.diff : "";
        return send(res, 200, { ok: true, ...diffStat(diff), files: diffFiles(diff) });
      }
      default:
        return fail(res, 400, "unknown_action");
    }
  } catch (e) {
    return fail(res, 500, "internal", { detail: String((e && e.message) || e).slice(0, 200) });
  }
}
