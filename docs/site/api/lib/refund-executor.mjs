/**
 * Refund executor 0.1.0 — settles refund instructions from refund-disputes.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * executeRefund({ dispute_id, instruction }) runs the refund through the
 * injectable settle adapter (settle(instruction) => receipt). With no
 * adapter injected the offline default is a queued executor stub: the
 * refund is recorded { status:"queued" } and becomes claimable through
 * claimRefund({ dispute_id }) (queued -> claimed), then finalizable with
 * recordSettled({ dispute_id, receipt }). This module never holds keys,
 * never signs, and never broadcasts — settlement is always out of band
 * (operator signature), same model as operator-payouts.mjs and the
 * UNSIGNED instructions refund-disputes.mjs produces.
 *
 * Idempotent by dispute_id: repeating executeRefund for a settled/queued
 * dispute returns { ok:true, duplicate:true, record } without double
 * settlement or double queueing.
 *
 * Deterministic offline defaults: no network, no models. I/O injectable
 * via adapters ({ dir, now, id, settle }). Fail-closed envelopes.
 */
import { existsSync, mkdirSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { loadJson, CorruptStoreError, isCorruptStoreError } from "./failclosed-store.mjs";

export const REFUND_EXECUTOR_VERSION = "0.1.0";
export const DISPUTE_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
export const EXEC_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
export const STATUSES = ["queued", "claimed", "settled"];

function refundsDir(adapterDir) {
  if (adapterDir || process.env.REFUNDS_DIR) {
    const dir = String(adapterDir || process.env.REFUNDS_DIR);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
    return dir;
  }
  const base =
    process.env.AUTH_DIR ||
    (existsSync("/data") ? "/data" : null) ||
    join(tmpdir(), "spl-refunds");
  const dir = join(String(base), "refunds");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

function ledgerFile(dir) {
  return join(dir, "refunds.json");
}

function blank() {
  return { version: REFUND_EXECUTOR_VERSION, records: {} };
}

/**
 * Shared fail-closed loader (lib/failclosed-store.mjs): a missing file is
 * an empty book, but a corrupt file THROWS CorruptStoreError instead of
 * returning a blank book — a blank book would silently forget queued
 * refunds and allow double settlement. Every public entry maps the throw
 * to a fail-closed { ok:false, error:"corrupt_store" } envelope via
 * loadOrCorrupt() and returns before any save, so a corrupt file is never
 * overwritten.
 */
function load(dir) {
  const f = ledgerFile(dir);
  const o = loadJson(f, blank);
  if (!o || typeof o !== "object" || Array.isArray(o)) throw new CorruptStoreError(f, new Error("bad_shape"));
  if (!o.records || typeof o.records !== "object") throw new CorruptStoreError(f, new Error("bad_shape"));
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
  return `rfx_${randomBytes(8).toString("hex")}`;
}

function checkInstruction(instruction) {
  if (!instruction || typeof instruction !== "object") return fail("bad_instruction");
  const cents = Math.floor(Number(instruction.amount_cents));
  if (!Number.isSafeInteger(cents) || cents <= 0) return fail("bad_instruction_amount");
  if (!instruction.to || typeof instruction.to !== "string" || !instruction.to.trim()) {
    return fail("bad_instruction_destination");
  }
  if (instruction.requires && instruction.requires !== "operator_signature") {
    return fail("bad_instruction_requires");
  }
  return { ok: true, amount_cents: cents };
}

/**
 * Execute a refund instruction. With a settle adapter the receipt is
 * recorded settled; without one the refund is queued (claimable stub).
 * Idempotent by dispute_id.
 * Adapters: { dir, now, id, settle: (instruction) => receipt }.
 */
export function executeRefund({ dispute_id, instruction }, adapters = {}) {
  if (!DISPUTE_RE.test(String(dispute_id || ""))) return fail("bad_dispute_id");
  const checked = checkInstruction(instruction);
  if (!checked.ok) return checked;
  const dir = refundsDir(adapters.dir);
  const loaded = loadOrCorrupt(dir);
  if (!loaded.ok) return loaded;
  const store = loaded.store;
  const id = String(dispute_id);
  if (store.records[id]) return { ok: true, duplicate: true, record: store.records[id] };
  const now = adapters.now ? adapters.now() : new Date().toISOString();
  const execId = adapters.id ? adapters.id() : defaultId();
  if (!EXEC_RE.test(String(execId))) return fail("bad_exec_id");
  if (typeof adapters.settle === "function") {
    let receipt;
    try {
      receipt = adapters.settle({ ...instruction, dispute_id: id });
    } catch (e) {
      return fail("settle_failed", { detail: String((e && e.message) || e) });
    }
    if (!receipt || typeof receipt !== "object") return fail("bad_settle_receipt");
    const record = {
      exec_id: String(execId),
      dispute_id: id,
      instruction: { ...instruction },
      status: "settled",
      receipt,
      t_executed: now,
      t_updated: now,
    };
    store.records[id] = record;
    try {
      save(dir, store);
    } catch (e) {
      return fail("ledger_write_failed", { detail: String((e && e.message) || e) });
    }
    return { ok: true, record };
  }
  // Offline default: queued executor stub. Nothing moves until claimed
  // and settled out of band by operator signature.
  const record = {
    exec_id: String(execId),
    dispute_id: id,
    instruction: { ...instruction },
    status: "queued",
    receipt: null,
    t_queued: now,
    t_updated: now,
  };
  store.records[id] = record;
  try {
    save(dir, store);
  } catch (e) {
    return fail("ledger_write_failed", { detail: String((e && e.message) || e) });
  }
  return { ok: true, queued: true, record };
}

/** Claim a queued refund (queued -> claimed). Fail-closed otherwise. */
export function claimRefund({ dispute_id }, adapters = {}) {
  if (!DISPUTE_RE.test(String(dispute_id || ""))) return fail("bad_dispute_id");
  const dir = refundsDir(adapters.dir);
  const loaded = loadOrCorrupt(dir);
  if (!loaded.ok) return loaded;
  const store = loaded.store;
  const record = store.records[String(dispute_id)];
  if (!record) return fail("unknown_refund");
  if (record.status === "claimed") return { ok: true, duplicate: true, record };
  if (record.status !== "queued") return fail("not_claimable", { status: record.status });
  const now = adapters.now ? adapters.now() : new Date().toISOString();
  record.status = "claimed";
  record.t_claimed = now;
  record.t_updated = now;
  try {
    save(dir, store);
  } catch (e) {
    return fail("ledger_write_failed", { detail: String((e && e.message) || e) });
  }
  return { ok: true, record };
}

/** Finalize a claimed (or queued) refund with an out-of-band receipt. */
export function recordSettled({ dispute_id, receipt }, adapters = {}) {
  if (!DISPUTE_RE.test(String(dispute_id || ""))) return fail("bad_dispute_id");
  if (!receipt || typeof receipt !== "object") return fail("bad_receipt");
  const dir = refundsDir(adapters.dir);
  const loaded = loadOrCorrupt(dir);
  if (!loaded.ok) return loaded;
  const store = loaded.store;
  const record = store.records[String(dispute_id)];
  if (!record) return fail("unknown_refund");
  if (record.status === "settled") return { ok: true, duplicate: true, record };
  const now = adapters.now ? adapters.now() : new Date().toISOString();
  record.status = "settled";
  record.receipt = receipt;
  record.t_settled = now;
  record.t_updated = now;
  try {
    save(dir, store);
  } catch (e) {
    return fail("ledger_write_failed", { detail: String((e && e.message) || e) });
  }
  return { ok: true, record };
}

/** Read one execution record. Fail-closed on miss. */
export function getRefund(dispute_id, adapters = {}) {
  if (!DISPUTE_RE.test(String(dispute_id || ""))) return fail("bad_dispute_id");
  const loaded = loadOrCorrupt(refundsDir(adapters.dir));
  if (!loaded.ok) return loaded;
  const store = loaded.store;
  const record = store.records[String(dispute_id)];
  if (!record) return fail("unknown_refund");
  return { ok: true, record };
}

/** List queued (unclaimed) refunds. Pure read. */
export function listQueued(adapters = {}) {
  const loaded = loadOrCorrupt(refundsDir(adapters.dir));
  if (!loaded.ok) return loaded;
  const store = loaded.store;
  const queued = Object.values(store.records)
    .filter((r) => r && r.status === "queued")
    .sort((a, b) => String(a.t_queued || "").localeCompare(String(b.t_queued || "")));
  return { ok: true, queued };
}
