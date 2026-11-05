/**
 * Alert rules 0.1.0 — threshold table + cooldown-gated evaluator.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * RULES ({ cap_velocity, fail_rate, queue_stall, spend_velocity }) declares
 * one row per rule: { id, severity, threshold, window, cooldownMs, check }.
 * evaluate() runs every row against a dashboard snapshot and returns
 * alerts[]. spend_velocity watches snapshot.spend_24h (cents) so burn
 * alerts fire even when no caps trip. Thresholds are env-tunable
 * (resolveThresholds): ALERT_CAP_VELOCITY, ALERT_FAIL_RATE,
 * ALERT_QUEUE_STALL, ALERT_SPEND_24H_CENTS override the compiled defaults;
 * unparseable env values fall back to defaults (fail-safe, never 0).
 * Cooldown is injectable ({ nowMs, store }): a rule that fired within
 * cooldownMs is suppressed until the window lapses. Deterministic
 * offline defaults: Date.now clock, fresh in-memory Map store (no
 * suppression unless the caller shares a store). Fail-closed: a bad
 * snapshot returns { ok:false, error }, never a partial alert list;
 * store faults are swallowed so alerting still fires.
 */

export const ALERT_VERSION = "0.1.0";

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function checkCapVelocity(rule, snapshot) {
  const caps = num(snapshot.caps_tripped);
  if (caps >= rule.threshold) {
    return `caps_tripped ${caps} >= ${rule.threshold} in ${rule.window}`;
  }
  return null;
}

function checkFailRate(rule, snapshot) {
  const byStatus = isPlainObject(snapshot.runs_by_status) ? snapshot.runs_by_status : {};
  const failed = num(byStatus.failed);
  const completed = num(byStatus.completed);
  const total = failed + completed;
  if (total < rule.minRuns) return null;
  const rate = failed / total;
  if (rate >= rule.threshold) {
    return `fail rate ${(rate * 100).toFixed(1)}% (${failed}/${total}) >= ${rule.threshold * 100}%`;
  }
  return null;
}

function checkQueueStall(rule, snapshot) {
  const depth = num(snapshot.queue_depth);
  if (depth >= rule.threshold) {
    return `queue_depth ${depth} >= ${rule.threshold}`;
  }
  return null;
}

function checkSpendVelocity(rule, snapshot) {
  const spend = num(snapshot.spend_24h);
  if (spend >= rule.threshold) {
    return `spend_24h ${spend} >= ${rule.threshold} in ${rule.window}`;
  }
  return null;
}

/** Compiled default thresholds. Env overrides via resolveThresholds(). */
export const DEFAULT_THRESHOLDS = Object.freeze({
  cap_velocity: 3,
  fail_rate: 0.2,
  queue_stall: 10,
  spend_velocity: 50000, // cents per 24h ($500)
});

const THRESHOLD_ENV = Object.freeze({
  cap_velocity: "ALERT_CAP_VELOCITY",
  fail_rate: "ALERT_FAIL_RATE",
  queue_stall: "ALERT_QUEUE_STALL",
  spend_velocity: "ALERT_SPEND_24H_CENTS",
});

/**
 * Resolve rule thresholds: numeric env values win, anything missing or
 * unparseable falls back to the compiled default (never 0, never NaN).
 */
export function resolveThresholds(env = process.env) {
  const src = env && typeof env === "object" ? env : {};
  const out = { ...DEFAULT_THRESHOLDS };
  for (const [id, name] of Object.entries(THRESHOLD_ENV)) {
    const raw = src[name];
    if (raw === undefined || raw === null || String(raw).trim() === "") continue;
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) out[id] = n;
  }
  return out;
}

/** Rule table: id, severity, threshold, window, cooldownMs, check fn. */
export const RULES = Object.freeze(
  (() => {
    const t = resolveThresholds();
    return [
      Object.freeze({
        id: "cap_velocity",
        severity: "high",
        threshold: t.cap_velocity,
        window: "24h",
        cooldownMs: 3_600_000,
        check: checkCapVelocity,
      }),
      Object.freeze({
        id: "fail_rate",
        severity: "high",
        threshold: t.fail_rate,
        minRuns: 5,
        window: "24h",
        cooldownMs: 3_600_000,
        check: checkFailRate,
      }),
      Object.freeze({
        id: "queue_stall",
        severity: "medium",
        threshold: t.queue_stall,
        window: "snapshot",
        cooldownMs: 900_000,
        check: checkQueueStall,
      }),
      Object.freeze({
        id: "spend_velocity",
        severity: "high",
        threshold: t.spend_velocity,
        window: "24h",
        cooldownMs: 3_600_000,
        check: checkSpendVelocity,
      }),
    ];
  })(),
);

function ruleById(id) {
  return RULES.find((r) => r.id === id) || null;
}

function storeGet(store, key) {
  try {
    if (store instanceof Map) {
      const v = store.get(key);
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    }
    if (isPlainObject(store)) {
      const v = store[key];
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    }
  } catch {
    /* fall through: store faults never block alerting */
  }
  return null;
}

function storeSet(store, key, value) {
  try {
    if (store instanceof Map) {
      store.set(key, value);
      return;
    }
    if (isPlainObject(store)) store[key] = value;
  } catch {
    /* swallow: cooldown is best-effort */
  }
}

/**
 * Evaluate the rule table against a dashboard snapshot.
 * @param {object} snapshot dashboard snapshot (spend_24h, runs_by_status, ...).
 * @param {object} [opts] { nowMs, store, rules, thresholds } — rules: array
 *   of rule ids to run (default: all). store: Map or plain object for
 *   cooldown state. thresholds: per-call { ruleId: number } overrides
 *   (same fail-safe parsing as resolveThresholds).
 */
export function evaluate(snapshot, opts = {}) {
  if (!isPlainObject(snapshot)) return { ok: false, error: "bad_snapshot" };
  const o = isPlainObject(opts) ? opts : {};
  const nowMs = typeof o.nowMs === "function" ? o.nowMs : Date.now;
  const store = o.store !== undefined ? o.store : new Map();
  const now = num(nowMs());
  const tuned = resolveThresholds();
  if (isPlainObject(o.thresholds)) {
    for (const [id, raw] of Object.entries(o.thresholds)) {
      const n = Number(raw);
      if (id in tuned && Number.isFinite(n) && n > 0) tuned[id] = n;
    }
  }
  const withTuning = (row) => ({ ...row, threshold: tuned[row.id] ?? row.threshold });

  let rows = RULES.map(withTuning);
  if (Array.isArray(o.rules)) {
    rows = [];
    for (const id of o.rules) {
      const row = ruleById(String(id));
      if (!row) return { ok: false, error: "unknown_rule" };
      rows.push(withTuning(row));
    }
  }

  const alerts = [];
  for (const rule of rows) {
    let message = null;
    try {
      message = rule.check(rule, snapshot);
    } catch {
      continue;
    }
    if (!message) continue;
    const key = `alert:${rule.id}`;
    const last = storeGet(store, key);
    if (last !== null && now - last < rule.cooldownMs) continue;
    storeSet(store, key, now);
    alerts.push({
      rule: rule.id,
      severity: rule.severity,
      message,
      at: new Date(Number.isFinite(now) ? now : 0).toISOString(),
    });
  }
  return { ok: true, alerts };
}
