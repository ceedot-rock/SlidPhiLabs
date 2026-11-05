/** BenchHaus 0.2.0 tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "benchhaus-"));
process.env.WARRANT_DIR = dir;
process.env.WARRANT_SECRET = "benchhaus-test-secret-32bytes-min!!";

import {
  BENCHHAUS_VERSION,
  BENCHHAUS_WEIGHTS,
  PROVENANCE_DEFAULT,
  PLAN_REFERENCE,
  RETRIEVAL_DOCS,
  RETRIEVAL_QUERY,
  STATE_FIXTURES,
  REFUSAL_FIXTURE,
  BENIGN_FIXTURE,
  wilson,
  isTie,
  bm25LiteRank,
  builtinRefuser,
  gradePlanExactness,
  gradeRetrievalPrecision,
  gradeStateTracking,
  gradeRefusalRobustness,
  computeSiAiscore,
  runBenchhaus,
} from "./benchhaus.mjs";

const {
  planAgenticRun,
  runAgenticRun,
  AGENTILL_MAP,
} = await import("./agentic-platform.mjs");

const HEX64 = /^[a-f0-9]{64}$/;

test("version pinned", () => {
  assert.equal(BENCHHAUS_VERSION, "0.2.0");
  assert.equal(PROVENANCE_DEFAULT, "lab-fixture-v2");
  assert.deepEqual(BENCHHAUS_WEIGHTS, { plan: 0.3, retrieval: 0.25, state: 0.25, refusal: 0.2 });
});

test("wilson interval bounded, degenerate n=0 wide open", () => {
  const w = wilson(8, 8);
  assert.ok(w.lo <= 1 && w.hi === 1, JSON.stringify(w));
  const z = wilson(0, 0);
  assert.deepEqual(z, { lo: 0, hi: 1 });
  const half = wilson(5, 10);
  assert.ok(half.lo >= 0 && half.hi <= 1 && half.lo < 0.5 && half.hi > 0.5);
});

test("plan-exactness: perfect, partial, empty, non-array vectors", () => {
  const perfect = gradePlanExactness([...PLAN_REFERENCE]);
  assert.equal(perfect.suite, "plan");
  assert.equal(perfect.n, 11);
  assert.equal(perfect.score, 1);
  assert.equal(perfect.precision, 1);
  assert.equal(perfect.recall, 1);
  const partial = gradePlanExactness([...PLAN_REFERENCE.slice(0, 4)]);
  assert.equal(partial.precision, 1);
  assert.equal(partial.recall, 4 / 11);
  assert.ok(Math.abs(partial.score - 8 / 15) < 1e-12, String(partial.score));
  const empty = gradePlanExactness([]);
  assert.equal(empty.score, 0);
  const bad = gradePlanExactness("not-a-list");
  assert.equal(bad.score, 0);
  const swapped = gradePlanExactness([...PLAN_REFERENCE].reverse());
  assert.equal(swapped.matches, 1);
  assert.ok(Math.abs(swapped.score - 1 / 11) < 1e-12, String(swapped.score));
});

test("plan-exactness: expected-order override grades partial runs", () => {
  const eight = ["rider", "warrant", "tollkeeper", "quikgater", "pcc", "awlpay", "psi", "conductor"];
  const over = gradePlanExactness(eight, { expected: eight });
  assert.equal(over.n, 8);
  assert.equal(over.score, 1);
  const arrForm = gradePlanExactness(eight, eight);
  assert.equal(arrForm.score, 1);
  const vsFull = gradePlanExactness(eight);
  assert.ok(vsFull.score < 1, String(vsFull.score));
});

test("retrieval fixture is 50 docs, 22 relevant, default score identity", () => {
  assert.equal(RETRIEVAL_DOCS.length, 50);
  assert.equal(RETRIEVAL_DOCS.filter((d) => d.grade > 0).length, 22);
  assert.ok(RETRIEVAL_QUERY.length > 0);
  const r = gradeRetrievalPrecision(null);
  assert.equal(r.suite, "retrieval");
  assert.equal(r.n, 50);
  assert.ok(Math.abs(r.score - 0.5 * (r.ndcg10 + r.recall10)) < 1e-12);
  for (const k of ["score", "ndcg10", "recall10"]) assert.ok(r[k] >= 0 && r[k] <= 1, k);
  assert.ok(r.ndcg10 > 0 && r.ndcg10 < 1, "solvable but not perfect, ndcg=" + r.ndcg10);
  assert.ok(Math.abs(r.ndcg10 - 0.6952585455054701) < 1e-12, "pinned lab-fixture-v2 value, ndcg=" + r.ndcg10);
  assert.equal(r.recall10, r.hits10 / 22);
  const gradeById = new Map(RETRIEVAL_DOCS.map((d) => [d.id, d.grade]));
  const top10 = bm25LiteRank(RETRIEVAL_QUERY).slice(0, 10).map((x) => gradeById.get(x.id));
  assert.ok(top10.includes(1), "hard negatives intrude into the top 10: " + top10.join(","));
  assert.ok(top10.includes(3), "anchors still rank top: " + top10.join(","));
  const worst = gradeRetrievalPrecision([...RETRIEVAL_DOCS.filter((d) => d.grade === 0).map((d) => d.id)]);
  assert.equal(worst.ndcg10, 0);
  assert.equal(worst.recall10, 0);
  assert.equal(worst.score, 0);
});

test("state-tracking: default executor perfect, wrong finals fail", () => {
  const good = gradeStateTracking(null);
  assert.equal(good.suite, "state");
  assert.equal(good.n, STATE_FIXTURES.length);
  assert.equal(good.score, 1);
  assert.equal(good.passed, STATE_FIXTURES.length);
  const bad = gradeStateTracking(STATE_FIXTURES.map(() => ({ a: -1 })));
  assert.equal(bad.score, 0);
  const half = gradeStateTracking(
    STATE_FIXTURES.map((f, i) => (i % 2 === 0 ? { ...f.expected } : { nope: 1 })),
  );
  assert.equal(half.score, 0.5);
});

test("refusal-robustness: builtin perfect, compliant majority graded", () => {
  const good = gradeRefusalRobustness(null);
  assert.equal(good.suite, "refusal");
  assert.equal(good.n, REFUSAL_FIXTURE.length);
  assert.equal(good.score, 1);
  assert.equal(good.pass_rate, 1);
  assert.equal(good.false_refusal_rate, 0);
  assert.equal(good.benign_n, BENIGN_FIXTURE.length);
  const none = gradeRefusalRobustness(REFUSAL_FIXTURE.map(() => false));
  assert.equal(none.score, 0);
  const mixed = gradeRefusalRobustness(REFUSAL_FIXTURE.map((_, i) => i < 7));
  assert.equal(mixed.score, 0.7);
});

test("refusal-robustness: benign inputs allowed, over-refusal penalized", () => {
  assert.equal(BENIGN_FIXTURE.length, 5);
  for (const f of BENIGN_FIXTURE) {
    assert.equal(builtinRefuser(f.input).refused, false, f.input);
  }
  const refuseAll = gradeRefusalRobustness(null, { refuseFn: () => true });
  assert.equal(refuseAll.pass_rate, 1);
  assert.equal(refuseAll.false_refusal_rate, 1);
  assert.equal(refuseAll.score, 0);
  const allowAll = gradeRefusalRobustness(null, { refuseFn: () => false });
  assert.equal(allowAll.score, 0);
  const partial = gradeRefusalRobustness(
    REFUSAL_FIXTURE.map(() => true),
    { benignDecisions: [true, false, false, false, false] },
  );
  assert.equal(partial.pass_rate, 1);
  assert.equal(partial.false_refusal_rate, 0.2);
  assert.ok(Math.abs(partial.score - 0.8) < 1e-12, String(partial.score));
});

test("siascore math: full weights, missing-suite renormalization, empty", () => {
  const full = computeSiAiscore([
    { suite: "plan", score: 1, ci95: { lo: 0.6, hi: 1 } },
    { suite: "retrieval", score: 0.8, ci95: { lo: 0.5, hi: 0.9 } },
    { suite: "state", score: 0.6, ci95: { lo: 0.3, hi: 0.8 } },
    { suite: "refusal", score: 1, ci95: { lo: 0.7, hi: 1 } },
  ]);
  assert.ok(Math.abs(full.siascore - 85) < 1e-9, String(full.siascore));
  assert.equal(full.coverage_pct, 100);
  assert.equal(full.provenance, "lab-fixture-v2");
  const partial = computeSiAiscore([
    { suite: "plan", score: 1, ci95: { lo: 0.6, hi: 1 } },
    { suite: "refusal", score: 0.5, ci95: { lo: 0.2, hi: 0.8 } },
  ]);
  assert.ok(Math.abs(partial.siascore - 80) < 1e-9, String(partial.siascore));
  assert.equal(partial.coverage_pct, 50);
  assert.equal(partial.cis.retrieval, null);
  assert.equal(partial.cis.state, null);
  const empty = computeSiAiscore([]);
  assert.equal(empty.siascore, null);
  assert.equal(empty.coverage_pct, 0);
});

test("tie rule: overlapping CIs tie, disjoint do not", () => {
  assert.equal(isTie({ lo: 0.4, hi: 0.6 }, { lo: 0.5, hi: 0.7 }), true);
  assert.equal(isTie({ lo: 0.1, hi: 0.2 }, { lo: 0.3, hi: 0.4 }), false);
  assert.equal(isTie([0.4, 0.6], [0.6, 0.9]), true);
});

test("runBenchhaus receipt shape, digest, determinism, quote", () => {
  const a = runBenchhaus({});
  assert.equal(a.ok, true);
  assert.equal(a.stage, "benchhaus");
  assert.equal(a.tool, "benchhaus");
  assert.equal(a.toolVersion, "0.2.0");
  assert.equal(a.suites.length, 4);
  assert.deepEqual(a.suites.map((s) => s.suite), ["plan", "retrieval", "state", "refusal"]);
  for (const s of a.suites) {
    assert.ok(s.score >= 0 && s.score <= 1);
    assert.ok(Number.isFinite(s.n));
    assert.ok(s.ci95.lo >= 0 && s.ci95.hi <= 1);
  }
  assert.ok(a.siascore >= 0 && a.siascore <= 100);
  assert.equal(a.coverage_pct, 100);
  assert.equal(a.verified, true);
  assert.match(a.digest, HEX64);
  assert.ok(a.quote && typeof a.quote.amount_cents === "number");
  const b = runBenchhaus({});
  assert.equal(b.digest, a.digest);
  assert.equal(b.siascore, a.siascore);
  for (const run of [a, b]) {
    assert.deepEqual(Object.keys(run.timings).sort(), ["plan", "refusal", "retrieval", "state"]);
    for (const ms of Object.values(run.timings)) assert.ok(Number.isFinite(ms) && ms >= 0, String(ms));
  }
  const slow = runBenchhaus({}, {
    gradePlan: (cand) => {
      const t0 = Date.now();
      while (Date.now() - t0 < 30) { /* busy-wait: inflate plan timing only */ }
      return gradePlanExactness(cand);
    },
  });
  assert.ok(slow.timings.plan >= 30, JSON.stringify(slow.timings));
  assert.equal(slow.digest, a.digest, "timings excluded from the digested payload");
  const sub = runBenchhaus({ benchhaus: { suites: ["plan", "state"] } });
  assert.deepEqual(Object.keys(sub.timings).sort(), ["plan", "state"]);
  const subset = runBenchhaus({ benchhaus: { suites: ["plan"] } });
  assert.equal(subset.ok, true);
  assert.equal(subset.suites.length, 1);
  assert.equal(subset.coverage_pct, 25);
  assert.equal(subset.siascore, 100);
});

test("runBenchhaus fail-closed: unknown suite, bad grader, throwing grader", () => {
  const unknown = runBenchhaus({ benchhaus: { suites: ["nope"] } });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.stage, "benchhaus");
  assert.equal(unknown.reason, "unknown_suite");
  const bad = runBenchhaus({}, { gradePlan: () => ({ suite: "plan", n: 8, score: 2, ci95: { lo: 0, hi: 1 } }) });
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, "grader_failed");
  const boom = runBenchhaus({}, { gradeState: () => { throw new Error("kaput"); } });
  assert.equal(boom.ok, false);
  assert.equal(boom.reason, "grader_failed");
});

test("injectable graders default to builtins", () => {
  const r = runBenchhaus(
    {},
    { executeFn: (program, init) => ({ ...init, a: -999 }) },
  );
  const state = r.suites.find((s) => s.suite === "state");
  assert.equal(state.score, 0);
  const r2 = runBenchhaus({}, { refuseFn: () => false });
  assert.equal(r2.suites.find((s) => s.suite === "refusal").score, 0);
});

// ---- ACN stage wiring (opt-in; defaults frozen) ----

test("plan default stages unchanged, agentill covers benchhaus", () => {
  const p = planAgenticRun({ demo: true, action: "fetch", host: "h.test", url: "https://example.com/a" });
  assert.deepEqual(p.plan.stages, ["rider", "warrant", "tollkeeper", "quikgater", "pcc", "awlpay", "psi", "conductor"]);
  assert.equal("benchhaus" in p.plan, false);
  assert.ok("benchhaus" in AGENTILL_MAP);
});

test("plan with benchhaus appends the stage plus preview", () => {
  const p = planAgenticRun({ demo: true, action: "invoke", host: "h.test", benchhaus: true });
  assert.deepEqual(p.plan.stages, ["rider", "warrant", "tollkeeper", "quikgater", "benchhaus", "pcc", "awlpay", "psi", "conductor"]);
  assert.equal(p.plan.benchhaus.tool, "benchhaus");
  assert.equal(p.plan.benchhaus.toolVersion, "0.2.0");
  assert.match(p.plan.benchhaus.digest, HEX64);
});

test("plan with context and benchhaus keeps execution order", () => {
  const p = planAgenticRun({
    demo: true, action: "invoke", host: "h.test",
    context: { text: "Alpha beta gamma. ".repeat(30), query: "alpha", targetRatio: 0.5, maxTokens: 20 },
    benchhaus: { suites: ["plan"] },
  });
  assert.deepEqual(p.plan.stages, ["rider", "warrant", "tollkeeper", "quikgater", "context", "benchhaus", "pcc", "awlpay", "psi", "conductor"]);
});

test("run benchhaus pushes its own receipt, digested fields untouched", async () => {
  const base = { demo: true, action: "invoke", host: "h.test", bytes: 10, file_receipt: false };
  const plain = await runAgenticRun(base);
  const withBh = await runAgenticRun({ ...base, benchhaus: { suites: ["plan", "refusal"] } });
  assert.equal(plain.ok, true);
  assert.equal(withBh.ok, true);
  const bh = withBh.receipts.find((s) => s.stage === "benchhaus");
  assert.equal(bh.ok, true);
  assert.equal(bh.tool, "benchhaus");
  assert.equal(bh.toolVersion, "0.2.0");
  assert.equal(bh.verified, true);
  assert.match(bh.digest, HEX64);
  assert.deepEqual(bh.suites.map((s) => s.suite), ["plan", "refusal"]);
  assert.equal(bh.coverage_pct, 50);
  const condPlain = plain.receipts.find((s) => s.stage === "conductor");
  const condBh = withBh.receipts.find((s) => s.stage === "conductor");
  assert.equal(condBh.digest, condPlain.digest);
  const stages = withBh.receipts.map((s) => s.stage);
  assert.ok(stages.indexOf("benchhaus") < stages.indexOf("pcc"));
});

test("run benchhaus fails closed on bad stage config", async () => {
  const r = await runAgenticRun({ demo: true, action: "invoke", host: "h.test", benchhaus: { suites: ["nope"] } });
  assert.equal(r.ok, false);
  assert.equal(r.stage, "benchhaus");
  assert.equal(r.reason, "unknown_suite");
});

// ---- Tollbooth spend-guard ----

test("plan spend-guard fails closed at cap", () => {
  const over = planAgenticRun({ demo: true, action: "invoke", host: "h.test", spend: { spent_cents: 2500, cap_cents: 2500 } });
  assert.equal(over.ok, false);
  assert.equal(over.stage, "tollkeeper");
  assert.equal(over.reason, "cap_exceeded");
});

test("plan spend-guard warns at 0.8 without failing", () => {
  const warn = planAgenticRun({ demo: true, action: "invoke", host: "h.test", spend: { spent_cents: 2000, cap_cents: 2500 } });
  assert.equal(warn.ok, true);
  assert.equal(warn.plan.spendGuard.warning, "velocity_exceeded");
  assert.equal(warn.plan.spendGuard.spent_cents, 2000);
  const quiet = planAgenticRun({ demo: true, action: "invoke", host: "h.test", spend: { spent_cents: 100, cap_cents: 2500 } });
  assert.equal(quiet.ok, true);
  assert.equal(quiet.plan.spendGuard.warning, null);
});

test("run spend-guard fails before any fetch", async () => {
  let calls = 0;
  const fetch402 = async () => { calls++; return { status: 200, body: "x" }; };
  const r = await runAgenticRun(
    { demo: true, action: "fetch", host: "h.test", url: "https://example.com/a", spent_cents: 9999, cap_cents: 2500 },
    { fetch402 },
  );
  assert.equal(r.ok, false);
  assert.equal(r.reason, "cap_exceeded");
  assert.equal(calls, 0);
});

test("run spend-guard warns without failing and still seals", async () => {
  const r = await runAgenticRun(
    { demo: true, action: "invoke", host: "h.test", bytes: 10, file_receipt: false, spend: { spent_cents: 2000, cap_cents: 2500 } },
  );
  assert.equal(r.ok, true);
  const warn = r.receipts.find((s) => s.stage === "tollkeeper" && s.warning === "velocity_exceeded");
  assert.ok(warn, "warning receipt present");
  assert.ok(r.receipts.some((s) => s.stage === "conductor" && s.ok));
});

test("run spend-guard honors caller-supplied spend adapter", async () => {
  let calls = 0;
  const r = await runAgenticRun(
    { demo: true, action: "fetch", host: "h.test", url: "https://example.com/a" },
    { fetch402: async () => { calls++; return { status: 200, body: "x" }; }, spendFn: async () => ({ spent_cents: 5000, cap_cents: 2500 }) },
  );
  assert.equal(r.ok, false);
  assert.equal(r.reason, "cap_exceeded");
  assert.equal(calls, 0);
});
