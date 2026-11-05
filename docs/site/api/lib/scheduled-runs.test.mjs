/** Scheduled runs tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createScheduleStore } from "./scheduled-runs.mjs";

const NOW = 1_790_000_000_000;

test("add assigns deterministic ids and defaults next_at", () => {
  const s = createScheduleStore({ nowMs: () => NOW });
  const a = s.addSchedule({ every_ms: 1000 });
  const b = s.addSchedule({ every_ms: 1000 });
  assert.equal(a.ok, true);
  assert.equal(a.schedule.schedule_id, "sched_0001");
  assert.equal(b.schedule.schedule_id, "sched_0002");
  assert.equal(a.schedule.next_at, NOW + 1000);
});

test("invalid every_ms and duplicate ids are fail-closed", () => {
  const s = createScheduleStore({ nowMs: () => NOW });
  for (const bad of [0, -5, "x", NaN, null, undefined]) {
    assert.equal(s.addSchedule({ every_ms: bad }).error, "invalid_every_ms");
  }
  assert.equal(s.addSchedule(null).error, "invalid_schedule");
  assert.equal(s.addSchedule({ schedule_id: "k", every_ms: 10 }).ok, true);
  assert.equal(s.addSchedule({ schedule_id: "k", every_ms: 10 }).error, "already_exists");
});

test("dueSchedules is a pure listing: no timers, no mutation", () => {
  const s = createScheduleStore({ nowMs: () => NOW });
  s.addSchedule({ schedule_id: "soon", every_ms: 100, next_at: NOW + 100 });
  s.addSchedule({ schedule_id: "later", every_ms: 100, next_at: NOW + 10_000 });
  assert.deepEqual(s.dueSchedules(NOW).map((x) => x.schedule_id), []);
  assert.deepEqual(s.dueSchedules(NOW + 100).map((x) => x.schedule_id), ["soon"]);
  // Calling due twice changes nothing.
  assert.deepEqual(s.dueSchedules(NOW + 100).map((x) => x.schedule_id), ["soon"]);
  assert.equal(s.getSchedule("soon").schedule.next_at, NOW + 100);
  // Invalid clocks fail closed to an empty listing, never throw.
  assert.deepEqual(s.dueSchedules("nope"), []);
  assert.deepEqual(s.dueSchedules(NaN), []);
});

test("ackSchedule advances past now and counts skipped periods", () => {
  const s = createScheduleStore({ nowMs: () => NOW });
  s.addSchedule({ schedule_id: "tick", every_ms: 1000, next_at: NOW });
  const ack = s.ackSchedule("tick", NOW + 2500);
  assert.equal(ack.ok, true);
  assert.equal(ack.skipped, 3);
  assert.equal(ack.schedule.next_at, NOW + 3000);
  assert.deepEqual(s.dueSchedules(NOW + 2500), []);
});

test("ack with nothing missed advances exactly one period", () => {
  const s = createScheduleStore({ nowMs: () => NOW });
  s.addSchedule({ schedule_id: "t", every_ms: 500, next_at: NOW + 500 });
  const ack = s.ackSchedule("t", NOW + 500);
  assert.equal(ack.skipped, 1);
  assert.equal(ack.schedule.next_at, NOW + 1000);
});

test("file-backed store persists across instances", () => {
  const dir = mkdtempSync(join(tmpdir(), "sched-test-"));
  const file = join(dir, "schedules.json");
  const a = createScheduleStore({ nowMs: () => NOW, file });
  assert.equal(a.addSchedule({ schedule_id: "persist", every_ms: 1000, next_at: NOW + 1000 }).ok, true);
  assert.ok(JSON.parse(readFileSync(file, "utf8")).schedules.some((s) => s.schedule_id === "persist"));
  const b = createScheduleStore({ nowMs: () => NOW, file });
  assert.equal(b.getSchedule("persist").schedule.next_at, NOW + 1000);
  assert.equal(b.ackSchedule("persist", NOW + 1000).skipped, 1);
  const c = createScheduleStore({ nowMs: () => NOW, file });
  assert.equal(c.getSchedule("persist").schedule.next_at, NOW + 2000);
  assert.equal(c.removeSchedule("persist").ok, true);
  const d = createScheduleStore({ nowMs: () => NOW, file });
  assert.equal(d.getSchedule("persist").error, "not_found");
});

test("file-backed store fails closed on corrupt files, never clobbers", () => {
  const dir = mkdtempSync(join(tmpdir(), "sched-test-"));
  const file = join(dir, "schedules.json");
  writeFileSync(file, "{broken");
  const s = createScheduleStore({ nowMs: () => NOW, file });
  assert.equal(s.addSchedule({ every_ms: 10 }).error, "ledger_corrupt");
  assert.equal(s.removeSchedule("x").error, "ledger_corrupt");
  assert.equal(s.ackSchedule("x", NOW).error, "ledger_corrupt");
  assert.equal(readFileSync(file, "utf8"), "{broken");
});

test("remove/get/list behave fail-closed", () => {
  const s = createScheduleStore({ nowMs: () => NOW });
  s.addSchedule({ schedule_id: "b", every_ms: 50, next_at: NOW + 50 });
  s.addSchedule({ schedule_id: "a", every_ms: 50, next_at: NOW + 50 });
  assert.deepEqual(s.listSchedules().map((x) => x.schedule_id), ["a", "b"]);
  assert.equal(s.getSchedule("zz").error, "not_found");
  assert.equal(s.removeSchedule("zz").error, "not_found");
  assert.equal(s.removeSchedule("").error, "invalid_schedule_id");
  assert.equal(s.removeSchedule("a").ok, true);
  assert.equal(s.getSchedule("a").error, "not_found");
  assert.equal(s.ackSchedule("a", NOW).error, "not_found");
  assert.equal(s.ackSchedule("b", "bad").error, "invalid_now");
});
