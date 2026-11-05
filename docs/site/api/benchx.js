/**
 * GET|POST /api/benchx — extended bench route: private held-out bench
 * plus fixture-seed pack helpers. (The public /api/bench route is
 * untouched; this file only adds new actions.)
 *
 * Dispatches by `action` (query for GET, body or query for POST):
 *   GET  private-info | pack-path-check
 *   POST private-run | pack-manifest | pack-verify
 *
 * Fail-closed by design: private-run without an injected fixtures
 * adapter refuses with no_public_fixture and never leaks held-out
 * bytes; pack-verify only accepts inline { manifest, files } maps with
 * size caps. Vercel-style default export(req, res). No network, no keys.
 */
import { runPrivateBench } from "./lib/private-bench.mjs";
import {
  BENCHHAUS_VERSION,
  BENCHHAUS_WEIGHTS,
  PROVENANCE_DEFAULT,
  TIE_RULE,
} from "./lib/benchhaus.mjs";
import {
  isSafePackPath,
  createPackManifest,
  verifyPack,
} from "./lib/fixture-seeds.mjs";

const READ = new Set(["private-info", "pack-path-check", "benchhaus-info"]);
const WRITE = new Set(["private-run", "pack-manifest", "pack-verify"]);

const MAX_PACK_FILES = 32;
const MAX_PACK_BYTES = 256 * 1024;

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

function inlineReader(files) {
  if (!files || typeof files !== "object" || Array.isArray(files)) return null;
  const names = Object.keys(files);
  if (names.length > MAX_PACK_FILES) return null;
  let total = 0;
  const bufs = new Map();
  for (const name of names) {
    if (!isSafePackPath(name)) return null;
    const v = files[name];
    const buf = typeof v === "string" ? Buffer.from(v, "utf8") : null;
    if (!buf) return null;
    total += buf.length;
    if (total > MAX_PACK_BYTES) return null;
    bufs.set(name, buf);
  }
  return (file) => {
    if (!bufs.has(String(file))) throw new Error("missing_file");
    return bufs.get(String(file));
  };
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
      case "private-info":
        return send(res, 200, {
          ok: true,
          info: "Held-out bench: fixtures are never bundled or fetched; POST private-run with an injected adapter server-side only.",
        });
      case "benchhaus-info":
        // Read-only metadata: no fixtures, no scores, no run path. Full
        // benchhaus runs stay platform-only (metered ACN stage) because
        // the public fixtures are memorizable; see lib/benchhaus.mjs.
        return send(res, 200, {
          ok: true,
          benchhaus: {
            version: BENCHHAUS_VERSION,
            weights: { ...BENCHHAUS_WEIGHTS },
            provenance: PROVENANCE_DEFAULT,
            tieRule: TIE_RULE,
            suites: ["plan-exactness", "retrieval-precision", "state-tracking", "refusal-robustness"],
          },
        });
      case "private-run":
        // No adapter is ever accepted over HTTP: fixtures stay server-side.
        return out(res, runPrivateBench(input.spec || {}, {}));
      case "pack-manifest":
        return out(res, createPackManifest(input));
      case "pack-verify": {
        const readFile = inlineReader(input.files);
        if (!readFile) return fail(res, 400, "bad_files");
        return out(res, verifyPack(input.manifest, readFile));
      }
      case "pack-path-check":
        return send(res, 200, {
          ok: true,
          file: String(input.file || ""),
          safe: isSafePackPath(input.file),
        });
      default:
        return fail(res, 400, "unknown_action");
    }
  } catch (e) {
    return fail(res, 500, "internal", { detail: String((e && e.message) || e).slice(0, 200) });
  }
}
