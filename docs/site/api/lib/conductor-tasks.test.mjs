/** Conductor tasks tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createTaskManager,
  createFileStore,
  createMemoryStore,
  intentTask,
  pushTask,
  reviewTask,
  approveTask,
  rejectTask,
  getTask,
  transitionDigest,
  TASK_INTENT,
  TASK_PUSHED,
  TASK_IN_REVIEW,
  TASK_APPROVED,
  TASK_REJECTED,
  TASK_VERSION,
} from "./conductor-tasks.mjs";

const TICK = "2026-11-05T00:00:00.000Z";
const fixedClock = () => TICK;

test("version pinned", () => assert.equal(TASK_VERSION, "0.1.0"));

test("intentTask mints deterministic ids and branches", () => {
  const m = createTaskManager({ now: fixedClock });
  const a = m.intentTask({ prompt: "ship it" });
  const b = m.intentTask({ prompt: "ship it again" });
  assert.equal(a.ok, true);
  assert.equal(a.task_id, "task_0001");
  assert.equal(a.branch, "conductor/task-0001");
  assert.equal(a.status, TASK_INTENT);
  assert.equal(b.task_id, "task_0002");
  assert.equal(b.branch, "conductor/task-0002");
});

test("intentTask rejects empty prompts, fail-closed", () => {
  const m = createTaskManager({ now: fixedClock });
  for (const bad of [{}, { prompt: "" }, { prompt: "   " }, { prompt: 42 }, null, "x"]) {
    assert.equal(m.intentTask(bad).ok, false);
  }
});

test("happy path intent -> push -> review -> approve with digests", () => {
  const m = createTaskManager({ now: fixedClock });
  const { task_id } = m.intentTask({ prompt: "do work" });
  assert.equal(m.pushTask(task_id, { commit: "abc" }).status, TASK_PUSHED);
  const rev = m.reviewTask(task_id, { verdict: "approve" });
  assert.equal(rev.ok, true);
  assert.equal(rev.status, TASK_IN_REVIEW);
  const done = m.approveTask(task_id);
  assert.equal(done.ok, true);
  assert.equal(done.status, TASK_APPROVED);
  const got = m.getTask(task_id);
  assert.equal(got.ok, true);
  assert.equal(got.task.receipts.length, 4);
  const v = m.verifyTask(task_id);
  assert.equal(v.ok, true);
  assert.ok(v.checks.every((c) => c.ok));
});

test("reject path records reason and ends terminal", () => {
  const m = createTaskManager({ now: fixedClock });
  const { task_id } = m.intentTask({ prompt: "risky" });
  m.pushTask(task_id);
  m.reviewTask(task_id, { verdict: "block" });
  const out = m.rejectTask(task_id, { reason: "unsafe" });
  assert.equal(out.ok, true);
  assert.equal(out.status, TASK_REJECTED);
  assert.equal(m.approveTask(task_id).ok, false);
  assert.equal(m.rejectTask(task_id).ok, false);
});

test("invalid transitions fail closed", () => {
  const m = createTaskManager({ now: fixedClock });
  const { task_id } = m.intentTask({ prompt: "x" });
  assert.equal(m.reviewTask(task_id, { verdict: "approve" }).ok, false);
  assert.equal(m.approveTask(task_id).ok, false);
  assert.equal(m.rejectTask(task_id).ok, false);
  assert.equal(m.reviewTask(task_id, { verdict: "bogus" }).ok, false);
  assert.equal(m.pushTask("task_9999").ok, false);
  assert.equal(m.pushTask("").ok, false);
  assert.equal(m.getTask("task_9999").ok, false);
});

test("digests bind each transition deterministically", () => {
  const m = createTaskManager({ now: fixedClock });
  const { task_id, digest } = m.intentTask({ prompt: "same" });
  const expected = transitionDigest({ task_id, from: "none", to: TASK_INTENT, seq: 1, detail: { prompt: "same" } });
  assert.equal(digest, expected);
  const n = createTaskManager({ now: fixedClock });
  assert.equal(n.intentTask({ prompt: "same" }).digest, digest);
});

test("branch adapter is injectable", () => {
  const m = createTaskManager({ now: fixedClock, branchFor: (id) => `custom/${id}` });
  const r = m.intentTask({ prompt: "x" });
  assert.equal(r.branch, "custom/task_0001");
});

test("file-backed store survives a manager restart via injectable fs", () => {
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
  const a = createTaskManager({ store: createFileStore({ path: "tasks/tasks.json", fs }), now: fixedClock });
  const intent = a.intentTask({ prompt: "persist me" });
  assert.equal(intent.task_id, "task_0001");
  a.pushTask(intent.task_id, { commit: "abc" });
  const b = createTaskManager({ store: createFileStore({ path: "tasks/tasks.json", fs }), now: fixedClock });
  const got = b.getTask("task_0001");
  assert.equal(got.ok, true);
  assert.equal(got.task.status, TASK_PUSHED);
  assert.equal(got.task.receipts.length, 2);
  assert.equal(b.verifyTask("task_0001").ok, true);
  const next = b.intentTask({ prompt: "second" });
  assert.equal(next.task_id, "task_0002"); // counter survived the restart
});

test("singleton shortcuts share the default store", () => {
  const a = intentTask({ prompt: "singleton probe" });
  assert.equal(a.ok, true);
  assert.equal(pushTask(a.task_id).ok, true);
  assert.equal(reviewTask(a.task_id, { verdict: "review" }).status, TASK_IN_REVIEW);
  const got = getTask(a.task_id);
  assert.equal(got.ok, true);
  assert.equal(got.task.prompt, "singleton probe");
  void approveTask;
  void rejectTask;
  void TASK_PUSHED;
  void TASK_REJECTED;
  void createMemoryStore;
});
