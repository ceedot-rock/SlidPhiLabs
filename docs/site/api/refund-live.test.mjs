import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { recordKnownOrder, openDispute, resolveDispute } from "./lib/refund-disputes.mjs";
import { executeRefund, recordSettled } from "./lib/refund-executor.mjs";

// Live only with a test-mode key. Without one this file is a documented
// skip — the offline dispute/executor suites already run unconditionally.
// LAB50 step 20.
const KEY = process.env.STRIPE_TEST_KEY || "";

async function stripe(path, params) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`stripe ${r.status}: ${data?.error?.message || "failed"}`);
  return data;
}

test("test-mode refund: dispute to receipt to settled ledger entry", async (t) => {
  if (!KEY) {
    t.skip("no STRIPE_TEST_KEY — run with a test-mode key for the live leg");
    return;
  }
  const dir = await mkdtemp(join(tmpdir(), "refundlive-"));
  const A = { dir };

  const pi = await stripe("payment_intents", {
    amount: "200",
    currency: "usd",
    payment_method: "pm_card_visa",
    confirm: "true",
    "metadata[app]": "teachaid-step20-probe",
  });
  assert.equal(pi.status, "succeeded");

  assert.equal(recordKnownOrder({ order_id: pi.id, amount_cents: 200 }, A).ok, true);
  const opened = openDispute({ order_id: pi.id, reason: "step-20 test-mode probe" }, A);
  assert.equal(opened.ok, true);
  const decided = resolveDispute({ dispute_id: opened.dispute.dispute_id, decision: "refund" }, A);
  assert.equal(decided.ok, true);

  const settle = async (instruction) => {
    const refund = await stripe("refunds", { payment_intent: pi.id });
    return { ok: true, receipt: { refund_id: refund.id, status: refund.status, amount: refund.amount } };
  };
  const exec = executeRefund({ dispute_id: opened.dispute.dispute_id, instruction: decided.instruction }, { ...A, settle });
  assert.equal(exec.ok, true);
  assert.equal(exec.record.status, "settled");
  const done = recordSettled({
    dispute_id: opened.dispute.dispute_id,
    receipt: exec.record.receipt,
  }, A);
  assert.equal(done.ok, true);
  assert.equal(done.record.status, "settled");
  assert.match(JSON.stringify(done.record), /re_/);
});
