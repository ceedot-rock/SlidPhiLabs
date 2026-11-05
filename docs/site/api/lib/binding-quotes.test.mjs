/** Binding quotes tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createQuote, honorQuote, specHash } from "./binding-quotes.mjs";

const NOW = 1_790_000_000_000;

test("create + honor round-trips when nothing changes", () => {
  const spec = { task: "compress", bytes: 1200 };
  const c = createQuote(spec, 400, { nowMs: NOW });
  assert.equal(c.ok, true);
  assert.equal(c.quote.amount_cents, 400);
  assert.equal(c.quote.spec_hash, specHash(spec));
  assert.equal(c.quote.expires_at, NOW + 15 * 60 * 1000);
  const h = honorQuote(c.quote, spec, 400, { nowMs: NOW });
  assert.equal(h.ok, true);
  assert.deepEqual(h.quote, c.quote);
});

test("live price must equal the locked price: any drift is price_changed", () => {
  const spec = { task: "score" };
  const { quote } = createQuote(spec, 400, { nowMs: NOW });
  for (const live of [399, 401, 0, 100000]) {
    assert.deepEqual(honorQuote(quote, spec, live, { nowMs: NOW }), {
      ok: false,
      error: "price_changed",
    });
  }
});

test("tampered spec is spec_mismatch", () => {
  const { quote } = createQuote({ task: "a", n: 1 }, 100, { nowMs: NOW });
  assert.deepEqual(honorQuote(quote, { task: "a", n: 2 }, 100, { nowMs: NOW }), {
    ok: false,
    error: "spec_mismatch",
  });
});

test("expired quotes fail closed; expires_at itself is still valid", () => {
  const { quote } = createQuote({ t: 1 }, 50, { nowMs: NOW, ttlMs: 1000 });
  assert.equal(honorQuote(quote, { t: 1 }, 50, { nowMs: NOW + 1000 }).ok, true);
  assert.deepEqual(honorQuote(quote, { t: 1 }, 50, { nowMs: NOW + 1001 }), {
    ok: false,
    error: "quote_expired",
  });
});

test("invalid quotes/specs/amounts are fail-closed, never throw", () => {
  const { quote } = createQuote({ t: 1 }, 50, { nowMs: NOW });
  for (const bad of [null, undefined, {}, { ...quote, spec_hash: "zz" }, "q"]) {
    assert.deepEqual(honorQuote(bad, { t: 1 }, 50, { nowMs: NOW }), {
      ok: false,
      error: "invalid_quote",
    });
  }
  assert.equal(honorQuote(quote, null, 50, { nowMs: NOW }).error, "invalid_spec");
  assert.equal(honorQuote(quote, { t: 1 }, -5, { nowMs: NOW }).error, "invalid_amount");
  assert.equal(createQuote(null, 50).error, "invalid_spec");
  assert.equal(createQuote({ t: 1 }, -1).error, "invalid_amount");
  assert.equal(createQuote({ t: 1 }, 1.5).error, "invalid_amount");
});

test("spec hash is stable under key order and sensitive to values", () => {
  assert.equal(specHash({ a: 1, b: 2 }), specHash({ b: 2, a: 1 }));
  assert.notEqual(specHash({ a: 1 }), specHash({ a: 2 }));
});

test("quote ids are deterministic for identical inputs", () => {
  const a = createQuote({ t: 1 }, 10, { nowMs: NOW });
  const b = createQuote({ t: 1 }, 10, { nowMs: NOW });
  assert.equal(a.quote.quote_id, b.quote.quote_id);
  const c = createQuote({ t: 1 }, 10, { nowMs: NOW, quoteId: "custom_1" });
  assert.equal(c.quote.quote_id, "custom_1");
});
