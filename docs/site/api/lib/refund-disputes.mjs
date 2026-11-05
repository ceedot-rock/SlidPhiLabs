/**
 * Refund disputes 0.1.0 — open/resolve purchase disputes with refund
 * instructions and a reputation hook payload.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * openDispute() fails closed on unknown orders: the order must be known
 * either through the injectable lookupOrder adapter (production wires this
 * to the sales ledger / x402 spent ledger) or through the local
 * known-orders book (recordKnownOrder). No adapter and no book entry means
 * { ok:false, error:"unknown_order" } — never a dispute against nothing.
 *
 * resolveDispute() with decision "refund" produces an UNSIGNED refund
 * instruction (operator signs out of band, same as operator-payouts.mjs)
 * plus a reputation hook payload for the caller to deliver. Decision
 * "deny" produces only the reputation payload. Disputes are single-shot:
 * a second resolve fails closed with "already_resolved".
 *
 * Deterministic offline defaults: no network, no models. I/O injectable
 * via adapters ({ dir, now, id, lookupOrder }). Fail-closed envelopes.
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

export const DISPUTES_VERSION = "0.1.0";
export const ORDER_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
export const DISPUTE_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
export const DECISIONS = ["refund", "deny"];
export const MAX_REASON_LEN = 2000;

function disputesDir(adapterDir) {
  if (adapterDir || process.env.DISPUTES_DIR) {
    const dir = String(adapterDir || process.env.DISPUTES_DIR);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
    return dir;
  }
  const base =
    process.env.AUTH_DIR ||
    (existsSync("/data") ? "/data" : null) ||
    join(tmpdir(), "spl-disputes");
  const dir = join(String(base), "disputes");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

function ledgerFile(dir) {
  return join(dir, "disputes.json");
}

function blank() {
  return { version: DISPUTES_VERSION, orders: {}, disputes: {} };
}

function load(dir) {
  const f = ledgerFile(dir);
  if (!existsSync(f)) return blank();
  try {
    const o = JSON.parse(readFileSync(f, "utf8"));
    if (!o || typeof o !== "object") return blank();
    if (!o.orders || typeof o.orders !== "object") o.orders = {};
    if (!o.disputes || typeof o.disputes !== "object") o.disputes = {};
    return o;
  } catch {
    return blank();
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
  return `dp_${randomBytes(8).toString("hex")}`;
}

/**
 * Register a paid order in the local known-orders book so openDispute()
 * can find it without an adapter. Production prefers the lookupOrder
 * adapter wired to the real sales ledger; this book is the offline
 * deterministic fallback. Idempotent on order_id.
 */
export function recordKnownOrder({ order_id, amount_cents, chain = null, refund_to = null, agent_id = null }, adapters = {}) {
  if (!ORDER_RE.test(String(order_id || ""))) return fail("bad_order_id");
  const cents = Math.floor(Number(amount_cents));
  if (!Number.isSafeInteger(cents) || cents <= 0) return fail("bad_amount");
  const dir = disputesDir(adapters.dir);
  const store = load(dir);
  if (store.orders[order_id]) return { ok: true, duplicate: true, order: store.orders[order_id] };
  const order = {
    order_id: String(order_id),
    amount_cents: cents,
    chain: chain ? String(chain) : null,
    refund_to: refund_to ? String(refund_to) : null,
    agent_id: agent_id ? String(agent_id) : null,
  };
  store.orders[order_id] = order;
  try {
    save(dir, store);
  } catch (e) {
    return fail("ledger_write_failed", { detail: String((e && e.message) || e) });
  }
  return { ok: true, order };
}

function findOrder(store, orderId, lookupOrder) {
  if (typeof lookupOrder === "function") {
    try {
      const o = lookupOrder(orderId);
      if (o && typeof o === "object") return o;
    } catch {
      return null; // adapter failure fails closed below
    }
    return null;
  }
  return store.orders[orderId] || null;
}

/**
 * Open a dispute against a known order. Fail-closed on unknown order.
 * Adapters: { dir, now, id, lookupOrder: (order_id) => order|null }.
 */
export function openDispute({ order_id, reason }, adapters = {}) {
  const orderId = String(order_id || "");
  if (!ORDER_RE.test(orderId)) return fail("bad_order_id");
  const why = String(reason || "").trim().slice(0, MAX_REASON_LEN);
  if (!why) return fail("bad_reason");
  const dir = disputesDir(adapters.dir);
  const store = load(dir);
  const order = findOrder(store, orderId, adapters.lookupOrder);
  if (!order) return fail("unknown_order");
  const now = adapters.now ? adapters.now() : new Date().toISOString();
  const id = adapters.id ? adapters.id() : defaultId();
  if (!DISPUTE_RE.test(String(id))) return fail("bad_dispute_id");
  if (store.disputes[id]) return { ok: true, duplicate: true, dispute: store.disputes[id] };
  const dispute = {
    id: String(id),
    order_id: orderId,
    order_snapshot: { ...order },
    reason: why,
    status: "open",
    resolution: null,
    t_opened: now,
    t_updated: now,
  };
  store.disputes[dispute.id] = dispute;
  try {
    save(dir, store);
  } catch (e) {
    return fail("ledger_write_failed", { detail: String((e && e.message) || e) });
  }
  return { ok: true, dispute };
}

/**
 * Resolve an open dispute. "refund" yields an UNSIGNED refund instruction
 * (operator signs out of band) plus a reputation hook payload; "deny"
 * yields the reputation payload only.
 */
export function resolveDispute({ dispute_id, decision, resolved_by = null }, adapters = {}) {
  if (!DISPUTE_RE.test(String(dispute_id || ""))) return fail("bad_dispute_id");
  if (!DECISIONS.includes(decision)) return fail("bad_decision", { decisions: DECISIONS });
  const dir = disputesDir(adapters.dir);
  const store = load(dir);
  const dispute = store.disputes[dispute_id];
  if (!dispute) return fail("unknown_dispute");
  if (dispute.status !== "open") return fail("already_resolved", { status: dispute.status });
  const now = adapters.now ? adapters.now() : new Date().toISOString();
  const order = dispute.order_snapshot || {};
  const hook = {
    hook: "reputation",
    event: decision === "refund" ? "dispute_refunded" : "dispute_denied",
    subject: order.agent_id || order.refund_to || dispute.order_id,
    dispute_id: dispute.id,
    order_id: dispute.order_id,
    t: now,
  };
  let refund_instruction = null;
  if (decision === "refund") {
    // Unsigned: operator signature required before any funds move.
    refund_instruction = {
      order_id: dispute.order_id,
      amount_cents: order.amount_cents || null,
      asset: "USDC",
      chain: order.chain || null,
      to: order.refund_to || null,
      requires: "operator_signature",
    };
  }
  dispute.status = decision === "refund" ? "refunded" : "denied";
  dispute.t_updated = now;
  dispute.resolution = {
    decision,
    resolved_by: resolved_by ? String(resolved_by) : null,
    refund_instruction,
    reputation_hook: hook,
    t_resolved: now,
  };
  try {
    save(dir, store);
  } catch (e) {
    return fail("ledger_write_failed", { detail: String((e && e.message) || e) });
  }
  return { ok: true, dispute, refund_instruction, reputation_hook: hook };
}

/** Read one dispute. Fail-closed on miss. */
export function getDispute(dispute_id, adapters = {}) {
  if (!DISPUTE_RE.test(String(dispute_id || ""))) return { ok: false, error: "bad_dispute_id" };
  const store = load(disputesDir(adapters.dir));
  const dispute = store.disputes[dispute_id];
  if (!dispute) return { ok: false, error: "unknown_dispute" };
  return { ok: true, dispute };
}

/** List all disputes, oldest first. */
export function listDisputes(adapters = {}) {
  const store = load(disputesDir(adapters.dir));
  const disputes = Object.values(store.disputes).sort((a, b) =>
    String(a.t_opened).localeCompare(String(b.t_opened)),
  );
  return { ok: true, disputes };
}
