/**
 * Founding grants — 10% of the first 100 ACN signups ride 6 months free.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * The first 100 signup sequence numbers are the founding window; sequences
 * 1-10 carry a 6-month grant (180 days, repo month convention) with monthly
 * caps: 10 GiB metered input and a $25 spend ceiling per 30-day window.
 * Within caps the seat rides free; past the spend ceiling metered work
 * refuses fail-closed (same posture as the tollkeeper cap). Grants bind one
 * rider_id, are non-transferable, and are RECORDED — free is never silent.
 *
 * Deterministic offline math; the only I/O is the file ledger through an
 * injectable dir. A corrupt ledger fails closed and is never overwritten.
 */
import { existsSync, mkdirSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { homedir, tmpdir } from "node:os";
import { loadJson, CorruptStoreError, isCorruptStoreError } from "./failclosed-store.mjs";

/**
 * User-local persistent home for ACN ledgers. Grants must survive reboots
 * and logins on boxes with no AUTH_DIR, so the last fallback is ~/.acn —
 * never the temp dir (entries there evaporate and seats would be lost).
 */
function userLocalDir(area) {
  try {
    const home = homedir();
    if (home) return join(home, ".acn", area);
  } catch {
    // fall through to tmp
  }
  return join(tmpdir(), "spl-" + area);
}

export const FOUNDING_GRANTS_VERSION = "0.1.0";
export const FOUNDING_WINDOW = 100;
export const FOUNDING_GRANT_COUNT = 10;
export const GRANT_TERM_MS = 180 * 24 * 60 * 60 * 1000;
export const GRANT_MONTHLY_BYTES = 10 * 1024 * 1024 * 1024;
export const GRANT_MONTHLY_CAP_CENTS = 2500;
export const RIDER_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

function grantsDir(adapterDir) {
  if (adapterDir || process.env.FOUNDING_DIR) {
    const dir = String(adapterDir || process.env.FOUNDING_DIR);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
    return dir;
  }
  const base =
    process.env.AUTH_DIR ||
    (existsSync("/data") ? "/data" : null) ||
    userLocalDir("founding");
  const dir = join(String(base), "founding");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

function ledgerFile(dir) {
  return join(dir, "grants.json");
}

function blank() {
  return { version: FOUNDING_GRANTS_VERSION, grants: {} };
}

function nowOf(adapters) {
  if (adapters && typeof adapters.nowMs === "function") {
    const n = Math.floor(Number(adapters.nowMs()));
    if (Number.isSafeInteger(n) && n >= 0) return n;
  }
  return Date.now();
}

function normEmail(e) {
  const s = String(e == null ? "" : e).trim().toLowerCase();
  return s || null;
}

function validSeq(seq) {
  return Number.isSafeInteger(seq) && seq >= 1;
}

function validRider(riderId) {
  return typeof riderId === "string" && RIDER_RE.test(riderId);
}

function load(dir) {
  const o = loadJson(ledgerFile(dir), blank);
  if (!o || typeof o !== "object" || Array.isArray(o)) {
    throw new CorruptStoreError(ledgerFile(dir), new Error("bad_shape"));
  }
  if (!o.grants || typeof o.grants !== "object" || Array.isArray(o.grants)) {
    throw new CorruptStoreError(ledgerFile(dir), new Error("bad_grants"));
  }
  return o;
}

function save(dir, book) {
  const f = ledgerFile(dir);
  const tmp = f + ".tmp";
  writeFileSync(tmp, JSON.stringify(book), { mode: 0o600 });
  renameSync(tmp, f);
}

function caps() {
  return {
    monthly_bytes: GRANT_MONTHLY_BYTES,
    monthly_cap_cents: GRANT_MONTHLY_CAP_CENTS,
  };
}

/**
 * Issue (or idempotently re-read) the founding grant for a signup sequence.
 * Sequences 1-10 grant; 11-100 are in-window but ungranted; past 100 the
 * window is closed. Same seq + same rider replays the stored grant.
 */
export function issueFoundingGrant(input = {}, adapters = {}) {
  const o = input && typeof input === "object" ? input : {};
  if (!validSeq(o.seq)) return { ok: false, error: "bad_seq" };
  if (!validRider(o.rider_id)) return { ok: false, error: "bad_rider_id" };
  if (o.seq > FOUNDING_WINDOW) return { ok: false, error: "outside_window" };
  if (o.seq > FOUNDING_GRANT_COUNT) return { ok: false, error: "not_founding" };
  const dir = grantsDir(adapters && adapters.dir);
  const now = nowOf(adapters);
  let book;
  try {
    book = load(dir);
  } catch (e) {
    if (isCorruptStoreError(e)) return { ok: false, error: "corrupt_store" };
    throw e;
  }
  const key = String(o.seq);
  const prior = book.grants[key];
  if (prior) {
    if (prior.rider_id !== o.rider_id) return { ok: false, error: "seq_taken" };
    return { ok: true, duplicate: true, grant: prior };
  }
  const grant = {
    seq: o.seq,
    rider_id: o.rider_id,
    email: normEmail(o.email),
    issued_ms: now,
    expires_ms: now + GRANT_TERM_MS,
    caps: caps(),
    status: "active",
  };
  book.grants[key] = grant;
  try {
    save(dir, book);
  } catch {
    return { ok: false, error: "store_failed" };
  }
  return { ok: true, duplicate: false, grant };
}

/** Read one grant's live status. Expired grants report active:false. */
export function foundingStatus(input = {}, adapters = {}) {
  const o = input && typeof input === "object" ? input : {};
  if (!validSeq(o.seq)) return { ok: false, error: "bad_seq" };
  const dir = grantsDir(adapters && adapters.dir);
  const now = nowOf(adapters);
  let book;
  try {
    book = load(dir);
  } catch (e) {
    if (isCorruptStoreError(e)) return { ok: false, error: "corrupt_store" };
    throw e;
  }
  const grant = book.grants[String(o.seq)];
  if (!grant) return { ok: false, error: "unknown_grant" };
  const active = now < grant.expires_ms;
  return {
    ok: true,
    seq: grant.seq,
    rider_id: grant.rider_id,
    active,
    issued_ms: grant.issued_ms,
    expires_ms: grant.expires_ms,
    remaining_ms: Math.max(0, grant.expires_ms - now),
    caps: grant.caps,
  };
}

/**
 * Enforce the monthly spend ceiling for a grant seat. spent_cents is the
 * caller's metered total for the current 30-day window. Expired or unknown
 * grants refuse; spend past the ceiling refuses with cap_exceeded.
 */
export function checkGrantSpend(input = {}, adapters = {}) {
  const o = input && typeof input === "object" ? input : {};
  const spent = Math.max(0, Math.floor(Number(o.spent_cents)) || 0);
  const st = foundingStatus({ seq: o.seq }, adapters);
  if (!st.ok) return st;
  if (!st.active) return { ok: false, error: "grant_expired" };
  const cap = GRANT_MONTHLY_CAP_CENTS;
  if (spent > cap) {
    return { ok: false, error: "cap_exceeded", spent_cents: spent, cap_cents: cap };
  }
  const fraction = cap > 0 ? spent / cap : 0;
  return {
    ok: true,
    spent_cents: spent,
    cap_cents: cap,
    fraction,
    alert: fraction >= 0.8,
    remaining_cents: cap - spent,
  };
}
