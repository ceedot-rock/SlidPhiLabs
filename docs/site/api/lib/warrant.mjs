/**
 * Warrant — signed mandate + receipts for a Rider identity.
 * Rider says who acted. Warrant says what they may do. A receipt is the paper trail.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 */
import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const RIDER_VERIFY_URL =
  process.env.RIDER_VERIFY_URL || "https://agentrider.fly.dev/api/rider/verify";
export const FREE_RECEIPTS_PER_DAY = 10;
export const FREE_ISSUES_PER_DAY = 3;
export const ACTIONS = Object.freeze(["spend", "fetch", "publish", "compress", "invoke"]);

function dataDir() {
  const d =
    process.env.WARRANT_DIR ||
    path.join(process.env.AUTH_DIR || (fs.existsSync("/data") ? "/data" : path.join(process.cwd(), "data")), "warrant");
  fs.mkdirSync(d, { recursive: true });
  fs.mkdirSync(path.join(d, "warrants"), { recursive: true });
  fs.mkdirSync(path.join(d, "receipts"), { recursive: true });
  return d;
}

function secret() {
  const env = (process.env.WARRANT_SECRET || "").trim();
  if (env.length >= 16) return env;
  const p = path.join(dataDir(), "secret.txt");
  if (fs.existsSync(p)) return fs.readFileSync(p, "utf8").trim();
  const s = randomBytes(32).toString("hex");
  fs.writeFileSync(p, s, { mode: 0o600 });
  return s;
}

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

function hmac(text) {
  return createHmac("sha256", secret()).update(text).digest();
}

function signPayload(payload) {
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(hmac(body));
  return `w1.${body}.${sig}`;
}

function parseToken(token) {
  if (typeof token !== "string") return { ok: false, reason: "missing_warrant" };
  const parts = token.trim().split(".");
  if (parts.length !== 3 || parts[0] !== "w1") return { ok: false, reason: "bad_format" };
  const [_, body, sig] = parts;
  const expect = b64url(hmac(body));
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "bad_signature" };
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "bad_payload" };
  }
  return { ok: true, payload };
}

function warrantPath(id) {
  return path.join(dataDir(), "warrants", `${id}.json`);
}
function receiptPath(id) {
  return path.join(dataDir(), "receipts", `${id}.json`);
}
function meterPath() {
  return path.join(dataDir(), "meter.json");
}

function loadJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
}
function saveJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function hostAllowed(allow, host) {
  const h = String(host || "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
  if (!h) return false;
  const rules = Array.isArray(allow) ? allow : [];
  for (const raw of rules) {
    const r = String(raw || "").trim().toLowerCase();
    if (!r) continue;
    if (r === "*") return true;
    if (r === h) return true;
    if (r.startsWith(".") && h.endsWith(r)) return true;
    if (r.startsWith("*.") && h.endsWith(r.slice(1))) return true;
  }
  return false;
}

function cleanActions(list) {
  const out = [];
  for (const a of Array.isArray(list) ? list : []) {
    const s = String(a || "").toLowerCase();
    if (ACTIONS.includes(s) && !out.includes(s)) out.push(s);
  }
  return out.length ? out : ["invoke"];
}

function cleanHosts(list) {
  const out = [];
  for (const h of Array.isArray(list) ? list : []) {
    const s = String(h || "").trim().toLowerCase();
    if (s && !out.includes(s)) out.push(s);
  }
  return out.length ? out : ["www.slidphilabs.com"];
}

export async function verifyRiderToken(token) {
  if (!token || typeof token !== "string") return { valid: false, reason: "missing_rider" };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(RIDER_VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rider: token }),
      signal: ctrl.signal,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.valid === false) {
      return { valid: false, reason: json.reason || `rider_http_${res.status}` };
    }
    if (json.valid && json.rider) return { valid: true, rider: json.rider };
    if (json.rider) return { valid: true, rider: json.rider };
    return { valid: false, reason: json.reason || "rider_unverified" };
  } catch (e) {
    return { valid: false, reason: e.name === "AbortError" ? "rider_timeout" : "rider_unreachable" };
  } finally {
    clearTimeout(t);
  }
}

function takeMeter(kind, key, cap) {
  const meter = loadJson(meterPath(), {});
  const day = dayKey();
  if (!meter[day]) meter[day] = {};
  if (!meter[day][kind]) meter[day][kind] = {};
  const n = Number(meter[day][kind][key] || 0);
  if (n >= cap) return { ok: false, used: n, cap };
  meter[day][kind][key] = n + 1;
  saveJson(meterPath(), meter);
  return { ok: true, used: n + 1, cap };
}

export function issueWarrant({
  rider,
  actions,
  allow_hosts,
  max_usd = 1,
  max_calls = 20,
  ttl_seconds = 3600,
  demo = false,
  paid = false,
} = {}) {
  const now = Math.floor(Date.now() / 1000);
  const ttl = Math.max(30, Math.min(Number(ttl_seconds) || 3600, 7 * 24 * 3600));
  const agent_id = rider?.agent_id || (demo ? "demo" : "");
  const operator_id = rider?.operator_id || (demo ? "demo" : "");
  if (!agent_id) return { ok: false, reason: "missing_agent" };

  if (!paid && !demo) {
    const m = takeMeter("issue", operator_id || agent_id, FREE_ISSUES_PER_DAY);
    if (!m.ok) return { ok: false, reason: "free_issue_cap", ...m, sku: "warrant-month" };
  }

  const id = (demo ? "wrt_demo_" : "wrt_") + randomBytes(8).toString("hex");
  const payload = {
    v: 1,
    id,
    agent_id,
    operator_id,
    rider_jti: rider?.jti || null,
    level: rider?.level || (demo ? "L0" : null),
    actions: demo ? ["invoke"] : cleanActions(actions),
    allow_hosts: demo ? ["www.slidphilabs.com", "slidphilabs.fly.dev"] : cleanHosts(allow_hosts),
    max_usd: Math.max(0, Number(max_usd) || 0),
    max_calls: Math.max(1, Math.min(Number(max_calls) || 20, 10000)),
    demo: !!demo,
    iat: now,
    exp: now + ttl,
  };
  const token = signPayload(payload);
  const record = {
    ...payload,
    remaining_usd: payload.max_usd,
    remaining_calls: payload.max_calls,
    revoked: false,
    receipts: [],
  };
  saveJson(warrantPath(id), record);
  return { ok: true, warrant: record, token, header_to_send: "X-Agent-Warrant" };
}

export function readWarrant(token) {
  const parsed = parseToken(token);
  if (!parsed.ok) return parsed;
  const rec = loadJson(warrantPath(parsed.payload.id), null);
  if (!rec) return { ok: false, reason: "unknown_warrant" };
  if (rec.revoked) return { ok: false, reason: "revoked", warrant: rec };
  const now = Math.floor(Date.now() / 1000);
  if (rec.exp && now > rec.exp) return { ok: false, reason: "expired", warrant: rec };
  return { ok: true, warrant: rec, payload: parsed.payload };
}

export function verifyWarrant(token, { host, action } = {}) {
  const got = readWarrant(token);
  if (!got.ok) return got;
  const w = got.warrant;
  if (action && !w.actions.includes(String(action).toLowerCase())) {
    return { ok: false, reason: "action_not_allowed", warrant: w };
  }
  if (host && !hostAllowed(w.allow_hosts, host)) {
    return { ok: false, reason: "host_not_allowed", warrant: w };
  }
  if (w.remaining_calls <= 0) return { ok: false, reason: "calls_exhausted", warrant: w };
  return { ok: true, warrant: w };
}

export function fileReceipt({
  token,
  action,
  host,
  usd = 0,
  request_sha256,
  result_sha256,
  note,
  paid = false,
} = {}) {
  const check = verifyWarrant(token, { host, action });
  if (!check.ok) return check;
  const w = check.warrant;
  const cost = Math.max(0, Number(usd) || 0);
  if (cost > w.remaining_usd + 1e-9) return { ok: false, reason: "usd_exhausted", warrant: w };

  if (!paid && !w.demo) {
    const m = takeMeter("receipt", w.operator_id || w.agent_id, FREE_RECEIPTS_PER_DAY);
    if (!m.ok) return { ok: false, reason: "free_receipt_cap", ...m, sku: "warrant-month" };
  }

  const id = "rcp_" + randomBytes(8).toString("hex");
  const receipt = {
    v: 1,
    id,
    warrant_id: w.id,
    agent_id: w.agent_id,
    operator_id: w.operator_id,
    action: String(action || "invoke").toLowerCase(),
    host: String(host || "").toLowerCase(),
    usd: cost,
    request_sha256: request_sha256 ? String(request_sha256) : null,
    result_sha256: result_sha256 ? String(result_sha256) : null,
    note: note ? String(note).slice(0, 240) : null,
    ts: new Date().toISOString(),
  };
  w.remaining_usd = Math.max(0, +(w.remaining_usd - cost).toFixed(6));
  w.remaining_calls -= 1;
  w.receipts.push(id);
  saveJson(warrantPath(w.id), w);
  saveJson(receiptPath(id), receipt);
  return { ok: true, receipt, warrant: publicWarrant(w) };
}

export function revokeWarrant(token) {
  const got = readWarrant(token);
  if (!got.ok && got.reason !== "expired") return got;
  const w = got.warrant || loadJson(warrantPath(parseToken(token).payload?.id || ""), null);
  if (!w) return { ok: false, reason: "unknown_warrant" };
  w.revoked = true;
  saveJson(warrantPath(w.id), w);
  return { ok: true, warrant: publicWarrant(w) };
}

export function getWarrant(id) {
  const rec = loadJson(warrantPath(id), null);
  if (!rec) return { ok: false, reason: "unknown_warrant" };
  return { ok: true, warrant: publicWarrant(rec) };
}

export function getReceipt(id) {
  const rec = loadJson(receiptPath(id), null);
  if (!rec) return { ok: false, reason: "unknown_receipt" };
  return { ok: true, receipt: rec };
}

export function listReceipts(warrantId) {
  const rec = loadJson(warrantPath(warrantId), null);
  if (!rec) return { ok: false, reason: "unknown_warrant" };
  const receipts = (rec.receipts || []).map((id) => loadJson(receiptPath(id), null)).filter(Boolean);
  return { ok: true, warrant_id: warrantId, receipts };
}

export function publicWarrant(w) {
  if (!w) return null;
  return {
    id: w.id,
    agent_id: w.agent_id,
    operator_id: w.operator_id,
    rider_jti: w.rider_jti,
    level: w.level,
    actions: w.actions,
    allow_hosts: w.allow_hosts,
    max_usd: w.max_usd,
    max_calls: w.max_calls,
    remaining_usd: w.remaining_usd,
    remaining_calls: w.remaining_calls,
    demo: !!w.demo,
    revoked: !!w.revoked,
    iat: w.iat,
    exp: w.exp,
    receipt_count: (w.receipts || []).length,
  };
}

export function sha256Hex(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

export function productCard() {
  return {
    name: "Warrant",
    job: "Signed mandate + receipts for a Rider identity.",
    rider: "https://agentrider.fly.dev",
    page: "https://www.slidphilabs.com/warrant",
    issue: "POST /api/warrant/issue",
    verify: "POST /api/warrant/verify",
    receipt: "POST /api/warrant/receipt",
    header: "X-Agent-Warrant",
    pairs_with: "X-Agent-Rider",
    price: { month: 29, year: 290, sku_month: "warrant-month", sku_year: "warrant-year" },
    free: { issues_per_day: FREE_ISSUES_PER_DAY, receipts_per_day: FREE_RECEIPTS_PER_DAY },
  };
}
