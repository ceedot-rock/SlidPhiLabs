/**
 * Compose warrant 0.1.0 — compile a tool chain into staged warrant params.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Deterministic, offline, pure: no disk, no network. A chain spec is an
 * array of [{ tool, args_map, pass, cap_cents, field? }] where pass is
 * "output" (whole previous output) or "field" (one named field of the
 * previous output). compileChain resolves each step into staged warrant
 * params ({ tool, params, cap_cents, depends_on }) whose per-step caps
 * must sum to <= the total cap; overspend fails closed (over_budget).
 * Unknown tools fail closed via an injectable existsTool adapter.
 */
export const COMPOSE_WARRANT_VERSION = "0.1.0";

function text(v) {
  return v == null ? "" : String(v).trim();
}

function cleanStep(step, i) {
  if (!step || typeof step !== "object") return null;
  const tool = text(step.tool);
  if (!tool) return null;
  const pass = text(step.pass) || "output";
  if (pass !== "output" && pass !== "field") return null;
  const argsMap = step.args_map && typeof step.args_map === "object" ? step.args_map : null;
  if (!argsMap) return null;
  const cap = Number(step.cap_cents);
  if (!Number.isSafeInteger(cap) || cap < 0) return null;
  let field = null;
  if (pass === "field") {
    field = text(step.field);
    if (!field) return null;
  }
  return { tool, args_map: { ...argsMap }, pass, field, cap_cents: cap, index: i };
}

/**
 * Compile a chain. opts: { chain, total_cap_cents, existsTool?, baseParams? }.
 * existsTool(tool) defaults to () => true; inject a registry lookup to
 * reject unknown tools. Returns { ok:true, stages, total_cap_cents } or
 * { ok:false, reason } with reason bad_chain | unknown_tool |
 * over_budget | bad_cap.
 */
export function compileChain(opts = {}) {
  if (!Array.isArray(opts.chain) || !opts.chain.length) {
    return { ok: false, reason: "bad_chain" };
  }
  const total = Number(opts.total_cap_cents);
  if (!Number.isSafeInteger(total) || total < 0) return { ok: false, reason: "bad_cap" };
  const existsTool = typeof opts.existsTool === "function" ? opts.existsTool : () => true;
  const baseParams = opts.baseParams && typeof opts.baseParams === "object" ? opts.baseParams : {};

  const steps = [];
  for (let i = 0; i < opts.chain.length; i += 1) {
    const step = cleanStep(opts.chain[i], i);
    if (!step) return { ok: false, reason: "bad_chain", index: i };
    let known = false;
    try {
      known = existsTool(step.tool) === true;
    } catch {
      known = false;
    }
    if (!known) return { ok: false, reason: "unknown_tool", index: i, tool: step.tool };
    steps.push(step);
  }

  const sum = steps.reduce((n, s) => n + s.cap_cents, 0);
  if (sum > total) return { ok: false, reason: "over_budget", spent: sum, total };

  const stages = steps.map((step, i) => {
    const params = { ...baseParams };
    for (const [k, v] of Object.entries(step.args_map)) {
      if (i === 0) {
        params[k] = v; // first step: literal args
      } else if (step.pass === "output") {
        params[k] = { from_step: i - 1, value: "output" };
      } else {
        params[k] = { from_step: i - 1, value: `field:${step.field}` };
      }
    }
    return {
      tool: step.tool,
      params,
      cap_cents: step.cap_cents,
      depends_on: i === 0 ? null : i - 1,
    };
  });

  return { ok: true, stages, total_cap_cents: total, spent_cap_cents: sum };
}
