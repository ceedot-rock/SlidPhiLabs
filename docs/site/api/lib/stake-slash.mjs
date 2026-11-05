/**
 * Stake ledger 0.1.0 — rider stake posting + slashing on a file ledger.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Deterministic, offline, dependency-free: one JSON object per line, no
 * network, no models. Slashing requires a reason and can never exceed the
 * posted balance (fail-closed). I/O is injectable via adapters so tests
 * never touch prod paths. Fail-closed envelopes: { ok:false, reason }.
 */
import fs from "node:fs";
import path from "node:path";

export const STAKE_VERSION = "0.1.0";
export const DEFAULT_STAKE_LEDGER_PATH = "/data/stake.jsonl";

/** Resolve the ledger path: adapter > STAKE_LEDGER_PATH env > default. */
export function resolveStakeLedgerPath(adapters = {}) {
  if (adapters && typeof adapters.ledgerPath === "string" && adapters.ledgerPath.length > 0) {
    return adapters.ledgerPath;
  }
  const env = (process.env.STAKE_LEDGER_PATH || "").trim();
  if (env) return env;
  return DEFAULT_STAKE_LEDGER_PATH;
}

function fsOf(adapters) {
  return (adapters && adapters.fs) || fs;
}

function nowMsOf(adapters) {
  if (adapters && typeof adapters.nowMs === "function") return adapters.nowMs();
  return Date.now();
}

function isNonEmptyString(x) {
  return typeof x === "string" && x.trim().length > 0;
}

function checkRiderId(rider_id) {
  if (!isNonEmptyString(rider_id)) return { ok: false, reason: "missing_rider_id" };
  return { ok: true, rider_id: rider_id.trim() };
}

function checkAmount(amount_cents) {
  const n = Number(amount_cents);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    return { ok: false, reason: "bad_amount", detail: "amount_cents must be a positive integer" };
  }
  return { ok: true, amount_cents: n };
}

function appendEntry(entry, adapters) {
  const f = fsOf(adapters);
  const ledgerPath = resolveStakeLedgerPath(adapters);
  try {
    const dir = path.dirname(ledgerPath);
    if (dir && dir !== "." && typeof f.mkdirSync === "function") {
      f.mkdirSync(dir, { recursive: true });
    }
    f.appendFileSync(ledgerPath, JSON.stringify(entry) + "\n", "utf8");
  } catch (e) {
    return { ok: false, reason: "ledger_write_failed", detail: String((e && e.message) || e).slice(0, 200) };
  }
  return { ok: true };
}

/**
 * Read every ledger entry. A missing ledger is an empty ledger (all-zero
 * balances), not an error; any other read/parse failure is fail-closed.
 */
export function readStakeEntries(adapters = {}) {
  const f = fsOf(adapters);
  const ledgerPath = resolveStakeLedgerPath(adapters);
  let raw;
  try {
    raw = f.readFileSync(ledgerPath, "utf8");
  } catch (e) {
    if (e && (e.code === "ENOENT" || /no such file/i.test(String((e && e.message) || e)))) {
      return { ok: true, entries: [] };
    }
    return { ok: false, reason: "ledger_read_failed", detail: String((e && e.message) || e).slice(0, 200) };
  }
  const entries = [];
  for (const line of String(raw).split("\n")) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line));
    } catch (e) {
      return { ok: false, reason: "ledger_corrupt", detail: String((e && e.message) || e).slice(0, 200) };
    }
  }
  return { ok: true, entries };
}

function tally(entries, rider_id) {
  let staked = 0;
  let slashed = 0;
  for (const e of entries) {
    if (!e || typeof e !== "object" || e.rider_id !== rider_id) continue;
    const n = Number(e.amount_cents);
    if (!Number.isFinite(n) || n <= 0) continue;
    if (e.type === "stake") staked += n;
    else if (e.type === "slash") slashed += n;
  }
  return { staked_cents: staked, slashed_cents: slashed, balance_cents: staked - slashed };
}

/**
 * Post stake for a rider. Adapters (all optional):
 * { ledgerPath, fs (node:fs-like), nowMs(): number }.
 */
export function postStake(input = {}, adapters = {}) {
  const root = input && typeof input === "object" ? input : {};
  const r = checkRiderId(root.rider_id);
  if (!r.ok) return r;
  const a = checkAmount(root.amount_cents);
  if (!a.ok) return a;
  const entry = {
    type: "stake",
    rider_id: r.rider_id,
    amount_cents: a.amount_cents,
    at: nowMsOf(adapters),
  };
  const w = appendEntry(entry, adapters);
  if (!w.ok) return w;
  return { ok: true, rider_id: r.rider_id, amount_cents: a.amount_cents, at: entry.at };
}

/**
 * Slash a rider's stake. A non-empty reason is required, and the slash can
 * never exceed the rider's current balance.
 */
export function slashStake(input = {}, adapters = {}) {
  const root = input && typeof input === "object" ? input : {};
  const r = checkRiderId(root.rider_id);
  if (!r.ok) return r;
  const a = checkAmount(root.amount_cents);
  if (!a.ok) return a;
  if (!isNonEmptyString(root.reason)) {
    return { ok: false, reason: "reason_required", detail: "slash reason must be a non-empty string" };
  }
  const read = readStakeEntries(adapters);
  if (!read.ok) return read;
  const t = tally(read.entries, r.rider_id);
  if (a.amount_cents > t.balance_cents) {
    return {
      ok: false,
      reason: "insufficient_stake",
      rider_id: r.rider_id,
      balance_cents: t.balance_cents,
    };
  }
  const entry = {
    type: "slash",
    rider_id: r.rider_id,
    amount_cents: a.amount_cents,
    reason: root.reason.trim(),
    at: nowMsOf(adapters),
  };
  const w = appendEntry(entry, adapters);
  if (!w.ok) return w;
  return {
    ok: true,
    rider_id: r.rider_id,
    amount_cents: a.amount_cents,
    reason: entry.reason,
    at: entry.at,
  };
}

/** Queryable balance for one rider (zero when the rider never staked). */
export function stakeBalanceOf(input, adapters = {}) {
  const id = typeof input === "string" ? input : input && input.rider_id;
  const r = checkRiderId(id);
  if (!r.ok) return r;
  const read = readStakeEntries(adapters);
  if (!read.ok) return read;
  return { ok: true, rider_id: r.rider_id, ...tally(read.entries, r.rider_id) };
}

/** Queryable balances for every rider seen in the ledger. */
export function stakeBalances(adapters = {}) {
  const read = readStakeEntries(adapters);
  if (!read.ok) return read;
  const out = {};
  for (const e of read.entries) {
    if (!e || typeof e !== "object" || !isNonEmptyString(e.rider_id)) continue;
    if (!out[e.rider_id]) out[e.rider_id] = { staked_cents: 0, slashed_cents: 0, balance_cents: 0 };
    const n = Number(e.amount_cents);
    if (!Number.isFinite(n) || n <= 0) continue;
    if (e.type === "stake") {
      out[e.rider_id].staked_cents += n;
      out[e.rider_id].balance_cents += n;
    } else if (e.type === "slash") {
      out[e.rider_id].slashed_cents += n;
      out[e.rider_id].balance_cents -= n;
    }
  }
  return { ok: true, balances: out };
}
