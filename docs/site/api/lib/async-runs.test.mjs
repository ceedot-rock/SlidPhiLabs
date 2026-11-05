/** Async runs tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createRunManager,
  createMemoryStore,
  createFileStore,
  submitRun,
  pollRun,
  completeRun,
  RUN_QUEUED,
  RUN_COMPLETED,
  RUN_FAILED,
} from "./async-runs.mjs";

const TICK = "2026-11-05T00:00:00.000Z";
const fixedClock = () => TICK;

test("submitRun queues with deterministic ids", () => {
  const m = createRunManager({ now: fixedClock });
  const a = m.submitRun({ task: "compress" });
  const b = m.submitRun({ task: "score" });
  assert.equal(a.ok, true);
  assert.equal(a.run_id, "run_0001");
  assert.equal(a.status, RUN_QUEUED);
  assert.equal(b.run_id, "run_0002");
});

test("submitRun rejects non-object specs, fail-closed", () => {
  const m = createRunManager({ now: fixedClock });
  for (const bad of [null, undefined, "x", 42, ["task"]]) {
    const r = m.submitRun(bad);
    assert.equal(r.ok, false);
    assert.ok(r.error);
  }
});

test("pollRun returns the run; unknown id is fail-closed", () => {
  const m = createRunManager({ now: fixedClock });
  const { run_id } = m.submitRun({ task: "x" });
  const found = m.pollRun(run_id);
  assert.equal(found.ok, true);
  assert.equal(found.run.run_id, run_id);
  assert.equal(found.run.status, RUN_QUEUED);
  assert.equal(pollRun_missing().ok, false);
  function pollRun_missing() {
    return m.pollRun("run_9999");
  }
  assert.equal(m.pollRun("").ok, false);
  assert.equal(m.pollRun(null).ok, false);
});

test("completeRun attaches receipts array", () => {
  const m = createRunManager({ now: fixedClock });
  const { run_id } = m.submitRun({ task: "x" });
  const receipts = [{ id: "rcp_1", amount_cents: 40 }];
  const done = m.completeRun(run_id, { receipts });
  assert.equal(done.ok, true);
  assert.equal(done.run.status, RUN_COMPLETED);
  assert.deepEqual(done.run.receipts, receipts);
  const polled = m.pollRun(run_id);
  assert.deepEqual(polled.run.receipts, receipts);
});

test("completeRun rejects bad receipts and double completion", () => {
  const m = createRunManager({ now: fixedClock });
  const { run_id } = m.submitRun({ task: "x" });
  assert.equal(m.completeRun(run_id, { receipts: "nope" }).ok, false);
  assert.equal(m.completeRun(run_id, { status: "bogus" }).ok, false);
  assert.equal(m.completeRun(run_id, { receipts: [] }).ok, true);
  assert.equal(m.completeRun(run_id, { receipts: [] }).ok, false);
  assert.equal(m.completeRun("run_9999", { receipts: [] }).ok, false);
});

test("executeRun uses the injected executor adapter", async () => {
  const m = createRunManager({
    now: fixedClock,
    executor: async (spec) => ({ receipts: [{ for: spec.task }] }),
  });
  const { run_id } = m.submitRun({ task: "x" });
  const r = await m.executeRun(run_id);
  assert.equal(r.ok, true);
  assert.equal(r.run.status, RUN_COMPLETED);
  assert.deepEqual(r.run.receipts, [{ for: "x" }]);
});

test("executeRun records executor errors as failed runs", async () => {
  const boom = createRunManager({
    now: fixedClock,
    executor: () => ({ error: "cap_tripped" }),
  });
  const { run_id } = boom.submitRun({ task: "x" });
  const r = await boom.executeRun(run_id);
  assert.equal(r.ok, true);
  assert.equal(r.run.status, RUN_FAILED);
  assert.equal(r.run.error, "cap_tripped");
});

test("executeRun without an executor is fail-closed", async () => {
  const m = createRunManager({ now: fixedClock });
  const { run_id } = m.submitRun({ task: "x" });
  const r = await m.executeRun(run_id);
  assert.equal(r.ok, false);
  assert.equal(r.error, "no_executor");
  assert.equal(m.pollRun(run_id).run.status, RUN_QUEUED);
});

test("singleton shortcuts share the default store", () => {
  const s = submitRun({ task: "solo" });
  assert.equal(s.ok, true);
  const p = pollRun(s.run_id);
  assert.equal(p.ok, true);
  const c = completeRun(s.run_id, { receipts: [] });
  assert.equal(c.ok, true);
  assert.ok(Array.isArray(c.run.receipts));
});

test("file-backed store persists across managers via injectable fs", () => {
  const files = new Map();
  const fs = {
    readFile: (p) => {
      if (!files.has(p)) {
        const err = new Error(`ENOENT: ${p}`);
        err.code = "ENOENT";
        throw err;
      }
      return files.get(p);
    },
    writeFile: (p, s) => {
      files.set(p, String(s));
    },
    rename: (a, b) => {
      files.set(b, files.get(a));
      files.delete(a);
    },
    mkdir: () => {},
  };
  const a = createRunManager({ store: createFileStore({ path: "runs/runs.json", fs }), now: fixedClock });
  const sub = a.submitRun({ task: "persist-me" });
  assert.equal(sub.ok, true);
  a.completeRun(sub.run_id, { receipts: [{ id: "r1" }] });
  assert.ok([...files.keys()].some((k) => k.endsWith("runs.json")), `persisted: ${[...files.keys()]}`);
  const b = createRunManager({ store: createFileStore({ path: "runs/runs.json", fs }), now: fixedClock });
  const polled = b.pollRun(sub.run_id);
  assert.equal(polled.ok, true);
  assert.equal(polled.run.status, RUN_COMPLETED);
  assert.deepEqual(polled.run.receipts, [{ id: "r1" }]);
  const cont = b.submitRun({ task: "next" });
  assert.equal(cont.run_id, "run_0002"); // counter survived the restart
});

test("file store load tolerates missing file, rejects corrupt JSON", () => {
  const missing = createFileStore({
    path: "x.json",
    fs: {
      readFile: () => { const e = new Error("gone"); e.code = "ENOENT"; throw e; },
      writeFile: () => {},
      rename: () => {},
      mkdir: () => {},
    },
  });
  assert.equal(missing.load().loaded, 0);
  const corrupt = createFileStore({
    path: "x.json",
    fs: { readFile: () => "{{{", writeFile: () => {}, rename: () => {}, mkdir: () => {} },
  });
  assert.equal(corrupt.load().error, "corrupt_store");
});

test("injected store isolates managers", () => {
  const m = createRunManager({ store: createMemoryStore(), now: fixedClock });
  m.submitRun({ task: "a" });
  assert.equal(m.listRuns().length, 1);
});
