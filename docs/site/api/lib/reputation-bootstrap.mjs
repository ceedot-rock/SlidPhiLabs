/**
 * Reputation bootstrap 0.1.0 — new-rider prior policy + probation flag.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Deterministic, offline, dependency-free pure functions: a rider with no
 * history starts at 0.5 (maximum uncertainty) and stays on probation until
 * it has completed 5 runs. No network, no clock, no storage; there are no
 * adapters to inject. Fail-closed envelopes: { ok:false, reason }.
 */

/** New-rider prior: zero history, neutral score, probation for 5 runs. */
export const REPUTATION_BOOTSTRAP_VERSION = "0.1.0";
export const BOOTSTRAP_PRIOR_RUNS = 0;
export const BOOTSTRAP_STARTING_SCORE = 0.5;
export const BOOTSTRAP_PROBATION_UNTIL_RUNS = 5;

/** The pinned new-rider prior policy. Frozen: callers cannot mutate it. */
export function bootstrapPrior() {
  return Object.freeze({
    prior_runs: BOOTSTRAP_PRIOR_RUNS,
    starting_score: BOOTSTRAP_STARTING_SCORE,
    probation_until_runs: BOOTSTRAP_PROBATION_UNTIL_RUNS,
  });
}

/** True while a rider has completed fewer runs than the probation window. */
export function isProbation(runs) {
  const n = Number(runs);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return true;
  return n < BOOTSTRAP_PROBATION_UNTIL_RUNS;
}

/** Score envelope for a brand-new rider: neutral score, on probation. */
export function newRiderScore() {
  return {
    ok: true,
    score: BOOTSTRAP_STARTING_SCORE,
    runs: BOOTSTRAP_PRIOR_RUNS,
    probation: true,
    ...bootstrapPrior(),
  };
}

function checkRuns(runs) {
  const n = Number(runs);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    return { ok: false, reason: "bad_runs", detail: "runs must be an integer >= 0" };
  }
  return { ok: true, runs: n };
}

function checkScore(score) {
  const n = Number(score);
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    return { ok: false, reason: "bad_score", detail: "score must be a number in [0, 1]" };
  }
  return { ok: true, score: n };
}

/**
 * Attach the bootstrap prior + probation flag to an observed score.
 * A rider with zero runs always reports the neutral starting score,
 * regardless of the observed input (there is nothing to observe yet).
 */
export function scoreWithProbation(input = {}) {
  const root = input && typeof input === "object" ? input : {};
  const r = checkRuns(root.runs);
  if (!r.ok) return r;
  const s = checkScore(root.score);
  if (!s.ok) return s;
  const score = r.runs === 0 ? BOOTSTRAP_STARTING_SCORE : s.score;
  return {
    ok: true,
    score,
    runs: r.runs,
    probation: isProbation(r.runs),
    ...bootstrapPrior(),
  };
}
