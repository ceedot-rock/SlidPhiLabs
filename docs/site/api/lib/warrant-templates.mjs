/**
 * Warrant templates 0.1.0 — prebuilt per-vertical bundles.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Deterministic, offline, pure: no disk, no network. Each template expands
 * into issueWarrant params ({ actions, max_usd, max_calls, ttl_seconds }).
 * Unknown template ids fail closed ({ ok:false }), never a default grant.
 */
export const WARRANT_TEMPLATES_VERSION = "0.1.0";

export const TEMPLATES = Object.freeze([
  Object.freeze({
    id: "compress",
    actions: Object.freeze(["compress"]),
    max_usd: 1,
    max_calls: 20,
    ttl_seconds: 3600,
  }),
  Object.freeze({
    id: "fetch",
    actions: Object.freeze(["fetch"]),
    max_usd: 2,
    max_calls: 50,
    ttl_seconds: 3600,
  }),
  Object.freeze({
    id: "publish",
    actions: Object.freeze(["publish"]),
    max_usd: 5,
    max_calls: 10,
    ttl_seconds: 1800,
  }),
  Object.freeze({
    id: "spend",
    actions: Object.freeze(["spend"]),
    max_usd: 10,
    max_calls: 5,
    ttl_seconds: 900,
  }),
  Object.freeze({
    id: "invoke",
    actions: Object.freeze(["invoke"]),
    max_usd: 1,
    max_calls: 20,
    ttl_seconds: 3600,
  }),
]);

const BY_ID = new Map(TEMPLATES.map((t) => [t.id, t]));

/** List template summaries ({ id, crossings, max_usd, max_calls, ttl }). */
export function listTemplates() {
  return TEMPLATES.map((t) => ({
    id: t.id,
    crossings: [...t.actions],
    max_usd: t.max_usd,
    max_calls: t.max_calls,
    ttl: t.ttl_seconds,
  }));
}

/**
 * Expand a template id into issueWarrant params. Optional overrides may
 * only narrow (lower max_usd/max_calls/ttl, subset actions) — widening
 * fails closed. Unknown ids fail closed.
 */
export function expandTemplate(id, overrides = {}) {
  const key = id == null ? "" : String(id).trim();
  const base = BY_ID.get(key);
  if (!base) return { ok: false, reason: "unknown_template" };
  const o = overrides && typeof overrides === "object" ? overrides : {};
  let actions = [...base.actions];
  if (o.actions !== undefined) {
    if (!Array.isArray(o.actions)) return { ok: false, reason: "bad_override" };
    const want = o.actions.map((a) => String(a).toLowerCase());
    if (!want.length || !want.every((a) => base.actions.includes(a))) {
      return { ok: false, reason: "bad_override" };
    }
    actions = [...new Set(want)];
  }
  const max_usd = o.max_usd === undefined ? base.max_usd : Number(o.max_usd);
  const max_calls = o.max_calls === undefined ? base.max_calls : Number(o.max_calls);
  const ttl_seconds = o.ttl_seconds === undefined ? base.ttl_seconds : Number(o.ttl_seconds);
  if (!(max_usd >= 0) || !(max_calls >= 1) || !(ttl_seconds >= 30)) {
    return { ok: false, reason: "bad_override" };
  }
  if (max_usd > base.max_usd || max_calls > base.max_calls || ttl_seconds > base.ttl_seconds) {
    return { ok: false, reason: "widening_denied" };
  }
  return { ok: true, params: { actions, max_usd, max_calls, ttl_seconds } };
}
