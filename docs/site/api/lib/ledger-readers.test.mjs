/** Ledger readers tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createLedgerReaders,
  resolvePaths,
  matchId,
  DEFAULT_PATHS,
} from "./ledger-readers.mjs";

const SALES = [
  JSON.stringify({ amount_cents: 100, at: "2026-11-05T01:00:00.000Z", order_id: "o1" }),
  "not json {{{",
  "",
  JSON.stringify({ amount_cents: 50, at: "2026-11-05T02:00:00.000Z", rider_id: "r1" }),
].join("\n");

const FEED = [
  JSON.stringify({ seq: 1, type: "run_completed", at: "2026-11-05T01:00:00.000Z", detail: { tool: "zelda" } }),
  JSON.stringify({ seq: 2, type: "cap_tripped", at: "2026-11-05T02:00:00.000Z", detail: {} }),
  JSON.stringify({ seq: 3, type: "run_completed", at: "2026-11-05T03:00:00.000Z", detail: { tool: "mario", rider_id: "r1" } }),
  JSON.stringify({ seq: 4, type: "run_completed", at: "2026-11-05T04:00:00.000Z", detail: { status: "queued", tool: "mario" } }),
].join("\n");

const DISPUTES = JSON.stringify({ id: "d1", rider_id: "r1", order_id: "o1" });

function readers(files) {
  return createLedgerReaders({
    paths: { sales: "s", reputation: "r", payouts: "p", disputes: "d", feed: "f" },
    read: (p) => {
      if (!(p in files)) throw new Error("ENOENT");
      return files[p];
    },
  });
}

test("resolvePaths defaults point at real ledger locations", () => {
  assert.ok(DEFAULT_PATHS.sales.endsWith(".jsonl"));
  assert.ok(DEFAULT_PATHS.feed.endsWith(".jsonl"));
  const r = resolvePaths({ sales: "custom.jsonl" });
  assert.equal(r.sales, "custom.jsonl");
  assert.equal(r.feed, DEFAULT_PATHS.feed);
});

test("listSales skips malformed and blank lines", () => {
  const r = readers({ s: SALES });
  assert.equal(r.listSales().length, 2);
});

test("malformed lines are counted, not silently dropped", () => {
  const r = readers({ s: SALES });
  assert.deepEqual(r.malformedCount(), { malformed_count: 0, by_path: {} });
  r.listSales();
  assert.equal(r.malformedCount().malformed_count, 1);
  assert.equal(r.malformedCount().by_path.s, 1);
  r.listSales(); // re-reads recount: 1 more malformed line observed
  assert.equal(r.malformedCount().malformed_count, 2);
  const clean = readers({ s: JSON.stringify({ amount_cents: 1 }) });
  clean.listSales();
  assert.deepEqual(clean.malformedCount(), { malformed_count: 0, by_path: {} });
});

test("missing files yield empty results, never throw", () => {
  const r = readers({});
  assert.deepEqual(r.listSales(), []);
  assert.deepEqual(r.listDisputes(), []);
  assert.deepEqual(r.listReceipts(), []);
  assert.deepEqual(r.tailFeed(), []);
  assert.deepEqual(r.readQueue(), { depth: 0 });
  assert.deepEqual(r.readSpend(), { spend_cents: 0 });
});

test("readSpend sums matched sales; unattributed lines count", () => {
  const r = readers({ s: SALES });
  assert.deepEqual(r.readSpend(), { spend_cents: 150 });
  assert.deepEqual(r.readSpend("r1"), { spend_cents: 150 });
  assert.deepEqual(r.readSpend("someone-else"), { spend_cents: 100 });
});

test("tailFeed returns the last n events in order", () => {
  const r = readers({ f: FEED });
  const tail = r.tailFeed(2);
  assert.equal(tail.length, 2);
  assert.equal(tail[0].seq, 3);
  assert.equal(tail[1].seq, 4);
});

test("listRuns maps run_completed feed events", () => {
  const r = readers({ f: FEED });
  const runs = r.listRuns();
  assert.equal(runs.length, 3);
  assert.ok(runs.every((x) => x.status === "completed"));
  assert.deepEqual(r.listRuns("r1").length, 3);
});

test("listDisputes and listReceipts filter by identity", () => {
  const r = readers({ s: SALES, d: DISPUTES, p: "" });
  assert.equal(r.listDisputes("r1").length, 1);
  assert.equal(r.listDisputes("r2").length, 0);
  assert.equal(r.listReceipts("r1").length, 2);
});

test("readQueue counts queued/running feed details", () => {
  const r = readers({ f: FEED });
  assert.deepEqual(r.readQueue(), { depth: 1 });
});

test("matchId: unattributed lines match, named lines must equal", () => {
  assert.equal(matchId({ amount_cents: 1 }, "r1"), true);
  assert.equal(matchId({ rider_id: "r1" }, "r1"), true);
  assert.equal(matchId({ rider_id: "r2" }, "r1"), false);
  assert.equal(matchId({ detail: { operator: "op1" } }, "op1"), true);
  assert.equal(matchId({ a: 1 }, undefined), true);
});
