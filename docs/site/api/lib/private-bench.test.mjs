/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * Tests for lib/private-bench.mjs — deterministic, no network.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { runPrivateBench, computePrivateScore, PRIVATE_BENCH_WEIGHTS } from "./private-bench.mjs";

const FIXTURES = Object.freeze({
  plan: { passed: 8, n: 10 },
  retrieval: { passed: 5, n: 10 },
  state: { passed: 10, n: 10 },
  refusal: { passed: 9, n: 10 },
});

test("refuses without an injected adapter (no public fixture fallback)", () => {
  assert.equal(runPrivateBench({}).reason, "no_public_fixture");
  assert.equal(runPrivateBench({}, {}).reason, "no_public_fixture");
  assert.equal(runPrivateBench({}, { source: "x" }).reason, "no_public_fixture");
});

test("spec-side fixtures are ignored: still refuses without adapter", () => {
  const r = runPrivateBench({ fixtures: FIXTURES, plan: FIXTURES.plan });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "no_public_fixture");
});

test("runs injected fixtures with held-out provenance and benchhaus weights", () => {
  const r = runPrivateBench({}, { source: "nightly-07", fixtures: FIXTURES });
  assert.equal(r.ok, true);
  assert.equal(r.provenance, "held-out:nightly-07");
  assert.deepEqual(
    r.suites.map((s) => s.suite),
    ["plan", "retrieval", "state", "refusal"]
  );
  for (const s of r.suites) {
    assert.ok(s.score >= 0 && s.score <= 1);
    assert.ok(Number.isFinite(s.ci95.lo) && Number.isFinite(s.ci95.hi));
  }
  const w = PRIVATE_BENCH_WEIGHTS;
  const expect = (0.8 * w.plan + 0.5 * w.retrieval + 1 * w.state + 0.9 * w.refusal) * 100;
  assert.ok(Math.abs(r.siascore - expect) < 1e-9);
  assert.equal(r.coverage_pct, 100);
  assert.equal(r.verified, true);
  assert.match(r.digest, /^[0-9a-f]{64}$/);
});

test("coverage rules: missing suites skipped, weights renormalized, no imputation", () => {
  const r = runPrivateBench({}, { source: "s", fixtures: { plan: { passed: 1, n: 2 }, refusal: { passed: 1, n: 4 } } });
  assert.equal(r.ok, true);
  assert.equal(r.coverage_pct, 50);
  assert.deepEqual(
    r.suites.map((s) => s.suite),
    ["plan", "refusal"]
  );
  const expect = ((0.5 * 0.3 + 0.25 * 0.2) / (0.3 + 0.2)) * 100;
  assert.ok(Math.abs(r.siascore - expect) < 1e-9);
  const empty = computePrivateScore([], { provenance: "held-out:s" });
  assert.equal(empty.siascore, null);
  assert.equal(empty.coverage_pct, 0);
});

test("malformed injected fixture fails closed with grader_failed", () => {
  const r = runPrivateBench({}, { fixtures: { plan: { passed: 9, n: 2 } } });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "grader_failed");
  assert.equal(r.suite, "plan");
});

test("getFixtures adapter and suite subset selector work", () => {
  const r = runPrivateBench(
    { suites: ["refusal"] },
    { source: "vault", getFixtures: () => ({ refusal: [true, true, false] }) }
  );
  assert.equal(r.ok, true);
  assert.equal(r.provenance, "held-out:vault");
  assert.equal(r.suites.length, 1);
  assert.equal(r.suites[0].score, 2 / 3);
  assert.equal(r.coverage_pct, 25);
  assert.equal(runPrivateBench({ suites: ["nope"] }, { fixtures: FIXTURES }).reason, "unknown_suite");
});
