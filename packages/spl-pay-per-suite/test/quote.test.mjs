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

test("default op is compress", () => {
  assert.equal(
    computeQuote({ bytes: 20 * GiB }).amount_cents,
    computeQuote({ bytes: 20 * GiB, op: "compress" }).amount_cents
  );
});

test("op actually changes the price (decorative-multiplier regression)", () => {
  const c = computeQuote({ bytes: 40 * GiB, op: "compress" }).amount_cents;
  const d = computeQuote({ bytes: 40 * GiB, op: "decompress" }).amount_cents;
  const r = computeQuote({ bytes: 40 * GiB, op: "roundtrip" }).amount_cents;
  assert.notEqual(c, d, "compress vs decompress must differ");
  assert.notEqual(c, r, "compress vs roundtrip must differ");
  assert.ok(d < c && c < r, `expected decompress < compress < roundtrip, got ${d} < ${c} < ${r}`);
});

test("20 GB decompress tier: usage 58¢, $1 card minimum applies", () => {
  const q = computeQuote({ bytes: 20 * GiB, op: "decompress" });
  assert.equal(q.free, false);
  assert.equal(q.breakdown.usage_cents, 58, "18 GB × 3.2¢ = 57.6 → 58");
  assert.equal(q.breakdown.op_multiplier, 0.4);
  assert.equal(q.amount_cents, 100, "$1 card floor");
});

test("40 GB decompress tier prices above the floor", () => {
  const q = computeQuote({ bytes: 40 * GiB, op: "decompress" });
  assert.equal(q.amount_cents, 122, "38 GB × 3.2¢ = 121.6 → 122");
});

test("20 GB roundtrip tier", () => {
  const q = computeQuote({ bytes: 20 * GiB, op: "roundtrip" });
  assert.equal(q.free, false);
  assert.equal(q.breakdown.usage_cents, 166, "18 GB × 9.2¢ = 165.6 → 166");
  assert.equal(q.amount_cents, 166);
});

test("unknown op falls back to compress pricing", () => {
  const q = computeQuote({ bytes: 20 * GiB, op: "bogus" });
  assert.equal(q.breakdown.op, "compress");
  assert.equal(q.amount_cents, 144);
});

test("min paid is $1", () => {
  assert.equal(MIN_PAID_CENTS, 100);
});

test("classify zeros", () => {
  assert.equal(classifyBytes(Buffer.alloc(64)).dataClass, "zeros");
});
