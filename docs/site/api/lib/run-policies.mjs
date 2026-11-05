/**
 * Run policies 0.1.0 — timeout/retry policy table with per-tool overrides.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Pure, deterministic, offline: policyFor(spec) never throws and always
 * returns a frozen { name, timeout_ms, retries, backoff_ms }. Resolution
 * order: explicit spec.policy name, then the per-tool table (built-in
 * TOOL_POLICIES merged with an injectable opts.tools map), then
 * "default". Unknown names fall back to "default" (fail-closed).
 * Explicit numeric fields on spec override the table after validation.
 */

export const RUN_POLICIES_VERSION = "0.1.0";
export const POLICY_DEFAULT = "default";
export const POLICY_LONG = "long";
export const POLICY_QUICK = "quick";

function freezePolicy(p) {
  return Object.freeze({ ...p });
}

const TABLE = {
  [POLICY_DEFAULT]: freezePolicy({ timeout_ms: 5000, retries: 1, backoff_ms: 50 }),
  [POLICY_LONG]: freezePolicy({ timeout_ms: 30000, retries: 2, backoff_ms: 200 }),
  [POLICY_QUICK]: freezePolicy({ timeout_ms: 1000, retries: 0, backoff_ms: 10 }),
};

/** Timeout/retry policy table by name. Frozen (entries frozen too). */
export const POLICIES = Object.freeze({ ...TABLE });

const BUILTIN_TOOLS = {
  compress: POLICY_QUICK,
  rerank: POLICY_LONG,
  bench: POLICY_LONG,
  "private-bench": POLICY_LONG,
};

/** Built-in per-tool policy names. Callers extend via policyFor(spec, { tools }). */
export const TOOL_POLICIES = Object.freeze({ ...BUILTIN_TOOLS });

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function validMs(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function validRetries(v, fallback) {
  if (v === undefined || v === null) return fallback;
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

function validBackoff(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

/**
 * Resolve the policy for a run spec. Never throws; invalid input yields
 * the "default" policy fields. Returned object is frozen.
 * @param {object} [spec] { tool?, policy?, timeout_ms?, retries?, backoff_ms? }
 * @param {object} [opts] { tools?: { [tool]: policyName } } injectable
 *   per-tool overrides layered over TOOL_POLICIES.
 */
export function policyFor(spec, opts = {}) {
  const s = isPlainObject(spec) ? spec : {};
  const o = isPlainObject(opts) ? opts : {};
  const tools = isPlainObject(o.tools) ? { ...BUILTIN_TOOLS, ...o.tools } : BUILTIN_TOOLS;
  let name = POLICY_DEFAULT;
  if (typeof s.policy === "string" && TABLE[s.policy]) {
    name = s.policy;
  } else if (
    typeof s.tool === "string" &&
    typeof tools[s.tool] === "string" &&
    TABLE[tools[s.tool]]
  ) {
    name = tools[s.tool];
  }
  const base = TABLE[name];
  return Object.freeze({
    name,
    timeout_ms: validMs(s.timeout_ms, base.timeout_ms),
    retries: validRetries(s.retries, base.retries),
    backoff_ms: validBackoff(s.backoff_ms, base.backoff_ms),
  });
}

/** Strict lookup by policy name: fail-closed envelope, never throws. */
export function getPolicy(name) {
  if (typeof name === "string" && TABLE[name]) {
    return { ok: true, policy: policyFor({ policy: name }) };
  }
  return { ok: false, error: "unknown_policy" };
}

/** Policy table names in definition order. */
export function listPolicies() {
  return Object.keys(TABLE);
}
