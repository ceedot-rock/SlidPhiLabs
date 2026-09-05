import { test } from "node:test";
import assert from "node:assert/strict";
import { computeQuote, classifyBytes, FREE_BYTES, MIN_PAID_CENTS } from "../src/quote.mjs";
const GiB = 1024 ** 3;

test("6.9 GB unpaid cap is free", () => {
  const q = computeQuote({ bytes: 6.9 * GiB, product: "auto" });
  assert.equal(q.amount_cents, 0);
  assert.equal(q.free, true);
});

test("7 GB is over cap", () => {
  const q = computeQuote({ bytes: 7 * GiB, product: "auto" });
  assert.equal(q.free, false);
  assert.ok(q.amount_cents >= MIN_PAID_CENTS);
});

test("FREE_BYTES is the 6.9 GB cap", () => {
  assert.equal(computeQuote({ bytes: FREE_BYTES }).amount_cents, 0);
});

test("over free undercuts 9c/GB", () => {
  const q = computeQuote({ bytes: FREE_BYTES + 10 * GiB, product: "auto" });
  assert.equal(q.free, false);
  // 10 GB * 5c = 50c
  assert.equal(q.amount_cents, 50);
  assert.ok(q.amount_cents / 10 < 9); // under 9¢/GB
});

test("min paid is under first 1GB egress", () => {
  assert.ok(MIN_PAID_CENTS < 9);
});

test("classify zeros", () => {
  assert.equal(classifyBytes(Buffer.alloc(64)).dataClass, "zeros");
});
