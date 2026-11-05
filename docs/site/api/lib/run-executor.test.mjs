/** Run executor tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRunExecutor } from "./run-executor.mjs";
import { createRunManager } from "./async-runs.mjs";

/** Immediate sleep that records requested delays (no real waiting). */
function recordingSleep(seen) {
  return async (ms) => {
    seen.push(ms);
  };
}

/** Sleep that never resolves: the timeout arm can never win. */
function neverSleep(seen) {
  return (ms) => {
    seen.push(ms);
    return new Promise(() => {});
  };
}

test("runs a sync registry fn and returns its receipts", async () => {
  const ex = createRunExecutor({
    registry: { score: (args) => [{ for: args.task, points: 3 }] },
    sleep: recordingSleep([]),
  });
  const r = await ex({ fn: "score", args: { task: "plan" } });
  assert.deepEqual(r, { receipts: [{ for: "plan", points: 3 }] });
});

test("runs an async registry fn; plain values wrap as [{ result }]", async () => {
  const ex = createRunExecutor({
    registry: new Map([["double", async (args) => args.n * 2]]),
    sleep: neverSleep([]),
  });
  const r = await ex({ fn: "double", args: { n: 21 } });
  assert.deepEqual(r, { receipts: [{ result: 42 }] });
});

test("unknown fn and invalid specs are fail-closed, never throw", async () => {
  const ex = createRunExecutor({ registry: {}, sleep: recordingSleep([]) });
  assert.deepEqual(await ex({ fn: "missing" }), { error: "unknown_fn", receipts: [] });
  for (const bad of [null, undefined, "x", 42, {}, { fn: "" }, { fn: 7 }]) {
    const r = await ex(bad);
    assert.equal(r.ok === false || r.error !== undefined, true);
    assert.equal(r.error, "invalid_spec");
    assert.deepEqual(r.receipts, []);
  }
});

test("flaky fn succeeds after retries with exponential backoff", async () => {
  const seen = [];
  let calls = 0;
  const ex = createRunExecutor({
    registry: {
      flaky: () => {
        calls += 1;
        if (calls < 3) throw new Error("boom");
        return [{ ok: true }];
      },
    },
    backoffMs: 10,
    sleep: recordingSleep(seen),
  });
  const r = await ex({ fn: "flaky", retries: 2 });
  assert.deepEqual(r, { receipts: [{ ok: true }] });
  assert.equal(calls, 3);
  assert.deepEqual(seen, [10, 20]);
});

test("persistent thrower returns the error after exhausting retries", async () => {
  let calls = 0;
  const ex = createRunExecutor({
    registry: {
      bad: () => {
        calls += 1;
        throw new Error("kaput");
      },
    },
    sleep: recordingSleep([]),
  });
  const r = await ex({ fn: "bad", retries: 2 });
  assert.equal(r.error, "kaput");
  assert.deepEqual(r.receipts, []);
  assert.equal(calls, 3);
});

test("soft { error } returns are captured as failures", async () => {
  const ex = createRunExecutor({
    registry: { soft: () => ({ error: "cap_tripped" }) },
    sleep: recordingSleep([]),
  });
  const r = await ex({ fn: "soft", retries: 1 });
  assert.equal(r.error, "cap_tripped");
  assert.deepEqual(r.receipts, []);
});

test("hanging fn hits timeout_ms (real clock, tiny budget)", async () => {
  const ex = createRunExecutor({
    registry: { hang: () => new Promise(() => {}) },
  });
  const r = await ex({ fn: "hang", timeout_ms: 20, retries: 0 });
  assert.equal(r.error, "timeout");
  assert.deepEqual(r.receipts, []);
});

test("per-run timeout_ms/retries override the constructor defaults", async () => {
  let calls = 0;
  const ex = createRunExecutor({
    registry: {
      bad: () => {
        calls += 1;
        throw new Error("nope");
      },
    },
    defaultRetries: 5,
    sleep: recordingSleep([]),
  });
  const r = await ex({ fn: "bad", retries: 0 });
  assert.equal(r.error, "nope");
  assert.equal(calls, 1);
});

test("plugs into async-runs as the executor adapter", async () => {
  const m = createRunManager({
    now: () => "2026-11-05T00:00:00.000Z",
    executor: createRunExecutor({
      registry: { add: (args) => [{ sum: args.a + args.b }] },
      sleep: recordingSleep([]),
    }),
  });
  const { run_id } = m.submitRun({ fn: "add", args: { a: 2, b: 3 } });
  const done = await m.executeRun(run_id);
  assert.equal(done.ok, true);
  assert.equal(done.run.status, "completed");
  assert.deepEqual(done.run.receipts, [{ sum: 5 }]);
});
