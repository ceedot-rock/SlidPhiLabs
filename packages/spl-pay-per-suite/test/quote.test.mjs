import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeQuote,
  classifyBytes,
  FREE_BYTES,
  MIN_PAID_CENTS,
} from "../src/quote.mjs";

const GiB = 1024 * 1024 * 1024;

test("free under 1 GB", () => {
  const q = computeQuote({ product: "auto", dataClass: "zeros", op: "compress", bytes: 100_000 });
  assert.equal(q.service, "SPL Pay Per Suite");
  assert.equal(q.amount_cents, 0);
  assert.equal(q.free, true);
  assert.equal(q.tier, "free_showcase");
});

test("exactly 1 GiB free", () => {
  const q = computeQuote({ bytes: FREE_BYTES, product: "auto" });
  assert.equal(q.amount_cents, 0);
  assert.equal(q.free, true);
});

test("over free costs at least min paid", () => {
  const q = computeQuote({ bytes: FREE_BYTES + 1, product: "auto" });
  assert.equal(q.free, false);
  assert.ok(q.amount_cents >= MIN_PAID_CENTS);
});

test("larger over free costs more", () => {
  const a = computeQuote({ bytes: 2 * GiB, dataClass: "binary", product: "zrw" });
  const b = computeQuote({ bytes: 50 * GiB, dataClass: "binary", product: "zrw" });
  assert.ok(b.amount_cents > a.amount_cents);
});

test("9 GB is far under old ~$2 slogan (~$0.15 class)", () => {
  const q = computeQuote({ bytes: 9 * GiB, product: "auto", op: "compress" });
  assert.ok(q.amount_cents <= 50, "should be under $0.50, got " + q.amount_display);
  assert.ok(q.amount_cents >= MIN_PAID_CENTS);
});

test("cddg-split add only when billable", () => {
  const free = computeQuote({ product: "cddg-split", bytes: 100 });
  assert.equal(free.amount_cents, 0);
  const paid = computeQuote({ product: "cddg-split", bytes: 2 * GiB });
  const auto = computeQuote({ product: "auto", bytes: 2 * GiB });
  assert.ok(paid.amount_cents >= auto.amount_cents);
});

test("classify zeros buffer", () => {
  const buf = Buffer.alloc(64);
  const c = classifyBytes(buf);
  assert.equal(c.dataClass, "zeros");
});
