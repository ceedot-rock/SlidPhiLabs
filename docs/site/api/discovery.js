/**
 * GET|POST /api/discovery — grouped discovery route (registry, directory,
 * templates, messaging, transport, compose).
 *
 * Dispatches by `action` (query for GET, body or query for POST):
 *   GET  tools | tool-get | persisted-get | persisted-list
 *        | versions | version-resolve | agents | agent-get
 *        | templates | template-expand | search
 *        | transport-pending | transport-inbox
 *   POST tool-register | persisted-register
 *        | version-register | agent-register
 *        | message-draft | message-quote | message-ack
 *        | transport-enqueue | transport-deliver | transport-ack
 *        | compose
 *
 * Vercel-style default export(req, res). JSON envelope
 * { ok:true, ... } / { ok:false, error|reason }. Fail-closed throughout.
 * Offline-safe: all catalogs are in-process memory singletons (the
 * persisted registry uses a memory fs adapter); no disk, no network.
 * No key material in code (env only).
 */
import { createToolRegistry } from "./lib/tool-registry.mjs";
import { logInternal } from "./lib/http-fail.mjs";
import { createPersistedRegistry } from "./lib/persisted-registry.mjs";
import { searchRegistry } from "./lib/registry-search.mjs";
import { createVersionCatalog } from "./lib/tool-versions.mjs";
import { createAgentDirectory } from "./lib/agent-directory.mjs";
import { listTemplates, expandTemplate } from "./lib/warrant-templates.mjs";
import { createMessenger } from "./lib/agent-messaging.mjs";
import { createMessageTransport } from "./lib/message-transport.mjs";
import { compileChain } from "./lib/compose-warrant.mjs";

const READ = new Set([
  "tools",
  "tool-get",
  "persisted-get",
  "persisted-list",
  "versions",
  "version-resolve",
  "agents",
  "agent-get",
  "templates",
  "template-expand",
  "search",
  "transport-pending",
  "transport-inbox",
]);
const WRITE = new Set([
  "tool-register",
  "persisted-register",
  "version-register",
  "agent-register",
  "message-draft",
  "message-quote",
  "message-ack",
  "transport-enqueue",
  "transport-deliver",
  "transport-ack",
  "compose",
]);

const tools = createToolRegistry();
const versions = createVersionCatalog();
const agents = createAgentDirectory();
const messenger = createMessenger();
const transport = createMessageTransport();

const pstore = new Map();
function pmissing() {
  const e = new Error("no such file");
  e.code = "ENOENT";
  return e;
}
const persisted = createPersistedRegistry({
  path: "memory/registry.jsonl",
  fs: {
    readFile: (p) => {
      if (!pstore.has(String(p))) throw pmissing();
      return pstore.get(String(p));
    },
    appendFile: (p, s) => pstore.set(String(p), (pstore.get(String(p)) || "") + String(s)),
    writeFile: (p, s) => pstore.set(String(p), String(s)),
    rename: (a, b) => {
      pstore.set(String(b), pstore.get(String(a)) || "");
      pstore.delete(String(a));
    },
  },
});

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
      case "tool-register":
        return out(res, tools.register(input.tool || input));
      case "tool-get":
        return out(res, tools.get(input.id, input.version));
      case "tools":
        return send(res, 200, { ok: true, tools: tools.list() });
      case "persisted-register":
        return out(res, persisted.register(input.tool || input));
      case "persisted-get":
        return out(res, persisted.get(input.id, input.version));
      case "persisted-list":
        return send(res, 200, { ok: true, tools: persisted.list() });
      case "version-register":
        return out(res, versions.register(input.tool || input));
      case "version-resolve":
        return out(res, versions.resolveVersion(input.id, input.spec || "latest"));
      case "versions":
        return out(res, versions.list(input.id));
      case "agent-register":
        return out(res, agents.register(input.agent || input));
      case "agent-get":
        return out(res, agents.get(input.rider_id));
      case "agents":
        return send(res, 200, { ok: true, agents: agents.list() });
      case "templates":
        return send(res, 200, { ok: true, templates: listTemplates() });
      case "template-expand":
        return out(res, expandTemplate(input.id, input.overrides || {}));
      case "search":
        return out(res, searchRegistry({
          query: input.query,
          tools: () => tools.list(),
          agents: () => agents.list(),
          limit: input.limit,
        }));
      case "message-draft":
        return out(res, messenger.draft(input.envelope || input));
      case "message-quote":
        return out(res, messenger.quote(input.envelope || input));
      case "message-ack":
        return out(res, messenger.ack(input.envelope || input));
      case "transport-enqueue":
        return out(res, transport.enqueue(input.message || input));
      case "transport-deliver":
        return out(res, transport.deliver());
      case "transport-ack":
        return out(res, transport.ack(input.ack_id));
      case "transport-pending":
        return out(res, transport.pending());
      case "transport-inbox":
        return out(res, transport.inbox(input.recipient));
      case "compose":
        // Deny-by-default: only tools registered in this route's registry
        // compile; unknown tools fail closed with unknown_tool.
        return out(res, compileChain({
          ...input,
          existsTool: typeof input.existsTool === "function"
            ? input.existsTool
            : (tool) => tools.get(tool).ok === true,
        }));
      default:
        return fail(res, 400, "unknown_action");
    }
  } catch (e) {
    return fail(res, 500, "internal", { request_id: logInternal(req, "discovery", e) });
  }
}
