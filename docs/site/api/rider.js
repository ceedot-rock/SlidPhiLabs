/**
 * GET|POST /api/rider — grouped rider-identity route.
 *
 * Dispatches by `action` (query for GET, body or query for POST):
 *   GET  verify-standing | verify-rotation | verify-sub | reputation
 *        | stake-balance | stake-balances | bootstrap | probation
 *   POST issue-standing | revoke-standing | rotate-key
 *        | issue-sub | revoke-sub
 *        | record-run | post-stake | slash-stake
 *
 * Vercel-style default export(req, res). JSON envelope
 * { ok:true, ... } / { ok:false, error|reason }. Fail-closed: unknown
 * actions, wrong methods, and lib failures never throw.
 * Offline-safe: file ledgers use an in-memory fs adapter by default;
 * LEDGER_PATH / STAKE_LEDGER_PATH env still resolve the path.
 * Rider stores (standing + sub + rotation receipts) are file-backed by
 * default (RIDER_STORE_DIR or AUTH_DIR, else the OS tmpdir); set
 * RIDER_STORE=memory to opt back into process memory. Rotation secrets
 * stay on the module default (auto-seed): only receipts need to survive
 * restarts for verify-rotation, and an injected secrets registry would
 * fail new riders closed instead of seeding. A corrupt store
 * file fails every rider action closed with ledger_corrupt — never a
 * silent memory fallback.
 * No key material in code (env only).
 */
import { existsSync } from "node:fs";
import { logInternal } from "./lib/http-fail.mjs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  issueStandingRider,
  verifyStandingRider,
  revokeStandingRider,
  createFileMapStore,
} from "./lib/standing-rider.mjs";
import { rotateRiderKey, verifyRotation } from "./lib/rider-recovery.mjs";
import {
  issueSubRider,
  revokeSubRider,
  verifySubRider,
} from "./lib/sub-riders.mjs";
import {
  recordRun,
  operatorReputation,
} from "./lib/reputation-ledger.mjs";
import {
  bootstrapPrior,
  isProbation,
  newRiderScore,
  scoreWithProbation,
} from "./lib/reputation-bootstrap.mjs";
import {
  postStake,
  slashStake,
  stakeBalanceOf,
  stakeBalances,
} from "./lib/stake-slash.mjs";

const READ = new Set([
  "verify-standing",
  "verify-rotation",
  "verify-sub",
  "reputation",
  "stake-balance",
  "stake-balances",
  "bootstrap",
  "probation",
]);
const WRITE = new Set([
  "issue-standing",
  "revoke-standing",
  "rotate-key",
  "issue-sub",
  "revoke-sub",
  "record-run",
  "post-stake",
  "slash-stake",
]);

function makeMemFs() {
  const files = new Map();
  const missing = () => {
    const e = new Error("ENOENT: no such file");
    e.code = "ENOENT";
    return e;
  };
  return {
    mkdirSync() {},
    appendFileSync(p, s) {
      files.set(String(p), (files.get(String(p)) || "") + String(s));
    },
    readFileSync(p) {
      if (!files.has(String(p))) throw missing();
      return files.get(String(p));
    },
    writeFileSync(p, s) {
      files.set(String(p), String(s));
    },
  };
}
const memfs = makeMemFs();
const LEDGERS = { fs: memfs };

/**
 * Rider store adapters, file-backed by default. Lazily built once so a
 * corrupt store file fails rider actions closed (500 ledger_corrupt) via
 * the handler instead of crashing the route import.
 */
let riderStores = null;
function getRiderStores() {
  if (riderStores) return riderStores;
  const build = (name) => {
    if (process.env.RIDER_STORE === "memory") return new Map();
    const base =
      process.env.RIDER_STORE_DIR ||
      process.env.AUTH_DIR ||
      (existsSync("/data") ? "/data" : join(tmpdir(), "spl-rider"));
    return createFileMapStore({ file: join(String(base), name) });
  };
  try {
    riderStores = {
      ok: true,
      standing: { store: build("standing-riders.json") },
      subs: { store: build("sub-riders.json") },
      rotation: { store: build("rotation-receipts.json") },
    };
  } catch (e) {
    riderStores = {
      ok: false,
      error: "ledger_corrupt",
      detail: String((e && e.message) || e).slice(0, 200),
    };
  }
  return riderStores;
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

function statusFor(r) {
  const code = String(r.reason || r.error || "");
  if (
    code === "not_found" ||
    code === "unknown_rider" ||
    code.startsWith("unknown_") ||
    code === "missing_rider_id"
  ) {
    return 404;
  }
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

  const RIDER_ACTIONS = new Set([
    "issue-standing", "verify-standing", "revoke-standing",
    "issue-sub", "revoke-sub", "verify-sub",
    "rotate-key", "verify-rotation",
  ]);
  try {
    // Standing/sub/rotation rider actions always run against the injected
    // store adapter (file-backed default); nothing uses process-memory fallback.
    let stores = null;
    if (RIDER_ACTIONS.has(action)) {
      stores = getRiderStores();
      if (!stores.ok) return fail(res, 500, stores.error, { detail: stores.detail });
    }
    switch (action) {
      case "issue-standing":
        return out(res, issueStandingRider(input, stores.standing));
      case "verify-standing":
        return out(res, verifyStandingRider(input, stores.standing));
      case "revoke-standing":
        return out(res, revokeStandingRider(input, stores.standing));
      case "rotate-key":
        return out(res, rotateRiderKey(input, stores.rotation));
      case "verify-rotation":
        return out(res, verifyRotation(input, stores.rotation));
      case "issue-sub":
        return out(res, issueSubRider(input, stores.subs));
      case "revoke-sub":
        return out(res, revokeSubRider(input, stores.subs));
      case "verify-sub":
        return out(res, verifySubRider(input, stores.subs));
      case "record-run":
        return out(res, recordRun(input, LEDGERS));
      case "reputation":
        return out(res, operatorReputation(input.rider_id || input, LEDGERS));
      case "bootstrap":
        return send(res, 200, { ok: true, ...bootstrapPrior(), ...newRiderScore() });
      case "probation": {
        if (input.score !== undefined || input.runs !== undefined) {
          return out(res, scoreWithProbation(input));
        }
        const runs = Number(input.runs_count ?? 0);
        return send(res, 200, { ok: true, runs, probation: isProbation(input.runs_count ?? runs) });
      }
      case "post-stake":
        return out(res, postStake(input, LEDGERS));
      case "slash-stake":
        return out(res, slashStake(input, LEDGERS));
      case "stake-balance":
        return out(res, stakeBalanceOf(input, LEDGERS));
      case "stake-balances":
        return out(res, stakeBalances(LEDGERS));
      default:
        return fail(res, 400, "unknown_action");
    }
  } catch (e) {
    return fail(res, 500, "internal", { request_id: logInternal(req, "rider", e) });
  }
}
