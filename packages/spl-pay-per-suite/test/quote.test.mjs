import { test } from "node:test";
import assert from "node:assert/strict";
import { computeQuote, classifyBytes, FREE_BYTES, MIN_PAID_CENTS } from "../src/quote.mjs";
const GiB = 1024 ** 3;

test("9 GB free (equal when theirs is 0 in free tier)", () => {
  const q = computeQuote({ bytes: 9 * GiB, product: "auto" });
  assert.equal(q.amount_cents, 0);
  assert.equal(q.free, true);
});

test("100 GB free cap", () => {
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
