/**
 * Reputation ledger 0.1.0 — append-only operator reputation log.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Deterministic, offline, dependency-free: one JSON object per line, no
 * network, no models. I/O is injectable via adapters so tests never touch
 * prod paths. Fail-closed envelopes: { ok:false, reason }.
 */
import fs from "node:fs";
import path from "node:path";

export const REPUTATION_VERSION = "0.1.0";
export const DEFAULT_LEDGER_PATH = "/data/reputation.jsonl";

/** Resolve the ledger path: adapter > LEDGER_PATH env > default. */
export function resolveLedgerPath(adapters = {}) {
  if (adapters && typeof adapters.ledgerPath === "string" && adapters.ledgerPath.length > 0) {
    return adapters.ledgerPath;
  }
  const env = (process.env.LEDGER_PATH || "").trim();
  if (env) return env;
  return DEFAULT_LEDGER_PATH;
}

function fsOf(adapters) {
  return (adapters && adapters.fs) || fs;
}

function nowMsOf(adapters) {
  if (adapters && typeof adapters.nowMs === "function") return adapters.nowMs();
  return Date.now();
}

function clamp01(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function isNonEmptyString(x) {
  return typeof x === "string" && x.trim().length > 0;
}

/**
 * Append one run to the ledger. Adapters (all optional):
 * { ledgerPath, fs (node:fs-like), nowMs(): number }.
 */
export function recordRun(input = {}, adapters = {}) {
  const root = input && typeof input === "object" ? input : {};
  if (!isNonEmptyString(root.rider_id)) {
    return { ok: false, reason: "missing_rider_id" };
  }
  if (typeof root.ok !== "boolean") {
    return { ok: false, reason: "bad_run", detail: "ok must be boolean" };
  }
  const amount = Number(root.amount_cents);
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, reason: "bad_run", detail: "amount_cents must be a number >= 0" };
  }
  const f = fsOf(adapters);
  const ledgerPath = resolveLedgerPath(adapters);
  const at = nowMsOf(adapters);
  const line =
    JSON.stringify({
      rider_id: root.rider_id,
      ok: root.ok,
      amount_cents: amount,
      dispute: root.dispute === true,
      refund: root.refund === true,
      at,
    }) + "\n";
  try {
    const dir = path.dirname(ledgerPath);
    if (dir && dir !== "." && typeof f.mkdirSync === "function") {
      f.mkdirSync(dir, { recursive: true });
    }
    f.appendFileSync(ledgerPath, line, "utf8");
  } catch (e) {
    return { ok: false, reason: "ledger_write_failed", detail: String((e && e.message) || e).slice(0, 200) };
  }
  return { ok: true, rider_id: root.rider_id, at };
}

/**
 * Read the ledger and summarize one operator.
 * disputes = runs with ok:false or dispute:true. refunds = refund:true.
 * score = runs ? (runs - disputes - 0.5*refunds)/runs : 1, clamped 0..1.
 */
export function operatorReputation(riderId, adapters = {}) {
  const id = typeof riderId === "string" ? riderId : riderId && riderId.rider_id;
  if (!isNonEmptyString(id)) {
    return { ok: false, reason: "missing_rider_id" };
  }
  const f = fsOf(adapters);
  const ledgerPath = resolveLedgerPath(adapters);
  let raw;
  try {
    raw = f.readFileSync(ledgerPath, "utf8");
  } catch (e) {
    if (e && (e.code === "ENOENT" || /no such file/i.test(String(e.message)))) {
      return { ok: true, rider_id: id, runs: 0, disputes: 0, refunds: 0, score: 1 };
    }
    return { ok: false, reason: "ledger_read_failed", detail: String((e && e.message) || e).slice(0, 200) };
  }
  let runs = 0;
  let disputes = 0;
  let refunds = 0;
  for (const line of String(raw).split("\n")) {
    const t = line.trim();
    if (!t) continue;
    let rec;
    try {
      rec = JSON.parse(t);
    } catch {
      continue;
    }
    if (!rec || rec.rider_id !== id) continue;
    runs++;
    if (rec.ok === false || rec.dispute === true) disputes++;
    if (rec.refund === true) refunds++;
  }
  const score = runs === 0 ? 1 : clamp01((runs - disputes - 0.5 * refunds) / runs);
  return { ok: true, rider_id: id, runs, disputes, refunds, score };
}
