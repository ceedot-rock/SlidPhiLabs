/** Alert rules tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { RULES, evaluate } from "./alert-rules.mjs";

const NOW = 1_763_000_000_000;
const snap = (extra = {}) => ({
  spend_24h: 0,
  runs_by_status: {},
  caps_tripped: 0,
  queue_depth: 0,
  top_tools: [],
  ...extra,
});

test("rule table has cap_velocity, fail_rate, queue_stall", () => {
  assert.deepEqual(RULES.map((r) => r.id), ["cap_velocity", "fail_rate", "queue_stall"]);
  for (const r of RULES) {
    assert.ok(["high", "medium", "low"].includes(r.severity));
    assert.equal(typeof r.check, "function");
  }
});

test("quiet snapshot yields no alerts", () => {
  const r = evaluate(snap(), { nowMs: () => NOW, store: new Map() });
  assert.equal(r.ok, true);
  assert.deepEqual(r.alerts, []);
});

test("cap_velocity fires at threshold", () => {
  const r = evaluate(snap({ caps_tripped: 3 }), { nowMs: () => NOW, store: new Map() });
  assert.equal(r.alerts.length, 1);
  assert.equal(r.alerts[0].rule, "cap_velocity");
  assert.equal(r.alerts[0].severity, "high");
  const quiet = evaluate(snap({ caps_tripped: 2 }), { nowMs: () => NOW, store: new Map() });
  assert.deepEqual(quiet.alerts, []);
});

test("fail_rate needs minimum runs and minimum rate", () => {
  const few = evaluate(snap({ runs_by_status: { completed: 1, failed: 3 } }), {
    nowMs: () => NOW,
    store: new Map(),
  });
  assert.deepEqual(few.alerts, []);
  const low = evaluate(snap({ runs_by_status: { completed: 9, failed: 1 } }), {
    nowMs: () => NOW,
    store: new Map(),
  });
  assert.deepEqual(low.alerts, []);
  const high = evaluate(snap({ runs_by_status: { completed: 6, failed: 4 } }), {
    nowMs: () => NOW,
    store: new Map(),
  });
  assert.equal(high.alerts.length, 1);
  assert.equal(high.alerts[0].rule, "fail_rate");
});

test("queue_stall fires at depth threshold", () => {
  const r = evaluate(snap({ queue_depth: 10 }), { nowMs: () => NOW, store: new Map() });
  assert.equal(r.alerts.length, 1);
  assert.equal(r.alerts[0].rule, "queue_stall");
  assert.equal(r.alerts[0].severity, "medium");
});

test("cooldown suppresses refires until the window lapses", () => {
  const store = new Map();
  const first = evaluate(snap({ caps_tripped: 5 }), { nowMs: () => NOW, store });
  assert.equal(first.alerts.length, 1);
  const second = evaluate(snap({ caps_tripped: 5 }), { nowMs: () => NOW + 60_000, store });
  assert.deepEqual(second.alerts, []);
  const third = evaluate(snap({ caps_tripped: 5 }), { nowMs: () => NOW + 3_600_001, store });
  assert.equal(third.alerts.length, 1);
});

test("plain-object store works; broken store still alerts", () => {
  const store = {};
  assert.equal(evaluate(snap({ queue_depth: 99 }), { nowMs: () => NOW, store }).alerts.length, 1);
  assert.equal(evaluate(snap({ queue_depth: 99 }), { nowMs: () => NOW, store }).alerts.length, 0);
  const broken = { get() { throw new Error("x"); }, set() { throw new Error("x"); } };
  const r = evaluate(snap({ queue_depth: 99 }), { nowMs: () => NOW, store: broken });
  assert.equal(r.ok, true);
  assert.equal(r.alerts.length, 1);
});

test("bad snapshot and unknown rule fail closed", () => {
  assert.equal(evaluate(null).error, "bad_snapshot");
  assert.equal(evaluate("nope").error, "bad_snapshot");
  assert.equal(evaluate(snap(), { rules: ["bogus"] }).error, "unknown_rule");
});

test("rule subset selection runs only chosen rules", () => {
  const r = evaluate(snap({ caps_tripped: 9, queue_depth: 99 }), {
    nowMs: () => NOW,
    store: new Map(),
    rules: ["queue_stall"],
  });
  assert.equal(r.alerts.length, 1);
  assert.equal(r.alerts[0].rule, "queue_stall");
});
