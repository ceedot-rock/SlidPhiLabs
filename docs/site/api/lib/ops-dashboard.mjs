/**
 * Ops dashboard 0.1.0 — JSON snapshot from feed/ledger readers.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * buildDashboard({ readers, nowMs }) assembles
 * { spend_24h, runs_by_status, caps_tripped, queue_depth, top_tools }
 * purely from injectable readers, so the dashboard never touches a real
 * ledger itself. Deterministic offline defaults: empty readers (zero
 * spend, no runs, no caps, empty queue). Fail-closed envelopes:
 * { ok:false, error } on any reader fault or malformed reader output,
 * never a partial snapshot.
 */

export const DASHBOARD_VERSION = "0.1.0";
export const DAY_MS = 86_400_000;
export const TOP_TOOLS_LIMIT = 5;

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function text(v) {
  return v == null ? "" : String(v);
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function cents(v) {
  const n = Math.floor(Number(v));
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

function toolOf(entry) {
  if (!isPlainObject(entry)) return "unknown";
  const d = isPlainObject(entry.detail) ? entry.detail : null;
  const t =
    text(entry.tool) ||
    text(entry.route) ||
    text(entry.cmd) ||
    (d ? text(d.tool || d.route || d.cmd) : "");
  return t || "unknown";
}

const DEFAULT_READERS = {
  listSales: () => [],
  listRuns: () => [],
  tailFeed: () => [],
  readQueue: () => ({ depth: 0 }),
};

/**
 * Build the ops dashboard snapshot.
 * @param {object} [opts] { readers, nowMs } — readers are sync or async.
 */
export async function buildDashboard(opts = {}) {
  const o = isPlainObject(opts) ? opts : {};
  const readers = { ...DEFAULT_READERS, ...(isPlainObject(o.readers) ? o.readers : {}) };
  const nowMs = typeof o.nowMs === "function" ? o.nowMs : Date.now;
  const now = num(nowMs());
  const at = new Date(Number.isFinite(now) ? now : 0).toISOString();

  let sales;
  let runs;
  let feed;
  let queue;
  try {
    sales = await readers.listSales();
    runs = await readers.listRuns();
    queue = await readers.readQueue();
    feed =
      typeof readers.tailFeed === "function"
        ? await readers.tailFeed(TOP_TOOLS_LIMIT * 20)
        : [];
  } catch {
    return { ok: false, error: "reader_failed" };
  }

  if (!Array.isArray(sales)) return { ok: false, error: "bad_sales" };
  if (!Array.isArray(runs)) return { ok: false, error: "bad_runs" };
  if (!Array.isArray(feed)) return { ok: false, error: "bad_feed" };
  if (!isPlainObject(queue)) return { ok: false, error: "bad_queue" };

  const cutoff = now - DAY_MS;
  let spend24h = 0;
  for (const s of sales) {
    if (!isPlainObject(s)) continue;
    const t = Date.parse(text(s.at));
    if (!Number.isFinite(t) || t < cutoff || t > now) continue;
    spend24h += cents(s.amount_cents);
  }

  const runsByStatus = {};
  const toolCounts = new Map();
  let queuedRuns = 0;
  for (const r of runs) {
    if (!isPlainObject(r)) continue;
    const status = text(r.status) || "unknown";
    runsByStatus[status] = (runsByStatus[status] || 0) + 1;
    if (status === "queued" || status === "running") queuedRuns += 1;
    const tool = toolOf(r);
    toolCounts.set(tool, (toolCounts.get(tool) || 0) + 1);
  }

  let capsTripped = 0;
  for (const e of feed) {
    if (!isPlainObject(e)) continue;
    if (text(e.type) === "cap_tripped") capsTripped += 1;
    if (text(e.type) === "run_completed") {
      const tool = toolOf(e);
      toolCounts.set(tool, (toolCounts.get(tool) || 0) + 1);
    }
  }

  const explicitDepth = Number(queue.depth);
  const queueDepth =
    Number.isSafeInteger(explicitDepth) && explicitDepth >= 0 ? explicitDepth : queuedRuns;

  const topTools = [...toolCounts.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, TOP_TOOLS_LIMIT)
    .map(([tool, count]) => ({ tool, runs: count }));

  return {
    ok: true,
    at,
    spend_24h: spend24h,
    runs_by_status: runsByStatus,
    caps_tripped: capsTripped,
    queue_depth: queueDepth,
    top_tools: topTools,
  };
}
