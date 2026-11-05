/**
 * Subscriptions 0.1.0 — recurring rider entitlements with proration math.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * createSubscription({ rider_id, sku, interval, amount_cents }) records a
 * subscription and returns { sub_id, next_due } (next_due is epoch ms).
 * dueSubs(nowMs) lists active subscriptions with next_due <= nowMs.
 * recordRenewal({ sub_id }) advances next_due one interval from
 * max(nowMs, next_due) so overdue renewals restart the clock instead of
 * stacking back-bills. prorateUpgrade() prices plan upgrades in exact
 * integer cents: credit for unused time on the old plan, charge for the
 * same window on the new plan, due_now = charge - credit (negative means
 * a credit owed to the rider).
 *
 * Deterministic offline defaults: no network, no models. I/O injectable
 * via adapters ({ dir, nowMs, id }). Fail-closed envelopes throughout.
 * Intervals: "month" (30 days) and "year" (365 days), fixed ms windows so
 * next_due is deterministic and timezone-free.
 */
import { existsSync, mkdirSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { loadJson, CorruptStoreError, isCorruptStoreError } from "./failclosed-store.mjs";

export const SUBSCRIPTIONS_VERSION = "0.1.0";
export const RIDER_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
export const SKU_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;
export const SUB_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
export const INTERVALS = {
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
};

function subsDir(adapterDir) {
  if (adapterDir || process.env.SUBS_DIR) {
    const dir = String(adapterDir || process.env.SUBS_DIR);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
    return dir;
  }
  const base =
    process.env.AUTH_DIR ||
    (existsSync("/data") ? "/data" : null) ||
    join(tmpdir(), "spl-subs");
  const dir = join(String(base), "subs");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

function ledgerFile(dir) {
  return join(dir, "subs.json");
}

function blank() {
  return { version: SUBSCRIPTIONS_VERSION, subs: {} };
}

/**
 * Shared fail-closed loader (lib/failclosed-store.mjs): a missing file is
 * an empty book, but a corrupt file THROWS CorruptStoreError instead of
 * returning a blank book — a blank book would silently forget active
 * subscriptions and their next_due clock. Every public entry maps the
 * throw to a fail-closed { ok:false, error:"corrupt_store" } envelope via
 * loadOrCorrupt() and returns before any save, so a corrupt file is never
 * overwritten. Proration math (prorateUpgrade) is unchanged.
 */
function load(dir) {
  const f = ledgerFile(dir);
  const o = loadJson(f, blank);
  if (!o || typeof o !== "object" || Array.isArray(o)) throw new CorruptStoreError(f, new Error("bad_shape"));
  if (!o.subs || typeof o.subs !== "object") throw new CorruptStoreError(f, new Error("bad_shape"));
  return o;
}

/** load() that returns a fail-closed envelope instead of throwing. */
function loadOrCorrupt(dir) {
  try {
    return { ok: true, store: load(dir) };
  } catch (e) {
    if (isCorruptStoreError(e)) return { ok: false, error: "corrupt_store" };
    throw e;
  }
}

function save(dir, o) {
  const f = ledgerFile(dir);
  const tmp = `${f}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(o), { mode: 0o600 });
  renameSync(tmp, f);
}

function fail(error, extra = {}) {
  return { ok: false, error, ...extra };
}

function defaultId() {
  return `sub_${randomBytes(8).toString("hex")}`;
}

function nowMsOf(adapters) {
  if (adapters.nowMs) return Math.floor(Number(adapters.nowMs()));
  if (adapters.now) {
    const v = adapters.now();
    const ms = typeof v === "number" ? v : Date.parse(v);
    if (Number.isSafeInteger(Math.floor(ms))) return Math.floor(ms);
  }
  return Date.now();
}

/**
 * Create a subscription. interval defaults to "month".
 * Returns { ok:true, sub_id, next_due, sub }.
 */
export function createSubscription({ rider_id, sku, interval = "month", amount_cents }, adapters = {}) {
  if (!RIDER_RE.test(String(rider_id || ""))) return fail("bad_rider_id");
  if (!SKU_RE.test(String(sku || ""))) return fail("bad_sku");
  const periodMs = INTERVALS[String(interval || "")];
  if (!periodMs) return fail("bad_interval", { intervals: Object.keys(INTERVALS) });
  const cents = Math.floor(Number(amount_cents));
  if (!Number.isSafeInteger(cents) || cents <= 0) return fail("bad_amount");
  const now = nowMsOf(adapters);
  if (!Number.isSafeInteger(now) || now < 0) return fail("bad_now");
  const id = adapters.id ? adapters.id() : defaultId();
  if (!SUB_RE.test(String(id))) return fail("bad_sub_id");
  const dir = subsDir(adapters.dir);
  const loaded = loadOrCorrupt(dir);
  if (!loaded.ok) return loaded;
  const store = loaded.store;
  if (store.subs[id]) return { ok: true, duplicate: true, sub_id: id, next_due: store.subs[id].next_due, sub: store.subs[id] };
  const sub = {
    sub_id: String(id),
    rider_id: String(rider_id),
    sku: String(sku),
    interval: String(interval),
    amount_cents: cents,
    status: "active",
    t_started: now,
    next_due: now + periodMs,
    renewals: 0,
  };
  store.subs[sub.sub_id] = sub;
  try {
    save(dir, store);
  } catch (e) {
    return fail("ledger_write_failed", { detail: String((e && e.message) || e) });
  }
  return { ok: true, sub_id: sub.sub_id, next_due: sub.next_due, sub };
}

/** Read one subscription. Fail-closed on miss. */
export function getSubscription(sub_id, adapters = {}) {
  if (!SUB_RE.test(String(sub_id || ""))) return fail("bad_sub_id");
  const loaded = loadOrCorrupt(subsDir(adapters.dir));
  if (!loaded.ok) return loaded;
  const store = loaded.store;
  const sub = store.subs[sub_id];
  if (!sub) return fail("unknown_sub");
  return { ok: true, sub };
}

/** Active subscriptions with next_due <= nowMs. Pure read. */
export function dueSubs(nowMs, adapters = {}) {
  const now = Math.floor(Number(nowMs));
  if (!Number.isSafeInteger(now) || now < 0) return fail("bad_now");
  const loaded = loadOrCorrupt(subsDir(adapters.dir));
  if (!loaded.ok) return loaded;
  const store = loaded.store;
  const due = Object.values(store.subs)
    .filter((s) => s && s.status === "active" && Number.isSafeInteger(s.next_due) && s.next_due <= now)
    .sort((a, b) => a.next_due - b.next_due);
  return { ok: true, now_ms: now, due };
}

/**
 * Record one renewal: advances next_due a single interval from
 * max(nowMs, next_due). Idempotent per call (each call advances once).
 */
export function recordRenewal({ sub_id }, adapters = {}) {
  if (!SUB_RE.test(String(sub_id || ""))) return fail("bad_sub_id");
  const dir = subsDir(adapters.dir);
  const loaded = loadOrCorrupt(dir);
  if (!loaded.ok) return loaded;
  const store = loaded.store;
  const sub = store.subs[sub_id];
  if (!sub) return fail("unknown_sub");
  if (sub.status !== "active") return fail("sub_not_active", { status: sub.status });
  const periodMs = INTERVALS[sub.interval];
  if (!periodMs) return fail("bad_interval", { interval: sub.interval });
  const now = nowMsOf(adapters);
  if (!Number.isSafeInteger(now) || now < 0) return fail("bad_now");
  sub.next_due = Math.max(now, sub.next_due) + periodMs;
  sub.renewals += 1;
  sub.t_last_renewal = now;
  try {
    save(dir, store);
  } catch (e) {
    return fail("ledger_write_failed", { detail: String((e && e.message) || e) });
  }
  return { ok: true, sub_id: sub.sub_id, next_due: sub.next_due, renewals: sub.renewals, sub };
}

/**
 * Proration math for plan upgrades (pure, no I/O). All integer cents:
 * credit = floor(old * remaining / period), charge = floor(new *
 * remaining / period), due_now = charge - credit. Negative due_now is a
 * credit owed to the rider. Downgrades (new < old) are computed the same
 * way; callers decide whether to refund or bank the credit.
 */
export function prorateUpgrade({ old_amount_cents, new_amount_cents, next_due, now_ms, period_ms }) {
  const oldC = Math.floor(Number(old_amount_cents));
  const newC = Math.floor(Number(new_amount_cents));
  const due = Math.floor(Number(next_due));
  const now = Math.floor(Number(now_ms));
  const period = Math.floor(Number(period_ms));
  if (!Number.isSafeInteger(oldC) || oldC <= 0) return fail("bad_old_amount");
  if (!Number.isSafeInteger(newC) || newC <= 0) return fail("bad_new_amount");
  if (!Number.isSafeInteger(due) || !Number.isSafeInteger(now)) return fail("bad_time");
  if (!Number.isSafeInteger(period) || period <= 0) return fail("bad_period");
  const remaining = Math.max(0, due - now);
  const credit_cents = Math.floor((oldC * remaining) / period);
  const charge_cents = Math.floor((newC * remaining) / period);
  return {
    ok: true,
    remaining_ms: remaining,
    period_ms: period,
    credit_cents,
    charge_cents,
    due_now_cents: charge_cents - credit_cents,
  };
}
