import { test } from "node:test";
import assert from "node:assert/strict";
import { computeQuote, classifyBytes, FREE_BYTES, MIN_PAID_CENTS } from "../src/quote.mjs";
const GiB = 1024 ** 3;

test("2 GB unpaid cap is free", () => {
  const q = computeQuote({ bytes: 2 * GiB, product: "auto" });
  assert.equal(q.amount_cents, 0);
  assert.equal(q.free, true);
});

test("3 GB is over cap and hits $1 card minimum", () => {
  const q = computeQuote({ bytes: 3 * GiB, product: "auto" });
  assert.equal(q.free, false);
  assert.equal(q.amount_cents, 100);
});

test("FREE_BYTES is the 2 GB cap", () => {
  assert.equal(computeQuote({ bytes: FREE_BYTES }).amount_cents, 0);
});

test("20 GB is 18 GB × 8¢", () => {
  const q = computeQuote({ bytes: 20 * GiB, product: "auto" });
  assert.equal(q.free, false);
  assert.equal(q.amount_cents, 144);
});

test("min paid is $1", () => {
  assert.equal(MIN_PAID_CENTS, 100);
});

test("classify zeros", () => {
  assert.equal(classifyBytes(Buffer.alloc(64)).dataClass, "zeros");
});
