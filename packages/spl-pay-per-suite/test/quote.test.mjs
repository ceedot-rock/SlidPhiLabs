import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeQuote,
  classifyBytes,
  usageFeeCents,
  capStatus,
  includedBytesForSku,
  rateCentsPerGbForSku,
  FREE_BYTES,
  FREE_GB,
  CENTS_PER_GB,
  PRO_CENTS_PER_GB,
  MIN_PAID_CENTS,
  DEFAULT_CAP_CENTS,
  ALERT_FRACTION,
  SUITE_PRICING,
} from "../src/quote.mjs";
const GiB = 1024 ** 3;

test("1 GB lifetime allowance is free", () => {
  const q = computeQuote({ bytes: 1 * GiB, product: "auto" });
  assert.equal(q.amount_cents, 0);
  assert.equal(q.free, true);
});

test("1 GB over the cap hits the $1 card minimum", () => {
  const q = computeQuote({ bytes: 2 * GiB, product: "auto" });
  assert.equal(q.free, false);
  assert.equal(q.breakdown.usage_cents, 25, "1 GB over × 25¢ = 25");
  assert.equal(q.amount_cents, 100, "$1 card floor");
  assert.equal(q.breakdown.rates.applied_usd_per_gb, 0.25);
});

test("FREE_BYTES is the 1 GB cap", () => {
  assert.equal(FREE_GB, 1);
  assert.equal(FREE_BYTES, 1 * GiB);
  assert.equal(computeQuote({ bytes: FREE_BYTES }).amount_cents, 0);
});

test("20 GB is 19 GB × 25¢", () => {
  const q = computeQuote({ bytes: 20 * GiB, product: "auto" });
  assert.equal(q.free, false);
  assert.equal(q.breakdown.usage_cents, 475);
  assert.equal(q.amount_cents, 475);
});

test("usageFeeCents prices input at 25¢/GB", () => {
  assert.equal(usageFeeCents(0), 0);
  assert.equal(usageFeeCents(1 * GiB), 25);
  assert.equal(CENTS_PER_GB, 25);
  assert.equal(PRO_CENTS_PER_GB, 20);
});

test("op does not change the price (single input rate)", () => {
  const c = computeQuote({ bytes: 40 * GiB, op: "compress" }).amount_cents;
  const d = computeQuote({ bytes: 40 * GiB, op: "decompress" }).amount_cents;
  const r = computeQuote({ bytes: 40 * GiB, op: "roundtrip" }).amount_cents;
  assert.equal(c, d);
  assert.equal(d, r);
  assert.equal(c, 975, "39 GB × 25¢");
});

test("unknown op keeps the same price", () => {
  const q = computeQuote({ bytes: 20 * GiB, op: "bogus" });
  assert.equal(q.amount_cents, 475);
});

test("Pro SKU includes 100 GB, then 20¢/GB", () => {
  const under = computeQuote({ bytes: 10 * GiB, sku: "pcc-pro" });
  assert.equal(under.free, true);
  const over = computeQuote({ bytes: 120 * GiB, sku: "pcc-pro" });
  assert.equal(over.breakdown.usage_cents, 400, "20 GB over at 20¢ = 400");
  assert.equal(over.amount_cents, 400);
  assert.equal(rateCentsPerGbForSku("pcc-pro-year"), 20);
  assert.equal(includedBytesForSku("pcc-pro-year"), 100 * GiB);
});

test("lab-pass and retired gc-year fall back to the free cap", () => {
  assert.equal(includedBytesForSku("lab-pass"), 1 * GiB);
  assert.equal(includedBytesForSku("gc-year"), 1 * GiB);
  const q = computeQuote({ bytes: 10 * GiB, sku: "lab-pass" });
  assert.equal(q.free, false);
  assert.equal(q.breakdown.usage_cents, 225, "9 GB over at 25¢");
});

test("min paid is $1 with $25 default cap and 80% alert", () => {
  assert.equal(MIN_PAID_CENTS, 100);
  assert.equal(DEFAULT_CAP_CENTS, 2500);
  assert.equal(ALERT_FRACTION, 0.8);
  const cap = capStatus({ spent_cents: 2000 });
  assert.equal(cap.alert, true);
  assert.equal(cap.alert_at_cents, 2000);
  assert.equal(cap.remaining_cents, 500);
});

test("SUITE_PRICING is the lifetime model", () => {
  assert.equal(SUITE_PRICING.model, "lifetime_1gb_25c");
  assert.equal(SUITE_PRICING.free_cap_gb, 1);
  assert.equal(SUITE_PRICING.usd_per_gb_after_free, 0.25);
  assert.equal(SUITE_PRICING.window, "lifetime");
});

test("used_bytes consumes the lifetime allowance", () => {
  const q = computeQuote({ bytes: 1 * GiB, used_bytes: 1 * GiB });
  assert.equal(q.free, false);
  assert.equal(q.amount_cents, 100, "1 GB over is 25¢, card floor $1");
});

test("classify zeros", () => {
  assert.equal(classifyBytes(Buffer.alloc(64)).dataClass, "zeros");
});
