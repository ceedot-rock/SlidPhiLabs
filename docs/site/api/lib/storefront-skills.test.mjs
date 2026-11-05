import test from "node:test";
import assert from "node:assert/strict";
import { createSkuCatalog, getSku, quoteSku, SKU_PRICES, MIN_PAID_CENTS } from "./storefront-skills.mjs";

test("frozen price table covers the 4 priced surfaces", () => {
  assert.equal(SKU_PRICES["gitdepot"], 1500);
  assert.equal(SKU_PRICES["gitdepot-year"], 15000);
  assert.equal(SKU_PRICES["pcc-pro"], 2500);
  assert.equal(SKU_PRICES["chamber-month"], 2000);
  assert.equal(Object.keys(SKU_PRICES).length, 4);
});

test("getSku reads known SKUs, normalizes case", () => {
  assert.deepEqual(getSku("gitdepot"), { ok: true, sku: { sku: "gitdepot", price_cents: 1500 } });
  assert.equal(getSku("  PCC-PRO ").sku.price_cents, 2500);
});

test("unknown SKU fails closed", () => {
  const r = getSku("nope");
  assert.equal(r.ok, false);
  assert.equal(r.reason, "unknown_sku");
  assert.deepEqual(r.known, ["chamber-month", "gitdepot", "gitdepot-year", "pcc-pro"]);
  assert.equal(quoteSku("nope").reason, "unknown_sku");
});

test("quoteSku math with $1 minimum", () => {
  assert.equal(MIN_PAID_CENTS, 100);
  assert.deepEqual(quoteSku("gitdepot").quote, { sku: "gitdepot", qty: 1, unit_cents: 1500, amount_cents: 1500 });
  assert.equal(quoteSku("gitdepot", { qty: 3 }).quote.amount_cents, 4500);
  const cheap = createSkuCatalog({ prices: { penny: 5 } });
  assert.equal(cheap.quoteSku("penny").quote.amount_cents, 100);
  const free = createSkuCatalog({ prices: { gratis: 0 } });
  assert.equal(free.quoteSku("gratis").quote.amount_cents, 0);
});

test("bad quantity fails closed", () => {
  assert.equal(quoteSku("gitdepot", { qty: 0 }).reason, "bad_quantity");
  assert.equal(quoteSku("gitdepot", { qty: -2 }).reason, "bad_quantity");
  assert.equal(quoteSku("gitdepot", { qty: 1.5 }).reason, "bad_quantity");
});

test("override adapter wins; bad override fails closed", () => {
  const promo = createSkuCatalog({ priceFor: ({ sku, base_cents }) => (sku === "gitdepot" ? 1000 : base_cents) });
  assert.equal(promo.quoteSku("gitdepot").quote.unit_cents, 1000);
  assert.equal(promo.quoteSku("pcc-pro").quote.unit_cents, 2500);
  const bad = createSkuCatalog({ priceFor: () => -5 });
  assert.equal(bad.quoteSku("gitdepot").reason, "bad_override");
  const boom = createSkuCatalog({ priceFor: () => { throw new Error("down"); } });
  assert.equal(boom.quoteSku("gitdepot").reason, "override_failed");
});

test("list returns the frozen table sorted", () => {
  const rows = createSkuCatalog().list();
  assert.deepEqual(rows.map((r) => r.sku), ["chamber-month", "gitdepot", "gitdepot-year", "pcc-pro"]);
});
