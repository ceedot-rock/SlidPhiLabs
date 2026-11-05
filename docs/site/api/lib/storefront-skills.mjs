/**
 * Storefront skills 0.1.0 — frozen SKU reader for the priced surfaces.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Deterministic, offline, in-memory: no disk, no network. The price table
 * is frozen (gitdepot monthly/annual plus the PCC and Chamber seats);
 * unknown SKUs fail closed ({ ok:false }), never null/throw. Quotes floor
 * at the $1 card minimum. An injectable priceFor adapter may override the
 * frozen unit price (e.g. promos); its output is validated and a bad
 * override fails closed.
 */

export const STOREFRONT_SKILLS_VERSION = "0.1.0";
export const MIN_PAID_CENTS = 100;

/** Frozen unit prices in cents: the 4 priced surfaces. */
export const SKU_PRICES = Object.freeze({
  "gitdepot": 1500,
  "gitdepot-year": 15000,
  "pcc-pro": 2500,
  "chamber-month": 2000,
});

function normSku(sku) {
  return String(sku == null ? "" : sku).trim().toLowerCase();
}

/**
 * Create an isolated SKU catalog reader.
 * Adapters (all optional, offline defaults): { prices } frozen-table
 * replacement, { priceFor: ({ sku, base_cents }) => cents } per-quote
 * override. The default priceFor keeps the frozen price.
 */
export function createSkuCatalog({ prices = SKU_PRICES, priceFor = null } = {}) {
  const table = { ...(prices || {}) };
  const override = typeof priceFor === "function" ? priceFor : () => null;
  return {
    getSku(sku) {
      const key = normSku(sku);
      const base = Number(table[key]);
      if (!key || !Number.isSafeInteger(base) || base < 0) {
        return { ok: false, reason: "unknown_sku", known: Object.keys(table).sort() };
      }
      return { ok: true, sku: { sku: key, price_cents: base } };
    },
    quoteSku(sku, { qty = 1 } = {}) {
      const key = normSku(sku);
      const base = Number(table[key]);
      if (!key || !Number.isSafeInteger(base) || base < 0) {
        return { ok: false, reason: "unknown_sku", known: Object.keys(table).sort() };
      }
      const n = Number(qty);
      if (!Number.isSafeInteger(n) || n < 1) return { ok: false, reason: "bad_quantity" };
      let unit = base;
      let custom = null;
      try {
        custom = override({ sku: key, base_cents: base });
      } catch {
        return { ok: false, reason: "override_failed" };
      }
      if (custom != null) {
        const c = Number(custom);
        if (!Number.isSafeInteger(c) || c < 0) return { ok: false, reason: "bad_override" };
        unit = c;
      }
      const raw = unit * n;
      const amount_cents = raw <= 0 ? 0 : Math.max(MIN_PAID_CENTS, raw);
      return { ok: true, quote: { sku: key, qty: n, unit_cents: unit, amount_cents } };
    },
    list() {
      return Object.keys(table)
        .sort()
        .map((sku) => ({ sku, price_cents: Number(table[sku]) }));
    },
  };
}

/** Default shared reader over the frozen table. */
export const skuCatalog = createSkuCatalog();

export function getSku(sku) {
  return skuCatalog.getSku(sku);
}

export function quoteSku(sku, opts) {
  return skuCatalog.quoteSku(sku, opts);
}
