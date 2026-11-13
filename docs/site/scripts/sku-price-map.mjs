/**
 * SKU → Stripe Price-ID map check (LAB50 step 18).
 *
 * Compares PRODUCT_CATALOG (single source: api/lib/payments-rails.js)
 * against scripts/stripe-prices.json, and — when STRIPE_SECRET_KEY is set —
 * against live Stripe Prices (amount + currency + active).
 *
 * Exit 0: every catalog SKU has a live-verified Price ID.
 * Exit 1: missing mapping, or a live mismatch. Live check skipped loudly
 *         when no key is present; the manifest check still runs.
 */
import { readFile } from "node:fs/promises";
import { PRODUCT_CATALOG } from "../api/lib/payments-rails.js";

const MAP_PATH = new URL("./stripe-prices.json", import.meta.url);

const skus = Object.entries(PRODUCT_CATALOG).filter(
  ([, v]) => v && Number.isInteger(v.amount_cents) && v.amount_cents > 0
);
const manifest = JSON.parse(await readFile(MAP_PATH, "utf8"));
const mapped = Object.fromEntries(
  Object.entries(manifest).filter(([k]) => !k.startsWith("_"))
);

const missing = skus.filter(([sku]) => !mapped[sku]).map(([sku]) => sku);
const extra = Object.keys(mapped).filter((sku) => !skus.some(([s]) => s === sku));

let mismatched = [];
let liveSkipped = true;
const key = process.env.STRIPE_SECRET_KEY || "";
if (key) {
  liveSkipped = false;
  for (const [sku, priceId] of Object.entries(mapped)) {
    const want = skus.find(([s]) => s === sku);
    if (!want) continue;
    const r = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!r.ok) {
      mismatched.push(`${sku}: stripe lookup failed (${r.status})`);
      continue;
    }
    const p = await r.json();
    if (!p.active || p.unit_amount !== want[1].amount_cents || (p.currency || "").toLowerCase() !== "usd") {
      mismatched.push(`${sku}: want ${want[1].amount_cents}¢ usd active, got ${p.unit_amount}¢ ${p.currency} active=${p.active}`);
    }
  }
}

console.log(`catalog: ${skus.length} SKUs with amounts`);
console.log(`mapped: ${Object.keys(mapped).length}, missing: ${missing.length}, extra: ${extra.length}`);
for (const s of missing) console.log(`  MISSING ${s}`);
for (const s of extra) console.log(`  EXTRA ${s} (not in catalog)`);
for (const s of mismatched) console.log(`  MISMATCH ${s}`);
console.log(liveSkipped ? "live Stripe check: SKIPPED (no STRIPE_SECRET_KEY)" : "live Stripe check: ran");

if (missing.length || extra.length || mismatched.length) {
  console.log("SKU-PRICE-MAP: FAIL");
  process.exit(1);
}
console.log("SKU-PRICE-MAP: OK");
