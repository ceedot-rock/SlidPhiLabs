/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * Tests for lib/reputation-bootstrap.mjs — deterministic, no network.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  bootstrapPrior,
  isProbation,
  newRiderScore,
  scoreWithProbation,
  BOOTSTRAP_PRIOR_RUNS,
  BOOTSTRAP_STARTING_SCORE,
  BOOTSTRAP_PROBATION_UNTIL_RUNS,
} from "./reputation-bootstrap.mjs";

test("prior policy pins { prior_runs:0, starting_score:0.5, probation_until_runs:5 }", () => {
  assert.equal(BOOTSTRAP_PRIOR_RUNS, 0);
  assert.equal(BOOTSTRAP_STARTING_SCORE, 0.5);
  assert.equal(BOOTSTRAP_PROBATION_UNTIL_RUNS, 5);
  assert.deepEqual(bootstrapPrior(), {
    prior_runs: 0,
    starting_score: 0.5,
    probation_until_runs: 5,
  });
});

test("new riders start neutral and on probation", () => {
  const r = newRiderScore();
  assert.equal(r.ok, true);
  assert.equal(r.score, 0.5);
  assert.equal(r.runs, 0);
  assert.equal(r.probation, true);
});

test("probation lifts exactly at 5 completed runs", () => {
  assert.equal(isProbation(0), true);
  assert.equal(isProbation(4), true);
  assert.equal(isProbation(5), false);
  assert.equal(isProbation(120), false);
});

test("score output carries the probation flag", () => {
  const young = scoreWithProbation({ runs: 2, score: 0.9 });
  assert.equal(young.ok, true);
  assert.equal(young.score, 0.9);
  assert.equal(young.probation, true);
  const veteran = scoreWithProbation({ runs: 5, score: 0.9 });
  assert.equal(veteran.probation, false);
  assert.equal(veteran.prior_runs, 0);
  assert.equal(veteran.starting_score, 0.5);
  assert.equal(veteran.probation_until_runs, 5);
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
