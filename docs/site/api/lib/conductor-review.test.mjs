/** Conductor review tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  reviewChanges,
  reviewChangesAsync,
  diffStat,
  diffFiles,
  REVIEW_VERSION,
  REVIEW_MAX_FILES,
  REVIEW_MAX_ADDITIONS,
} from "./conductor-review.mjs";

test("version pinned", () => assert.equal(REVIEW_VERSION, "0.1.0"));

test("clean diff approves with no findings", () => {
  const r = reviewChanges({ diff: "+ hello\n context\n- old\n" });
  assert.equal(r.ok, true);
  assert.equal(r.verdict, "approve");
  assert.deepEqual(r.findings, []);
});

test("diffstat limits escalate to review", () => {
  const big = Array.from({ length: REVIEW_MAX_ADDITIONS + 1 }, (_, i) => `+ line ${i}`).join("\n");
  const r = reviewChanges({ diff: big });
  assert.equal(r.ok, true);
  assert.equal(r.verdict, "review");
  assert.ok(r.findings.some((f) => f.rule === "diffstat_additions"));
  const manyFiles = Array.from({ length: REVIEW_MAX_FILES + 1 }, (_, i) => `+++ b/f${i}.txt`).join("\n");
  const rf = reviewChanges({ diff: manyFiles });
  assert.equal(rf.verdict, "review");
  assert.ok(rf.findings.some((f) => f.rule === "diffstat_files"));
});

test("TODO/FIXME warns to review", () => {
  const r = reviewChanges({ diff: "+ // TODO: handle retry\n" });
  assert.equal(r.verdict, "review");
  assert.ok(r.findings.some((f) => f.rule === "todo_marker"));
});

test("secret patterns block", () => {
  const cases = [
    "+ key = sk-abcdefgh12345678\n",
    "+ token ghp_abcdefgh12345678\n",
    "+ id AKIAIOSFODNN7EXAMPLE\n",
    "+ -----BEGIN PRIVATE KEY-----\n",
    "+ db password: hunter2\n",
  ];
  for (const diff of cases) {
    const r = reviewChanges({ diff });
    assert.equal(r.verdict, "block", diff);
    assert.ok(r.findings.some((f) => f.severity === "block"), diff);
  }
});

test("block wins over warn", () => {
  const r = reviewChanges({ diff: "+ // TODO: rotate\n+ sk-abcdefgh12345678\n" });
  assert.equal(r.verdict, "block");
});

test("bad input fails closed", () => {
  assert.equal(reviewChanges(null).ok, false);
  assert.equal(reviewChanges({ diff: 42 }).ok, false);
  assert.equal(reviewChanges({ diff: "", additions: -1 }).ok, false);
  assert.equal(reviewChanges({ diff: "" }, { llmHook: "x" }).ok, false);
  assert.equal(reviewChanges({ diff: "", files: [{ path: "" }] }).ok, false);
});

test("sync llm hook can escalate but never downgrade a block", () => {
  const up = reviewChanges({ diff: "+ tiny\n" }, { llmHook: () => ({ verdict: "review", findings: [{ rule: "style", severity: "warn", message: "nit" }] }) });
  assert.equal(up.verdict, "review");
  assert.ok(up.findings.some((f) => f.rule === "style"));
  const down = reviewChanges({ diff: "+ sk-abcdefgh12345678\n" }, { llmHook: () => ({ verdict: "approve", findings: [] }) });
  assert.equal(down.verdict, "block");
});

test("throwing hook keeps the heuristic verdict", () => {
  const r = reviewChanges({ diff: "+ ok\n" }, {
    llmHook: () => { throw new Error("judge down"); },
  });
  assert.equal(r.ok, true);
  assert.equal(r.verdict, "approve");
  assert.ok(r.findings.some((f) => f.rule === "llm_hook_failed"));
});

test("async hook awaits and merges", async () => {
  const r = await reviewChangesAsync({ diff: "+ ok\n" }, {
    llmHook: async () => ({ verdict: "review", findings: [] }),
  });
  assert.equal(r.ok, true);
  assert.equal(r.verdict, "review");
  const dflt = await reviewChangesAsync({ diff: "+ ok\n" });
  assert.equal(dflt.verdict, "approve");
});

test("diffStat skips file headers; diffFiles parses paths", () => {
  assert.deepEqual(diffStat("+++ b/a\n--- a/a\n+ x\n- y\n context\n"), { additions: 1, deletions: 1 });
  assert.deepEqual(diffFiles("diff --git a/x b/y\n+++ b/y\n"), ["y"]);
});
