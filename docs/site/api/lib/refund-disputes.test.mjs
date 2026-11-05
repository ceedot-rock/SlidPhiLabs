import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  recordKnownOrder,
  openDispute,
  resolveDispute,
  getDispute,
  listDisputes,
} from "./refund-disputes.mjs";

const NOW = "2026-11-05T00:00:00.000Z";

function stubs(ids) {
  let i = 0;
  return { now: () => NOW, id: () => ids[i++] };
}

function isolate() {
  const d = mkdtempSync(join(tmpdir(), "disputes-test-"));
  process.env.DISPUTES_DIR = d;
  delete process.env.AUTH_DIR;
  return d;
}

test("open fails closed on unknown order", () => {
  isolate();
  const r = openDispute({ order_id: "ord-ghost", reason: "never arrived" }, stubs(["dp_x"]));
  assert.equal(r.ok, false);
  assert.equal(r.error, "unknown_order");
  assert.equal(openDispute({ order_id: "", reason: "x" }, {}).error, "bad_order_id");
  assert.equal(openDispute({ order_id: "ord-1", reason: "   " }, {}).error, "bad_reason");
});

test("known order opens a dispute", () => {
  isolate();
  const a = stubs(["dp_1"]);
  recordKnownOrder({ order_id: "ord-1", amount_cents: 999, chain: "eip155:8453", refund_to: "buyer-1" }, a);
  const r = openDispute({ order_id: "ord-1", reason: "item not delivered" }, a);
  assert.equal(r.ok, true);
  assert.equal(r.dispute.status, "open");
  assert.equal(r.dispute.order_id, "ord-1");
  assert.equal(r.dispute.order_snapshot.amount_cents, 999);
});

test("lookupOrder adapter resolves orders without the local book", () => {
  isolate();
  const a = { ...stubs(["dp_ad"]), lookupOrder: (id) => (id === "ord-ext" ? { order_id: id, amount_cents: 500, chain: "solana-mainnet-beta", refund_to: "wallet-9", agent_id: "agent-9" } : null) };
  const r = openDispute({ order_id: "ord-ext", reason: "double charge" }, a);
  assert.equal(r.ok, true);
  assert.equal(r.dispute.order_snapshot.agent_id, "agent-9");
  const miss = openDispute({ order_id: "ord-else", reason: "x" }, a);
  assert.equal(miss.error, "unknown_order");
});

test("refund resolution produces instruction + reputation hook", () => {
  isolate();
  const a = stubs(["dp_r"]);
  recordKnownOrder({ order_id: "ord-r", amount_cents: 1200, chain: "eip155:8453", refund_to: "buyer-r", agent_id: "agent-r" }, a);
  openDispute({ order_id: "ord-r", reason: "defective" }, a);
  const r = resolveDispute({ dispute_id: "dp_r", decision: "refund", resolved_by: "op-1" }, a);
  assert.equal(r.ok, true);
  assert.equal(r.dispute.status, "refunded");
  assert.equal(r.refund_instruction.requires, "operator_signature");
  assert.equal(r.refund_instruction.order_id, "ord-r");
  assert.equal(r.refund_instruction.amount_cents, 1200);
  assert.equal(r.refund_instruction.asset, "USDC");
  assert.equal(r.reputation_hook.hook, "reputation");
  assert.equal(r.reputation_hook.event, "dispute_refunded");
  assert.equal(r.reputation_hook.dispute_id, "dp_r");
});

test("deny resolution produces reputation hook only", () => {
  isolate();
  const a = stubs(["dp_d"]);
  recordKnownOrder({ order_id: "ord-d", amount_cents: 300 }, a);
  openDispute({ order_id: "ord-d", reason: "changed mind" }, a);
  const r = resolveDispute({ dispute_id: "dp_d", decision: "deny" }, a);
  assert.equal(r.ok, true);
  assert.equal(r.dispute.status, "denied");
  assert.equal(r.refund_instruction, null);
  assert.equal(r.reputation_hook.event, "dispute_denied");
});

test("resolve is single-shot and validates input", () => {
  isolate();
  const a = stubs(["dp_s"]);
  recordKnownOrder({ order_id: "ord-s", amount_cents: 100 }, a);
  openDispute({ order_id: "ord-s", reason: "late" }, a);
  resolveDispute({ dispute_id: "dp_s", decision: "deny" }, a);
  const again = resolveDispute({ dispute_id: "dp_s", decision: "refund" }, a);
  assert.equal(again.ok, false);
  assert.equal(again.error, "already_resolved");
  assert.equal(resolveDispute({ dispute_id: "dp_s", decision: "maybe" }, a).error, "bad_decision");
  assert.equal(resolveDispute({ dispute_id: "dp_ghost", decision: "deny" }, a).error, "unknown_dispute");
  assert.equal(getDispute("dp_ghost", {}).error, "unknown_dispute");
  assert.equal(listDisputes({}).intents, undefined);
  assert.equal(listDisputes({}).disputes.length, 1);
});
