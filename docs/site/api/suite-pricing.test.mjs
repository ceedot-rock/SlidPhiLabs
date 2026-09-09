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

console.log("suite-pricing OK", {
  under: under.amount_display,
  oneOver: oneOver.amount_display,
  twenty: twenty.amount_display,
});
