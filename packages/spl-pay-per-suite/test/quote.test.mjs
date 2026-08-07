import { test } from "node:test";
import assert from "node:assert/strict";
import { computeQuote, classifyBytes, FREE_BYTES, MIN_PAID_CENTS } from "../src/quote.mjs";

const GiB = 1024 * 1024 * 1024;

test("free under 1 GB", () => {
  const q = computeQuote({ product: "auto", bytes: 100_000 });
  assert.equal(q.amount_cents, 0);
  assert.equal(q.free, true);
});

test("exactly 1 GiB free", () => {
  const q = computeQuote({ bytes: FREE_BYTES, product: "auto" });
  assert.equal(q.amount_cents, 0);
  assert.equal(q.free, true);
});

test("over free hits min $2", () => {
  const q = computeQuote({ bytes: FREE_BYTES + 1, product: "auto" });
  assert.equal(q.free, false);
  assert.equal(q.amount_cents, MIN_PAID_CENTS);
  assert.equal(MIN_PAID_CENTS, 200);
});

test("9 GB is min paid $2 not 15c", () => {
  const q = computeQuote({ bytes: 9 * GiB, product: "auto" });
  assert.equal(q.amount_cents, 200);
});

test("large volume exceeds min", () => {
  const q = computeQuote({ bytes: 200 * GiB, product: "auto" });
  assert.ok(q.amount_cents > 200, "got " + q.amount_display);
});

test("classify zeros", () => {
  assert.equal(classifyBytes(Buffer.alloc(64)).dataClass, "zeros");
});
