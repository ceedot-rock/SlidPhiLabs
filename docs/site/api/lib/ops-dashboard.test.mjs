/** Ops dashboard tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDashboard, DAY_MS } from "./ops-dashboard.mjs";

const NOW = Date.parse("2026-11-05T12:00:00.000Z");
const iso = (ms) => new Date(ms).toISOString();

test("empty defaults yield a zero snapshot", async () => {
  const r = await buildDashboard({ nowMs: () => NOW });
  assert.equal(r.ok, true);
  assert.equal(r.spend_24h, 0);
  assert.deepEqual(r.runs_by_status, {});
  assert.equal(r.caps_tripped, 0);
  assert.equal(r.queue_depth, 0);
  assert.deepEqual(r.top_tools, []);
});

test("spend_24h sums only sales inside the window", async () => {
  const readers = {
    listSales: () => [
      { amount_cents: 100, at: iso(NOW - 1_000) },
      { amount_cents: 50, at: iso(NOW - DAY_MS - 1) },
      { amount_cents: 25, at: iso(NOW + 60_000) },
      { amount_cents: 7, at: "not-a-date" },
    ],
  };
  const r = await buildDashboard({ readers, nowMs: () => NOW });
  assert.equal(r.ok, true);
  assert.equal(r.spend_24h, 100);
});

test("runs_by_status counts and queue_depth prefers explicit depth", async () => {
  const readers = {
    listRuns: () => [
      { status: "queued", tool: "a" },
      { status: "running", tool: "a" },
      { status: "completed", tool: "b" },
      { status: "failed", tool: "b" },
      {},
    ],
    readQueue: () => ({ depth: 4 }),
  };
  const r = await buildDashboard({ readers, nowMs: () => NOW });
  assert.deepEqual(r.runs_by_status, { queued: 1, running: 1, completed: 1, failed: 1, unknown: 1 });
  assert.equal(r.queue_depth, 4);
});

test("queue_depth falls back to queued+running runs", async () => {
  const readers = {
    listRuns: () => [{ status: "queued" }, { status: "running" }, { status: "completed" }],
    readQueue: () => ({}),
  };
  const r = await buildDashboard({ readers, nowMs: () => NOW });
  assert.equal(r.queue_depth, 2);
});

test("caps_tripped counts feed events; top_tools merges runs and feed", async () => {
  const readers = {
    listRuns: () => [
      { status: "completed", tool: "zelda" },
      { status: "completed", tool: "zelda" },
      { status: "completed", tool: "mario" },
    ],
    tailFeed: () => [
      { type: "cap_tripped", detail: {} },
      { type: "cap_tripped", detail: {} },
      { type: "run_completed", detail: { tool: "mario" } },
      { type: "payout_sent", detail: {} },
    ],
  };
  const r = await buildDashboard({ readers, nowMs: () => NOW });
  assert.equal(r.caps_tripped, 2);
  assert.deepEqual(r.top_tools, [
    { tool: "mario", runs: 2 },
    { tool: "zelda", runs: 2 },
  ]);
});

test("top_tools caps at five, sorted by count", async () => {
  const readers = {
    listRuns: () =>
      ["t1", "t2", "t3", "t4", "t5", "t6"].flatMap((t, i) =>
        Array.from({ length: 6 - i }, () => ({ status: "completed", tool: t })),
      ),
  };
  const r = await buildDashboard({ readers, nowMs: () => NOW });
  assert.equal(r.top_tools.length, 5);
  assert.equal(r.top_tools[0].tool, "t1");
});

test("reader faults and malformed outputs fail closed", async () => {
  assert.deepEqual((await buildDashboard({ readers: { listSales: () => { throw new Error("x"); } } })).error, "reader_failed");
  assert.deepEqual((await buildDashboard({ readers: { listSales: () => [1, 2] } })).error, undefined);
  const badSales = await buildDashboard({ readers: { listSales: () => ({}) } });
  assert.equal(badSales.ok, false);
  assert.equal(badSales.error, "bad_sales");
  const badRuns = await buildDashboard({ readers: { listRuns: () => "nope" } });
  assert.equal(badRuns.error, "bad_runs");
  const badQueue = await buildDashboard({ readers: { readQueue: () => [] } });
  assert.equal(badQueue.error, "bad_queue");
});
