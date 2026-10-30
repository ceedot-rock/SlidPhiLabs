import assert from "node:assert/strict";
import {
  computeQuote, FREE_BYTES, CENTS_PER_GB, PRO_CENTS_PER_GB, MIN_PAID_CENTS,
  DEFAULT_CAP_CENTS, ALERT_FRACTION, capStatus, includedBytesForSku,
} from "./suite-pricing.js";
import { PRODUCT_CATALOG, SKU_ALIASES, resolveSku } from "./lib/payments-rails.js";

const gib = 1024 * 1024 * 1024;

// ---- PCC meter: $0.25/GB input, 1 GB free ----
const under = computeQuote({ bytes: 1 * gib, used_bytes: 0 });
assert.equal(under.free, true);
assert.equal(under.amount_cents, 0);

const atCap = computeQuote({ bytes: 1 * gib, used_bytes: 0, sku: "" });
assert.equal(atCap.free, true);

const oneOver = computeQuote({ bytes: 1 * gib, used_bytes: 1 * gib });
assert.equal(oneOver.free, false);
assert.equal(oneOver.amount_cents, MIN_PAID_CENTS, "1 GB over is 25¢, card floor $1");
assert.equal(oneOver.breakdown.rates.applied_usd_per_gb, 0.25);

const twenty = computeQuote({ bytes: 20 * gib, used_bytes: 0 });
assert.equal(twenty.free, false);
assert.equal(twenty.breakdown.usage_cents, 475, "19 GB × 25¢ = 475");
assert.equal(twenty.amount_cents, 475);

assert.equal(FREE_BYTES, 1 * gib);
assert.equal(CENTS_PER_GB, 25);
assert.equal(PRO_CENTS_PER_GB, 20);

// Pro plan: 100 GB included, then 20¢/GB
const proUnder = computeQuote({ bytes: 10 * gib, used_bytes: 0, sku: "pcc-pro" });
assert.equal(proUnder.free, true, "Pro includes 100 GB");
const proOver = computeQuote({ bytes: 120 * gib, used_bytes: 0, sku: "pcc-pro" });
assert.equal(proOver.breakdown.usage_cents, 400, "20 GB over at 20¢ = 400");
assert.equal(proOver.amount_cents, 400);
const proYear = computeQuote({ bytes: 10 * gib, used_bytes: 0, sku: "pcc-pro-year" });
assert.equal(proYear.free, true, "Pro annual includes 100 GB/month");

// Lab Pass carries NO included GB (compression out of the bundle)
const labPass = computeQuote({ bytes: 10 * gib, used_bytes: 0, sku: "lab-pass" });
assert.equal(labPass.free, false, "Lab Pass unlocks no PCC allowance");
assert.equal(labPass.breakdown.usage_cents, 225, "9 GB over the 1 GB free cap at 25¢");
assert.equal(includedBytesForSku("lab-pass"), 1 * gib);

// Retired gc-* SKUs fall back to the free cap
const gcYear = computeQuote({ bytes: 10 * gib, used_bytes: 0, sku: "gc-year" });
assert.equal(gcYear.free, false, "Retired gc-year has no allowance");
assert.equal(includedBytesForSku("gc-year"), 1 * gib);

// Op does not change the price: single input rate
const c40 = computeQuote({ bytes: 40 * gib, op: "compress" }).amount_cents;
const d40 = computeQuote({ bytes: 40 * gib, op: "decompress" }).amount_cents;
const r40 = computeQuote({ bytes: 40 * gib, op: "roundtrip" }).amount_cents;
assert.equal(c40, d40);
assert.equal(d40, r40);
assert.equal(c40, 975, "39 GB × 25¢");

// Cap / alert: default $25 cap, alert at 80% ($20)
const cap = capStatus({ spent_cents: 2000, cap_cents: DEFAULT_CAP_CENTS });
assert.equal(cap.alert, true);
assert.equal(cap.alert_at_cents, 2000);
assert.equal(cap.remaining_cents, 500);
const capQuiet = capStatus({ spent_cents: 1999, cap_cents: DEFAULT_CAP_CENTS });
assert.equal(capQuiet.alert, false);
assert.equal(DEFAULT_CAP_CENTS, 2500);
assert.equal(ALERT_FRACTION, 0.8);
const capDefault = capStatus({ spent_cents: 2000 });
assert.equal(capDefault.cap_cents, DEFAULT_CAP_CENTS);

// ---- Catalog price truth (blank-slate table) ----
const price = (sku) => PRODUCT_CATALOG[sku].amount_cents;
assert.equal(price("chamber-month"), 2000);
assert.equal(price("chamber-year"), 20000);
assert.equal(price("lab-pass"), 49500);
assert.equal(price("rider-solo"), 1200);
assert.equal(price("rider-team"), 4900);
assert.equal(price("rider-fleet"), 19900);
assert.equal(price("psi-meter"), 2500);
assert.equal(price("psi-meter-year"), 25000);
assert.equal(price("lab-check"), 5);
assert.equal(price("pcc-pro"), 2500);
assert.equal(price("pcc-pro-year"), 25000);
assert.equal(price("cuni-exception"), 49000);
assert.equal(price("pulsar-exception"), 49000);
assert.equal(price("tnssrc-grant"), 49000);
assert.equal(price("psi-grant"), 49000);
assert.equal(price("warrant-addon"), 800);
assert.equal(price("warrant-addon-year"), 8000);
assert.equal(price("consulting"), 35000);
assert.equal(price("gitdepot"), 1500);
assert.equal(price("gitdepot-year"), 15000);
assert.equal(price("teachaid-student"), 600);
assert.equal(price("teachaid-student-year"), 6000);
assert.equal(price("teachaid-pilot"), 250000);
assert.equal(price("acp-certification"), 99000);
assert.equal(price("grant-founding"), 19000);
assert.equal(price("grant-volume"), 39000);

// Retired SKUs stay retired
for (const sku of ["gc-day", "gc-month", "gc-year", "psi-month", "psi-year",
  "warrant-month", "warrant-year", "rider-bundle", "rider-crew", "rider-shop",
  "foundry-plus"]) {
  assert.equal(PRODUCT_CATALOG[sku].retired, true, `${sku} retired`);
}
// Retired aliases resolve to the new SKUs
assert.equal(resolveSku("gc-month"), "pcc-pro");
assert.equal(resolveSku("gc-year"), "pcc-pro-year");
assert.equal(resolveSku("gc-day"), "suite");
assert.equal(resolveSku("psi-year"), "psi-grant");
assert.equal(resolveSku("psi-month"), "psi-grant");
assert.equal(resolveSku("warrant-year"), "warrant-addon-year");
assert.equal(resolveSku("warrant-month"), "warrant-addon");
assert.equal(resolveSku("rider-crew"), "rider-team");
assert.equal(resolveSku("rider-shop"), "rider-fleet");
assert.equal(resolveSku("foundry-plus"), "lab-pass");
assert.equal(resolveSku("tru8-year"), "pcc-pro-year");
assert.equal(resolveSku("psi-embed-grant"), "psi-grant");
assert.equal(resolveSku("pcc-meter"), "suite");
assert.equal(resolveSku("unified-grant"), "unified-grant");
assert.equal(price("unified-grant"), 49000);

// Annual = 10x monthly, everywhere
assert.equal(price("chamber-year"), price("chamber-month") * 10);
assert.equal(price("psi-meter-year"), price("psi-meter") * 10);
assert.equal(price("pcc-pro-year"), price("pcc-pro") * 10);
assert.equal(price("teachaid-student-year"), price("teachaid-student") * 10);
assert.equal(price("gitdepot-year"), price("gitdepot") * 10);
assert.equal(price("warrant-addon-year"), price("warrant-addon") * 10);
assert.equal(price("rider-solo-year"), price("rider-solo") * 10);
assert.equal(price("rider-team-year"), price("rider-team") * 10);
assert.equal(price("rider-fleet-year"), price("rider-fleet") * 10);

// Untouched SKUs keep their prices
assert.equal(price("lab-translate"), 10);
assert.equal(price("lab-squeeze"), 10);
assert.equal(price("rider-ops-month"), 3700);
assert.equal(price("rider-ops-year"), 36900);
assert.equal(price("psi-org"), 7900);
assert.equal(price("tnssrc-bakeoff"), 1931);
assert.equal(price("oss-support"), 19900);
assert.equal(price("sponsor"), 2900);
assert.equal(price("donate"), 2999);
assert.equal(price("gao-entry"), 100);

// Meter fields: free allowance + cap default + 80% alert where the proposal states them
assert.equal(PRODUCT_CATALOG.suite.meter.rate_cents, 25);
assert.equal(PRODUCT_CATALOG.suite.meter.free_gb, 1);
assert.equal(PRODUCT_CATALOG.suite.meter.cap_default_cents, 2500);
assert.equal(PRODUCT_CATALOG.suite.meter.alert_fraction, 0.8);
assert.equal(PRODUCT_CATALOG.quikgater.meter.rate_cents, 2);
assert.equal(PRODUCT_CATALOG.quikgater.meter.cap_default_cents, 1000);
assert.equal(PRODUCT_CATALOG["lab-check"].meter.rate_cents, 5);
assert.equal(PRODUCT_CATALOG["rider-solo"].meter.overage_cents, 2);
assert.equal(PRODUCT_CATALOG["rider-solo"].meter.cap_default_cents, 2400);
assert.equal(PRODUCT_CATALOG["psi-meter"].meter.overage_cents_per_100k, 200);

// Claims ledger: no grant text names an unrecovered build; no one-fifth; no hosted-compression framing
for (const [sku, p] of Object.entries(PRODUCT_CATALOG)) {
  const text = `${p.name || ""} ${p.blurb || ""}`;
  assert.ok(!text.includes("43,724,575") && !text.includes("45,813,567"),
    `${sku} grant text names an unrecovered build`);
  assert.ok(!text.includes("one-fifth"), `${sku} carries the one-fifth claim`);
  if (!p.retired) {
    assert.ok(!text.toLowerCase().includes("hosted compression") &&
      !text.toLowerCase().includes("hosted compressor"), `${sku} hosted framing`);
  }
}
// TNSSRC grant names 0.1.0 only
assert.ok(PRODUCT_CATALOG["tnssrc-grant"].blurb.includes("0.1.0"));

console.log("suite-pricing + price-truth OK", {
  twenty: twenty.amount_display,
  proOver: proOver.amount_display,
  labPass: labPass.amount_display,
});
