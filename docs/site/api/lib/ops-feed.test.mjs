/** Ops feed tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createOpsFeed, OPS_EVENTS } from "./ops-feed.mjs";

const TICK = "2026-11-05T00:00:00.000Z";

function feed(extra = {}) {
  return createOpsFeed({ now: () => TICK, ...extra });
}

test("emits all four event types", () => {
  const f = feed();
  for (const type of ["run_completed", "cap_tripped", "payout_sent", "dispute_opened"]) {
    const r = f.emit(type, { n: 1 });
    assert.equal(r.ok, true);
    assert.equal(r.event.type, type);
    assert.equal(r.event.at, TICK);
  }
  assert.deepEqual(OPS_EVENTS, ["run_completed", "cap_tripped", "payout_sent", "dispute_opened"]);
});

test("unknown event types are swallowed, never thrown", () => {
  const f = feed();
  const r = f.emit("bogus_event", {});
  assert.equal(r.ok, false);
  assert.equal(r.swallowed, true);
  assert.equal(f.tail(10).length, 0);
});

test("invalid detail payloads are swallowed", () => {
  const f = feed();
  assert.equal(f.emit("run_completed", "nope").swallowed, true);
  assert.equal(f.emit("run_completed", 42).swallowed, true);
  assert.equal(f.tail(10).length, 0);
});

test("tail(n) returns the last n events in order", () => {
  const f = feed();
  f.emit("run_completed", { i: 1 });
  f.emit("cap_tripped", { i: 2 });
  f.emit("payout_sent", { i: 3 });
  const last2 = f.tail(2);
  assert.equal(last2.length, 2);
  assert.equal(last2[0].type, "cap_tripped");
  assert.equal(last2[1].type, "payout_sent");
  assert.ok(last2[0].seq < last2[1].seq);
  assert.equal(f.tail(0).length, 0);
  assert.equal(f.tail(-3).length, 0);
});

test("memory-only default persists nothing but keeps the tail", () => {
  const f = feed();
  const r = f.emit("payout_sent", { amount_cents: 100 });
  assert.equal(r.ok, true);
  assert.equal(r.persisted, false);
  assert.equal(f.tail(5).length, 1);
});

test("file append writes one JSON line per event via injectable writer", () => {
  const lines = [];
  const f = feed({ file: "ops.jsonl", append: (p, line) => lines.push([p, line]) });
  const r = f.emit("dispute_opened", { id: "d1" });
  assert.equal(r.ok, true);
  assert.equal(r.persisted, true);
  assert.equal(lines.length, 1);
  assert.equal(lines[0][0], "ops.jsonl");
  assert.deepEqual(JSON.parse(lines[0][1]).type, "dispute_opened");
});

test("writer failures are swallowed with persisted:false", () => {
  const f = feed({
    file: "ops.jsonl",
    append: () => {
      throw new Error("disk full");
    },
  });
  const r = f.emit("run_completed", {});
  assert.equal(r.ok, true);
  assert.equal(r.persisted, false);
  assert.equal(f.tail(5).length, 1);
});
