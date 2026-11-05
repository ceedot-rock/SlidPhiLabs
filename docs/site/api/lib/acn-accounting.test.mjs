/** ACN. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACN_CSV_HEADER,
  ACN_ROLLUP_HEADER,
  csvCell,
  receiptToRow,
  receiptsToCsv,
  rollupByOperatorMonth,
  rollupToCsv,
  markCollected,
  verifyReceipt,
} from "./acn-accounting.mjs";

const WARRANT = {
  id: "rcp_abc123",
  warrant_id: "w_1",
  agent_id: "demo",
  operator_id: "op-7",
  action: "invoke",
  host: "www.slidphilabs.com",
  usd: 0.4,
  request_sha256: "aa",
  result_sha256: "bb",
  ts: "2026-11-02T10:00:00.000Z",
};

const AWL = {
  stage: "awlpay",
  rail: "x402",
  amount_cents: 200,
  platform_fee_cents: 1,
  id: "settle-9",
  at: "2026-11-03T12:00:00.000Z",
  operator_id: "op-7",
};

const FEES = {
  stage: "awlpay-fees",
  accepts: [{ network: "eip155:8453", amount: "10000", asset: "0xabc" }],
  at: "2026-11-03T13:00:00.000Z",
  operator_id: "op-7",
};

const DIGEST = {
  stage: "conductor",
  cmd: "spl_agentic_run",
  seed: "0123456789abcdef",
  digest: "d".repeat(64),
  operator_id: "op-7",
  at: "2026-11-03T14:00:00.000Z",
};

test("warrant receipt normalizes usd to integer cents", () => {
  const row = receiptToRow(WARRANT);
  assert.equal(row.type, "warrant");
  assert.equal(row.amount_cents, 40);
  assert.equal(row.fee_cents, 0);
  assert.equal(row.operator, "op-7");
  assert.equal(row.route, "invoke");
  assert.equal(row.ref, "w_1");
});

test("operator falls back to agent_id, never blank", () => {
  assert.equal(receiptToRow({ ...WARRANT, operator_id: undefined }).operator, "demo");
  const anon = receiptToRow({ ...WARRANT, operator_id: undefined, agent_id: undefined });
  assert.equal(anon.operator, "unknown");
});

test("awlpay attestation keeps amount and fee apart", () => {
  const row = receiptToRow(AWL);
  assert.equal(row.type, "awlpay");
  assert.equal(row.amount_cents, 200);
  assert.equal(row.fee_cents, 1);
  assert.equal(row.route, "x402");
});

test("awlpay-fees receipt routes on accepts network", () => {
  const row = receiptToRow(FEES);
  assert.equal(row.type, "awlpay");
  assert.equal(row.route, "eip155:8453");
  assert.equal(row.amount_cents, 0);
});

test("conductor digest carries no money", () => {
  const row = receiptToRow(DIGEST);
  assert.equal(row.type, "conductor");
  assert.equal(row.amount_cents, 0);
  assert.equal(row.fee_cents, 0);
  assert.equal(row.ref, "d".repeat(64));
});

test("unknown shapes are skipped", () => {
  assert.equal(receiptToRow(null), null);
  assert.equal(receiptToRow({ hello: "world" }), null);
  assert.equal(receiptToRow("rcp_abc"), null);
});

test("csv escapes commas and quotes", () => {
  assert.equal(csvCell("a,b"), '"a,b"');
  assert.equal(csvCell('q"q'), '"q""q"');
  assert.equal(csvCell("plain"), "plain");
});

test("receiptsToCsv emits header plus one line per known receipt", () => {
  const csv = receiptsToCsv([WARRANT, AWL, DIGEST, { nope: 1 }]);
  const lines = csv.trim().split("\n");
  assert.equal(lines[0], ACN_CSV_HEADER);
  assert.equal(lines.length, 4);
  assert.match(lines[1], /^warrant,rcp_abc123,op-7,invoke,40,0,/);
});

test("rollup groups by month and operator with sums and route counts", () => {
  const groups = rollupByOperatorMonth([
    WARRANT,
    AWL,
    FEES,
    DIGEST,
    { ...WARRANT, id: "rcp_def456", ts: "2026-10-01T00:00:00.000Z" },
  ]);
  assert.equal(groups.length, 2);
  const nov = groups.find((g) => g.month === "2026-11");
  assert.equal(nov.operator, "op-7");
  assert.equal(nov.lines, 4);
  assert.equal(nov.amount_cents, 240);
  assert.equal(nov.fee_cents, 1);
  assert.deepEqual(nov.routes, { invoke: 1, x402: 1, "eip155:8453": 1, spl_agentic_run: 1 });
  const oct = groups.find((g) => g.month === "2026-10");
  assert.equal(oct.lines, 1);
  assert.equal(oct.amount_cents, 40);
});

test("rollupToCsv renders groups under its header", () => {
  const csv = rollupToCsv(rollupByOperatorMonth([WARRANT, AWL]));
  const lines = csv.trim().split("\n");
  assert.equal(lines[0], ACN_ROLLUP_HEADER);
  assert.equal(lines.length, 2);
  assert.match(lines[1], /^2026-11,op-7,2,240,1,/);
});

test("markCollected flags copies, never mutates, never moves money", () => {
  const marked = markCollected([WARRANT, AWL], "2026-11-04T00:00:00.000Z");
  assert.equal(marked.length, 2);
  assert.ok(marked.every((r) => r.collected === true));
  assert.equal(marked[0].collected_at, "2026-11-04T00:00:00.000Z");
  assert.equal(marked[0].amount_cents, 40);
  assert.ok(!("collected" in WARRANT));
  assert.ok(!("collected" in AWL));
});

test("verifyReceipt rejects negative/NaN amounts, allows missing", () => {
  assert.equal(verifyReceipt(null).ok, false);
  assert.equal(verifyReceipt({ ...AWL, amount_cents: -5 }).error, "negative_amount");
  assert.equal(verifyReceipt({ ...AWL, amount_cents: Number.NaN }).error, "bad_amount");
  assert.equal(verifyReceipt({ ...AWL, platform_fee_cents: -1 }).error, "negative_amount");
  assert.equal(verifyReceipt({ ...WARRANT, usd: Number.NaN }).error, "bad_amount");
  assert.equal(verifyReceipt({ ...WARRANT, usd: -0.4 }).error, "negative_amount");
  assert.equal(verifyReceipt(AWL).ok, true);
  assert.equal(verifyReceipt(FEES).ok, true); // missing amounts default to 0
  assert.equal(receiptToRow({ ...AWL, amount_cents: -5 }), null);
  assert.equal(receiptToRow({ ...WARRANT, usd: Number.NaN }), null);
});

test("missing timestamps default to now (ISO), documented", () => {
  const { at, ...noAt } = AWL;
  void at;
  const row = receiptToRow(noAt);
  assert.ok(row);
  assert.ok(!Number.isNaN(Date.parse(row.at)), `default at parses: ${row.at}`);
  const groups = rollupByOperatorMonth([noAt]);
  assert.equal(groups.length, 1);
  assert.match(groups[0].month, /^\d{4}-\d{2}$/);
});

test("empty input stays empty", () => {
  assert.equal(receiptsToCsv([]), ACN_CSV_HEADER + "\n");
  assert.deepEqual(rollupByOperatorMonth([]), []);
  assert.deepEqual(markCollected([]), []);
});
