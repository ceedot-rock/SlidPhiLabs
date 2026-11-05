/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * Tests for lib/reputation-bootstrap.mjs — deterministic, no network.
 *
 * Behavior tests: a new rider stays on probation until it completes N
 * runs, then the flag lifts. No test pins the numeric constants; the
 * policy tunes them, the behavior (transition at the boundary) is what
 * callers depend on.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  bootstrapPrior,
  isProbation,
  newRiderScore,
  scoreWithProbation,
} from "./reputation-bootstrap.mjs";

test("a fresh rider starts neutral and on probation", () => {
  const r = newRiderScore();
  assert.equal(r.ok, true);
  assert.equal(r.runs, 0);
  assert.equal(r.probation, true);
  // Zero history means maximum uncertainty: the midpoint score.
  assert.equal(r.score, 0.5);
});

test("probation flag transitions from true to false after N runs", () => {
  const until = bootstrapPrior().probation_until_runs;
  assert.ok(Number.isInteger(until) && until > 0);
  for (let runs = 0; runs < until; runs++) {
    assert.equal(isProbation(runs), true, `runs=${runs} must be probation`);
  }
  assert.equal(isProbation(until), false);
  assert.equal(isProbation(until + 100), false);
});

test("score output carries the probation flag across the transition", () => {
  const until = bootstrapPrior().probation_until_runs;
  const young = scoreWithProbation({ runs: until - 1, score: 0.9 });
  assert.equal(young.ok, true);
  assert.equal(young.score, 0.9);
  assert.equal(young.probation, true);
  const veteran = scoreWithProbation({ runs: until, score: 0.9 });
  assert.equal(veteran.ok, true);
  assert.equal(veteran.score, 0.9);
  assert.equal(veteran.probation, false);
});

test("a full 0..N run of score envelopes flips probation exactly once", () => {
  const until = bootstrapPrior().probation_until_runs;
  const flags = [];
  for (let runs = 0; runs <= until + 1; runs++) {
    const r = scoreWithProbation({ runs, score: 0.7 });
    assert.equal(r.ok, true);
    flags.push(r.probation);
  }
  const flips = flags.filter(Boolean).length;
  assert.equal(flips, until);
  assert.deepEqual(flags.slice(-2), [false, false]);
});

test("zero runs always report the neutral starting score", () => {
  const r = scoreWithProbation({ runs: 0, score: 0.99 });
  assert.equal(r.score, 0.5);
  assert.equal(r.probation, true);
});

test("fail-closed on bad runs and bad scores", () => {
  assert.equal(scoreWithProbation({ runs: -1, score: 0.5 }).reason, "bad_runs");
  assert.equal(scoreWithProbation({ runs: 1.5, score: 0.5 }).reason, "bad_runs");
  assert.equal(scoreWithProbation({ score: 0.5 }).reason, "bad_runs");
  assert.equal(scoreWithProbation({ runs: 3, score: 2 }).reason, "bad_score");
  assert.equal(scoreWithProbation({ runs: 3, score: -0.1 }).reason, "bad_score");
  assert.equal(scoreWithProbation({ runs: 3 }).reason, "bad_score");
});
