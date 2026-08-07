import { test } from "node:test";
import assert from "node:assert/strict";
import { computeQuote, classifyBytes, MIN_CENTS } from "../src/quote.mjs";

test("service name and floor bound", () => {
  const q = computeQuote({ product: "auto", dataClass: "zeros", op: "compress", bytes: 0 });
  assert.equal(q.service, "SPL Pay Per Suite");
  assert.ok(q.amount_cents >= MIN_CENTS);
});

test("larger files cost more", () => {
  const small = computeQuote({ bytes: 100_000, dataClass: "binary", product: "zrw" });
  const big = computeQuote({ bytes: 50_000_000, dataClass: "binary", product: "zrw" });
  assert.ok(big.amount_cents > small.amount_cents);
});

test("cddg-split base higher than zrw", () => {
  const z = computeQuote({ product: "zrw", bytes: 0 });
  const c = computeQuote({ product: "cddg-split", bytes: 0 });
  assert.ok(c.amount_cents >= z.amount_cents);
});

test("classify zeros buffer", () => {
  const buf = Buffer.alloc(64);
  const c = classifyBytes(buf);
  assert.equal(c.dataClass, "zeros");
});
