import assert from "node:assert/strict";
import { computeQuote, FREE_BYTES, CENTS_PER_GB, MIN_PAID_CENTS } from "./suite-pricing.js";

const gib = 1024 * 1024 * 1024;

const under = computeQuote({ bytes: 1 * gib, used_bytes: 0 });
assert.equal(under.free, true);
assert.equal(under.amount_cents, 0);

const atCap = computeQuote({ bytes: 2 * gib, used_bytes: 0 });
assert.equal(atCap.free, true);

const oneOver = computeQuote({ bytes: 1 * gib, used_bytes: 2 * gib });
assert.equal(oneOver.free, false);
assert.equal(oneOver.amount_cents, MIN_PAID_CENTS, "1 GB over is 8¢, card floor $1");

const used15 = computeQuote({ bytes: 1 * gib, used_bytes: 1.5 * gib });
assert.equal(used15.free, false);
assert.ok(used15.breakdown.billable_bytes > 0);
assert.equal(used15.amount_cents, MIN_PAID_CENTS);

const twenty = computeQuote({ bytes: 20 * gib, used_bytes: 0 });
assert.equal(twenty.free, false);
const billable18 = 18 * gib;
const raw = Math.round((billable18 / gib) * CENTS_PER_GB);
assert.equal(twenty.breakdown.usage_cents, raw);
assert.equal(twenty.amount_cents, raw);

const year = computeQuote({ bytes: 10 * gib, used_bytes: 0, sku: "gc-year" });
assert.equal(year.free, true, "AWARE year includes 2000 GB");

assert.equal(FREE_BYTES, 2 * gib);

// op tiers: compress is the base 8¢/GB, decompress 0.4×, roundtrip 1.15×
const decomp20 = computeQuote({ bytes: 20 * gib, used_bytes: 0, op: "decompress" });
assert.equal(decomp20.free, false);
assert.equal(decomp20.breakdown.usage_cents, 58, "18 GB × 3.2¢ = 57.6 → 58");
assert.equal(decomp20.amount_cents, MIN_PAID_CENTS, "$1 card floor");

const decomp40 = computeQuote({ bytes: 40 * gib, used_bytes: 0, op: "decompress" });
assert.equal(decomp40.amount_cents, 122, "38 GB × 3.2¢ = 121.6 → 122");

const round20 = computeQuote({ bytes: 20 * gib, used_bytes: 0, op: "roundtrip" });
assert.equal(round20.amount_cents, 166, "18 GB × 9.2¢ = 165.6 → 166");

const c40 = computeQuote({ bytes: 40 * gib, op: "compress" }).amount_cents;
assert.ok(decomp40.amount_cents < c40 && c40 < computeQuote({ bytes: 40 * gib, op: "roundtrip" }).amount_cents,
  "op must change the charged price");

const badOp = computeQuote({ bytes: 20 * gib, op: "bogus" });
assert.equal(badOp.breakdown.op, "compress", "unknown op falls back to compress");
assert.equal(badOp.amount_cents, raw);

console.log("suite-pricing OK", {
  under: under.amount_display,
  oneOver: oneOver.amount_display,
  twenty: twenty.amount_display,
  decomp20: decomp20.amount_display,
  round20: round20.amount_display,
});
