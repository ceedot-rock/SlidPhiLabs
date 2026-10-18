import test from "node:test";
import assert from "node:assert/strict";
import { clientIdFor, purchasePayload, reportPurchase } from "./ga4.mjs";

test("payload converts cents and carries no PII", () => {
  const b = purchasePayload({
    sku: "gc-month",
    amountCents: 3900,
    currency: "USD",
    transactionId: "cs_123",
    clientId: "abc",
  });
  assert.equal(b.client_id, "abc");
  const [e] = b.events;
  assert.equal(e.name, "purchase");
  assert.equal(e.params.transaction_id, "cs_123");
  assert.equal(e.params.currency, "usd");
  assert.equal(e.params.value, 39);
  assert.equal(e.params.items[0].item_id, "gc-month");
  assert.ok(!JSON.stringify(b).includes("@"));
});

test("client id is a stable hash, not the raw order", () => {
  const a = clientIdFor("cs_123");
  assert.equal(a, clientIdFor("cs_123"));
  assert.equal(a.length, 64);
  assert.ok(!a.includes("cs_123"));
});

test("skips silently without secret", async () => {
  const saved = process.env.GA4_API_SECRET;
  delete process.env.GA4_API_SECRET;
  try {
    const r = await reportPurchase({ sku: "x", amountCents: 1, currency: "usd", orderId: "o1" });
    assert.equal(r.skipped, true);
  } finally {
    if (saved !== undefined) process.env.GA4_API_SECRET = saved;
  }
});

test("skips without order id even with secret", async () => {
  process.env.GA4_API_SECRET = "test-secret-never-sent";
  try {
    const r = await reportPurchase({ sku: "x", amountCents: 1, currency: "usd", orderId: "" });
    assert.equal(r.skipped, true);
  } finally {
    delete process.env.GA4_API_SECRET;
  }
});
