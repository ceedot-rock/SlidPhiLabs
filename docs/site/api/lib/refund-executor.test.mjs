import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  executeRefund,
  claimRefund,
  recordSettled,
  getRefund,
  listQueued,
} from "./refund-executor.mjs";

const NOW = "2026-11-05T00:00:00.000Z";
const INSTR = { order_id: "ord-1", amount_cents: 1200, asset: "USDC", chain: "eip155:8453", to: "buyer-1", requires: "operator_signature" };

function stubs(ids) {
  let i = 0;
  return { dir: mkdtempSync(join(tmpdir(), "rfx-test-")), now: () => NOW, id: () => ids[i++] };
}

test("execute fails closed on bad input", () => {
  const a = stubs(["rfx_x"]);
  assert.equal(executeRefund({ dispute_id: "", instruction: INSTR }, a).error, "bad_dispute_id");
  assert.equal(executeRefund({ dispute_id: "dp_1", instruction: null }, a).error, "bad_instruction");
  assert.equal(executeRefund({ dispute_id: "dp_1", instruction: { ...INSTR, amount_cents: 0 } }, a).error, "bad_instruction_amount");
  assert.equal(executeRefund({ dispute_id: "dp_1", instruction: { ...INSTR, to: "  " } }, a).error, "bad_instruction_destination");
});

test("offline default queues; queue is claimable then settleable", () => {
  const a = stubs(["rfx_1"]);
  const q = executeRefund({ dispute_id: "dp_q", instruction: INSTR }, a);
  assert.equal(q.ok, true);
  assert.equal(q.queued, true);
  assert.equal(q.record.status, "queued");
  assert.deepEqual(listQueued(a).queued.map((r) => r.dispute_id), ["dp_q"]);
  const c = claimRefund({ dispute_id: "dp_q" }, a);
  assert.equal(c.ok, true);
  assert.equal(c.record.status, "claimed");
  assert.deepEqual(listQueued(a).queued, []);
  const s = recordSettled({ dispute_id: "dp_q", receipt: { tx: "0xabc", by: "op-1" } }, a);
  assert.equal(s.ok, true);
  assert.equal(s.record.status, "settled");
  assert.equal(s.record.receipt.tx, "0xabc");
  assert.equal(claimRefund({ dispute_id: "dp_q" }, a).error, "not_claimable");
});

test("execute is idempotent by dispute_id", () => {
  const a = stubs(["rfx_2", "rfx_3"]);
  const first = executeRefund({ dispute_id: "dp_idem", instruction: INSTR }, a);
  assert.equal(first.ok, true);
  const second = executeRefund({ dispute_id: "dp_idem", instruction: INSTR }, a);
  assert.equal(second.ok, true);
  assert.equal(second.duplicate, true);
  assert.equal(second.record.exec_id, first.record.exec_id);
});

test("settle adapter path settles immediately with receipt", () => {
  const a = { ...stubs(["rfx_4"]), settle: (instr) => ({ tx: "0xsettle", amount_cents: instr.amount_cents }) };
  const r = executeRefund({ dispute_id: "dp_live", instruction: INSTR }, a);
  assert.equal(r.ok, true);
  assert.equal(r.record.status, "settled");
  assert.equal(r.record.receipt.tx, "0xsettle");
  // Idempotent even on the settled path.
  const again = executeRefund({ dispute_id: "dp_live", instruction: INSTR }, a);
  assert.equal(again.duplicate, true);
});

test("settle adapter failure fails closed; unknown reads fail", () => {
  const a = { ...stubs(["rfx_5"]), settle: () => { throw new Error("rpc down"); } };
  assert.equal(executeRefund({ dispute_id: "dp_boom", instruction: INSTR }, a).error, "settle_failed");
  assert.equal(getRefund("dp_ghost", a).error, "unknown_refund");
  assert.equal(claimRefund({ dispute_id: "dp_ghost" }, a).error, "unknown_refund");
  assert.equal(recordSettled({ dispute_id: "dp_ghost", receipt: {} }, a).error, "unknown_refund");
  assert.equal(recordSettled({ dispute_id: "dp_ghost", receipt: null }, a).error, "bad_receipt");
});
