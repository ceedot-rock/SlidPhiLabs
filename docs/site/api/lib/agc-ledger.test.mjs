import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mintAgc, debitAgc, balanceAgc, agentForOrder, AGC_PER_PACK } from "./agc-ledger.mjs";

const AGENT = "aabbccddeeff0011";
const AGENT2 = "0011223344556677";

function isolate() {
  const d = mkdtempSync(join(tmpdir(), "agc-test-"));
  process.env.AUTH_DIR = d; // beats /data + AGC_DIR so tests never touch prod
  process.env.AGC_DIR = d;
}

test("mint -> balance -> debit roundtrip", () => {
  isolate();
  const m = mintAgc({ agent_id: AGENT, order_id: "ord-1", tx: "0xabc", network: "eip155:8453" });
  assert.equal(m.ok, true);
  assert.equal(m.balance, AGC_PER_PACK);
  assert.equal(m.receipt.kind, "mint");
  const b = balanceAgc(AGENT);
  assert.equal(b.balance, AGC_PER_PACK);
  const d = debitAgc({ agent_id: AGENT, credits: 8, ref: "board-search", memo: "search" });
  assert.equal(d.ok, true);
  assert.equal(d.balance, AGC_PER_PACK - 8);
  assert.equal(d.receipt.kind, "debit");
});

test("mint idempotent on order_id and on tx", () => {
  isolate();
  mintAgc({ agent_id: AGENT, order_id: "ord-9", tx: "0xabc", network: "eip155:8453" });
  const dup1 = mintAgc({ agent_id: AGENT, order_id: "ord-9", tx: "0xabc", network: "eip155:8453" });
  assert.equal(dup1.duplicate, true);
  assert.equal(dup1.balance, AGC_PER_PACK);
  const dup2 = mintAgc({ agent_id: AGENT, order_id: "ord-other", tx: "0xabc", network: "eip155:8453" });
  assert.equal(dup2.duplicate, true);
  assert.equal(balanceAgc(AGENT).balance, AGC_PER_PACK);
});

test("debit fails closed on short balance, idempotent on ref", () => {
  isolate();
  mintAgc({ agent_id: AGENT2, order_id: "o1", tx: "t1" });
  const short = debitAgc({ agent_id: AGENT2, credits: AGC_PER_PACK + 1, ref: "big" });
  assert.equal(short.ok, false);
  assert.equal(short.error, "insufficient_agc");
  assert.equal(balanceAgc(AGENT2).balance, AGC_PER_PACK);
  const d1 = debitAgc({ agent_id: AGENT2, credits: 5, ref: "r1" });
  const d2 = debitAgc({ agent_id: AGENT2, credits: 5, ref: "r1" });
  assert.equal(d2.duplicate, true);
  assert.equal(balanceAgc(AGENT2).balance, AGC_PER_PACK - 5);
  void d1;
});

test("bad inputs rejected, agents isolated", () => {
  isolate();
  assert.equal(mintAgc({ agent_id: "nope", order_id: "o", tx: "t" }).ok, false);
  assert.equal(mintAgc({ agent_id: AGENT, order_id: "", tx: "t" }).ok, false);
  assert.equal(mintAgc({ agent_id: AGENT, order_id: "o", tx: "t", credits: 0 }).ok, false);
  assert.equal(debitAgc({ agent_id: AGENT, credits: -3 }).ok, false);
  assert.equal(balanceAgc("zzz").ok, false);
  mintAgc({ agent_id: AGENT, order_id: "oA", tx: "tA" });
  assert.equal(balanceAgc(AGENT2).balance, 0);
});

test("agentForOrder resolves mint order, misses unknown", () => {
  isolate();
  assert.equal(agentForOrder("nope-never"), null);
  mintAgc({ agent_id: AGENT, order_id: "ord-find", tx: "tF" });
  assert.equal(agentForOrder("ord-find"), AGENT.toLowerCase());
});
