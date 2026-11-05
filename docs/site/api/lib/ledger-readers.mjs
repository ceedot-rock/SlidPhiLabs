/**
 * Ledger readers 0.1.0 — live JSONL file readers for ops observability.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * These are the injectable readers that audit-export and ops-dashboard
 * need, pointed at the real ledger defaults: sales, reputation, payouts,
 * disputes, and ops feed JSONL files. Paths resolve as
 * overrides > env > default. Reads are tolerant: missing files yield
 * empty results, blank lines are skipped, malformed lines are skipped but
 * COUNTED (malformedCount() exposes { malformed_count, by_path } so ops
 * can see ledger rot instead of silently dropping it), and no reader
 * ever throws — every fault returns an empty list or zero, so a corrupt
 * line can never break a dashboard or audit pack. The raw file reader
 * is injectable ({ read }) so tests never touch prod paths.
 */

import { readFileSync } from "node:fs";

export const LEDGER_READERS_VERSION = "0.1.0";

/** Real ledger defaults: env override, else the /data volume path. */
export const DEFAULT_PATHS = Object.freeze({
  sales: process.env.SALES_LEDGER_PATH || "/data/sales.jsonl",
  reputation: process.env.LEDGER_PATH || "/data/reputation.jsonl",
  payouts: process.env.PAYOUTS_LEDGER_PATH || "/data/payouts.jsonl",
  disputes: process.env.DISPUTES_LEDGER_PATH || "/data/disputes.jsonl",
  feed: process.env.OPS_FEED_PATH || "/data/ops.jsonl",
});

export const FEED_TAIL_DEFAULT = 100;

const IDENTITY_KEYS = ["rider_id", "rider", "operator", "operator_id", "agent_id"];

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function text(v) {
  return v == null ? "" : String(v);
}

function cents(v) {
  const n = Math.floor(Number(v));
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

/**
 * Resolve live ledger paths: explicit overrides win, then env, then default.
 * @param {object} [overrides] { sales, reputation, payouts, disputes, feed }.
 */
export function resolvePaths(overrides = {}) {
  const o = isPlainObject(overrides) ? overrides : {};
  return {
    sales: text(o.sales).trim() || text(process.env.SALES_LEDGER_PATH).trim() || DEFAULT_PATHS.sales,
    reputation:
      text(o.reputation).trim() || text(process.env.LEDGER_PATH).trim() || DEFAULT_PATHS.reputation,
    payouts:
      text(o.payouts).trim() ||
      text(process.env.PAYOUTS_LEDGER_PATH).trim() ||
      DEFAULT_PATHS.payouts,
    disputes:
      text(o.disputes).trim() ||
      text(process.env.DISPUTES_LEDGER_PATH).trim() ||
      DEFAULT_PATHS.disputes,
    feed: text(o.feed).trim() || text(process.env.OPS_FEED_PATH).trim() || DEFAULT_PATHS.feed,
  };
}

/** A line matches when it names no identity (unattributed) or names id. */
export function matchId(line, id) {
  if (id === undefined || id === null || id === "") return true;
  if (!isPlainObject(line)) return false;
  const want = String(id);
  let named = false;
  for (const key of IDENTITY_KEYS) {
    if (line[key] === undefined || line[key] === null || line[key] === "") continue;
    named = true;
    if (String(line[key]) === want) return true;
  }
  if (isPlainObject(line.detail)) {
    for (const key of IDENTITY_KEYS) {
      if (line.detail[key] === undefined || line.detail[key] === null || line.detail[key] === "") {
        continue;
      }
      named = true;
      if (String(line.detail[key]) === want) return true;
    }
  }
  return !named;
}

/**
 * Create live ledger readers.
 * @param {object} [opts] { paths, read } — read(path) => utf8 string.
 */
export function createLedgerReaders(opts = {}) {
  const o = isPlainObject(opts) ? opts : {};
  const paths = resolvePaths(isPlainObject(o.paths) ? o.paths : o);
  const read = typeof o.read === "function" ? o.read : (p) => readFileSync(p, "utf8");
  const malformedByPath = new Map();

  function noteMalformed(path) {
    malformedByPath.set(path, (malformedByPath.get(path) || 0) + 1);
  }

  function readLines(path) {
    let raw;
    try {
      raw = read(path);
    } catch {
      return [];
    }
    if (typeof raw !== "string" || raw === "") return [];
    const out = [];
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      try {
        out.push(JSON.parse(t));
      } catch {
        noteMalformed(path); // skipped but counted, never silent
      }
    }
    return out;
  }

  /** Malformed-line counters since this reader was created. */
  function malformedCount() {
    let malformed_count = 0;
    const by_path = {};
    for (const [p, n] of malformedByPath) {
      by_path[p] = n;
      malformed_count += n;
    }
    return { malformed_count, by_path };
  }

  function listSales() {
    return readLines(paths.sales).filter(isPlainObject);
  }

  function listRuns(id) {
    return readLines(paths.feed)
      .filter((e) => isPlainObject(e) && text(e.type) === "run_completed" && matchId(e, id))
      .map((e) => ({
        status: "completed",
        tool: text(e.detail && (e.detail.tool || e.detail.route || e.detail.cmd)) || "unknown",
        at: text(e.at),
      }));
  }

  function readSpend(id) {
    let spendCents = 0;
    for (const s of readLines(paths.sales)) {
      if (!isPlainObject(s) || !matchId(s, id)) continue;
      spendCents += cents(s.amount_cents);
    }
    return { spend_cents: spendCents };
  }

  function listDisputes(id) {
    return readLines(paths.disputes).filter((d) => isPlainObject(d) && matchId(d, id));
  }

  function listReceipts(id) {
    const sales = readLines(paths.sales).filter((s) => isPlainObject(s) && matchId(s, id));
    const payouts = readLines(paths.payouts).filter((p) => isPlainObject(p) && matchId(p, id));
    return [...sales, ...payouts];
  }

  function tailFeed(n = FEED_TAIL_DEFAULT) {
    const count = Number.isSafeInteger(n) && n > 0 ? n : FEED_TAIL_DEFAULT;
    return readLines(paths.feed).slice(-count);
  }

  function readQueue() {
    let depth = 0;
    for (const e of readLines(paths.feed)) {
      if (!isPlainObject(e) || !isPlainObject(e.detail)) continue;
      const st = text(e.detail.status);
      if (st === "queued" || st === "running") depth += 1;
    }
    return { depth };
  }

  function readIdentity(id) {
    const name = text(id);
    if (!name) return { id: "" };
    const rep = readLines(paths.reputation)
      .filter((r) => isPlainObject(r) && matchId(r, name))
      .at(-1);
    return { id: name, ...(isPlainObject(rep) ? rep : {}) };
  }

  return { paths, listSales, listRuns, readSpend, listDisputes, listReceipts, tailFeed, readQueue, readIdentity, malformedCount };
}
