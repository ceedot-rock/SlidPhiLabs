/**
 * SPL Pay Per Suite — local quote (matches site API suite-pricing.js).
 * First 1 GB of input free, once per IP address (lifetime, no monthly
 * reset). Then $0.25/GB of INPUT — single rate, no op-differentiated tiers:
 * the meter prices input bytes, not the operation. Pro plan SKUs
 * (pcc-pro, pcc-pro-year): 100 GB included each month, then $0.20/GB.
 * $1 card minimum. Customer-set monthly spend cap (default $25), 80% alert.
 *
 * JS gold cases: test/cuni-meter.test.mjs (and `cuni prove` against
 * test/print-suite-meter.mjs when CUNI_BIN + CUNI_SUITE_METER_LAW are set).
 * Site gold: docs/site/api/suite-pricing.js + suite-pricing.test.mjs.
 */
export const FREE_GB = 1;
export const FREE_WINDOW = "lifetime";
export const FREE_BYTES = 1 * 1024 * 1024 * 1024;
export const MAX_BYTES = 1024 * 1024 * 1024 * 1024;
export const MAX_CENTS = 1_000_000;
export const MIN_PAID_CENTS = 100;
export const MIN_CENTS = 0;
export const CENTS_PER_GB = 25;
export const PRO_CENTS_PER_GB = 20;
export const PRO_INCLUDED_GB = 100;
export const DEFAULT_CAP_CENTS = 2500;
export const ALERT_FRACTION = 0.8;

/** Canonical suite rates — MCP, package.json, site, API must match */
export const SUITE_PRICING = {
  model: "lifetime_1gb_25c",
  free_cap_gb: FREE_GB,
  free_window: "lifetime-per-ip",
  free_cap_bytes: FREE_BYTES,
  usd_per_gb_after_free: 0.25,
  pro_usd_per_gb: PRO_CENTS_PER_GB / 100,
  pro_included_gb: PRO_INCLUDED_GB,
  min_paid_usd: 1,
  min_paid_cents: MIN_PAID_CENTS,
  window: FREE_WINDOW,
  try_gate: "retired",
  human_one_liner:
    "First 1 GB free, once per IP · then $0.25/GB of input · Pro: 100 GB included, then $0.20/GB · $1 card minimum",
};

/** Included GB by plan SKU. Pro seats reset monthly; the free cap is lifetime-per-IP. */
export const INCLUDED_GB = Object.freeze({
  "": FREE_GB,
  env: FREE_GB,
  "pcc-pro": PRO_INCLUDED_GB,
  "pcc-pro-year": PRO_INCLUDED_GB,
  suite: FREE_GB,
});

export function includedBytesForSku(sku) {
  const k = String(sku || "").toLowerCase();
  const gb = INCLUDED_GB[k] != null ? INCLUDED_GB[k] : FREE_GB;
  return Math.round(gb * 1024 * 1024 * 1024);
}

export function rateCentsPerGbForSku(sku) {
  const k = String(sku || "").toLowerCase();
  if (k === "pcc-pro" || k === "pcc-pro-year") return PRO_CENTS_PER_GB;
  return CENTS_PER_GB;
}

export const PRODUCT_ADD_CENTS = {
  auto: 0, zrw: 0, "cddg-split": 25, blackjack: 0,
  "shard-zip": 0, "shard-tsdb": 0, "slid-phi": 0,
};
export const PRODUCT_BASE = PRODUCT_ADD_CENTS;

export const DATA_MULT = {
  zeros: 0.9, ramp: 0.95, walk: 1.0, mixed_ints: 1.05,
  timeseries: 1.05, json_series: 1.0, binary: 1.1, unknown: 1.0,
};
// NOTE: DATA_MULT is reported in the quote breakdown but deliberately NOT
// applied to the charge — data class is not our cost driver.
// The site meter (suite-pricing.js) does not model it either.
/**
 * Op multipliers are informational only (kept so CLI/MCP `ops` listings and
 * existing imports keep working). The meter prices INPUT bytes at one flat
 * rate — op does not change the price.
 */
export const OP_MULT = {
  compress: 1.0, decompress: 1.0, roundtrip: 1.0,
};
/** Effective ¢/GB of input: flat 25.0 for every op (Pro SKUs: 20.0). */
export const OP_CENTS_PER_GB = {
  compress: 25.0, decompress: 25.0, roundtrip: 25.0,
};

export const STRIPE_PAYMENT_LINK =
  process.env.SPL_PPS_PAYMENT_LINK ||
  "https://www.slidphilabs.com/pay";
export const SITE_PPS =
  process.env.SPL_PPS_SITE || "https://www.slidphilabs.com/gc";
export const API_BASE =
  process.env.SPL_PPS_API || "https://www.slidphilabs.com";

export function usageFeeCents(billableBytes, sku = "") {
  const b = Math.max(0, Number(billableBytes) || 0);
  if (b <= 0) return 0;
  const gb = b / (1024 * 1024 * 1024);
  return Math.round(gb * rateCentsPerGbForSku(sku));
}

/** Cap/alert status for a metered spend. Alert fires at 80% of the cap. */
export function capStatus({ spent_cents = 0, cap_cents = DEFAULT_CAP_CENTS } = {}) {
  const spent = Math.max(0, Number(spent_cents) || 0);
  const cap = Math.max(0, Number(cap_cents) || 0);
  const fraction = cap > 0 ? spent / cap : 0;
  return {
    spent_cents: spent,
    cap_cents: cap,
    fraction,
    alert: fraction >= ALERT_FRACTION,
    alert_at_cents: Math.round(cap * ALERT_FRACTION),
    remaining_cents: Math.max(0, cap - spent),
  };
}

export function computeQuote({
  product = "auto",
  dataClass = "unknown",
  op = "compress",
  bytes = 0,
  used_bytes = 0,
  sku = "",
} = {}) {
  const prod = PRODUCT_ADD_CENTS[product] != null ? product : "auto";
  const cls = DATA_MULT[dataClass] != null ? dataClass : "unknown";
  const operation = typeof op === "string" && op ? op : "compress";
  const b = Math.max(0, Math.min(Number(bytes) || 0, MAX_BYTES));
  const used = Math.max(0, Number(used_bytes) || 0);
  const included = includedBytesForSku(sku);
  const rate = rateCentsPerGbForSku(sku);
  const free_left = Math.max(0, included - used);
  const billable = Math.max(0, b - free_left);
  const free = billable <= 0;
  const rates = {
    free_cap_gb: FREE_GB,
    included_gb: included / (1024 * 1024 * 1024),
    usd_per_gb: CENTS_PER_GB / 100,
    pro_usd_per_gb: PRO_CENTS_PER_GB / 100,
    applied_usd_per_gb: rate / 100,
    min_paid_usd: MIN_PAID_CENTS / 100,
    window: FREE_WINDOW,
    cap_default_cents: DEFAULT_CAP_CENTS,
    alert_fraction: ALERT_FRACTION,
    alert_at_cents: Math.round(DEFAULT_CAP_CENTS * ALERT_FRACTION),
    sku: sku || null,
  };
  const plain_free = `First ${FREE_GB} GB of input is free, once per IP address. After that, $${(CENTS_PER_GB / 100).toFixed(2)}/GB (Pro plan: 100 GB included, then $${(PRO_CENTS_PER_GB / 100).toFixed(2)}/GB). Card charges start at $1. Monthly spend cap default $${(DEFAULT_CAP_CENTS / 100).toFixed(0)}, alert at 80%.`;

  if (free) {
    return {
      ok: true, service: "PCC meter", currency: "usd",
      amount_cents: 0, amount_display: "0.00", free: true, tier: "free",
      plain: plain_free,
      message: plain_free,
      breakdown: {
        product: prod, product_add_cents: 0, product_base_cents: 0,
        free_bytes: included, free_gb: FREE_GB, billable_bytes: 0, usage_cents: 0, size_cents: 0,
        data_class: cls, data_multiplier: DATA_MULT[cls],
        op: operation, op_multiplier: OP_MULT[operation] ?? 1.0,
        op_cents_per_gb: rate,
        bytes: b, mb: +(b/1024/1024).toFixed(4), gb: +(b/1024/1024/1024).toFixed(6),
        used_bytes: used, free_left,
        min_cents: 0, min_paid_cents: MIN_PAID_CENTS, max_cents: MAX_CENTS, rates,
      },
      pay_url: STRIPE_PAYMENT_LINK, suite_url: SITE_PPS,
    };
  }
  const usage = usageFeeCents(billable, sku);
  const cents = Math.min(MAX_CENTS, Math.max(MIN_PAID_CENTS, usage));
  return {
    ok: true, service: "PCC meter", currency: "usd",
    amount_cents: cents, amount_display: (cents / 100).toFixed(2),
    free: false, tier: "usage",
    plain: `${plain_free} This job: $${(cents / 100).toFixed(2)}.`,
    message: `Over the free ${FREE_GB} GB — $${(rate / 100).toFixed(2)}/GB of input, $1 minimum on card.`,
    breakdown: {
      product: prod, product_add_cents: 0, product_base_cents: 0,
      free_bytes: included, free_gb: FREE_GB, billable_bytes: billable, usage_cents: usage, size_cents: usage,
      data_class: cls, data_multiplier: DATA_MULT[cls],
      op: operation, op_multiplier: OP_MULT[operation] ?? 1.0,
      op_cents_per_gb: rate,
      bytes: b, mb: +(b/1024/1024).toFixed(4), gb: +(b/1024/1024/1024).toFixed(6),
      used_bytes: used, free_left,
      min_cents: MIN_PAID_CENTS, min_paid_cents: MIN_PAID_CENTS, max_cents: MAX_CENTS, rates,
    },
    pay_url: STRIPE_PAYMENT_LINK, suite_url: SITE_PPS,
  };
}

export function classifyBytes(buf) {
  if (!buf || !buf.length) return { dataClass: "unknown", tool: "auto", confidence: 0 };
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const n = Math.min(u8.length, 4096);
  let zeros = 0;
  let printable = 0;
  for (let i = 0; i < n; i++) {
    if (u8[i] === 0) zeros++;
    if (u8[i] >= 32 && u8[i] < 127) printable++;
  }
  const zeroRatio = zeros / n;
  const printRatio = printable / n;

  if (printRatio > 0.85 && (u8[0] === 0x7b || u8[0] === 0x5b)) {
    return { dataClass: "json_series", tool: "zrw", confidence: 0.7 };
  }

  if (u8.length >= 16 && u8.length % 4 === 0) {
    const view = new DataView(u8.buffer, u8.byteOffset, Math.min(u8.length, 400));
    const ints = [];
    for (let i = 0; i + 4 <= view.byteLength; i += 4) {
      ints.push(view.getInt32(i, true));
    }
    if (ints.length >= 4) {
      const allZero = ints.every((v) => v === 0);
      if (allZero) return { dataClass: "zeros", tool: "zrw", confidence: 0.9 };
      let ramp = true;
      for (let i = 1; i < Math.min(ints.length, 64); i++) {
        if (ints[i] !== ints[0] + i) {
          ramp = false;
          break;
        }
      }
      if (ramp) return { dataClass: "ramp", tool: "zrw", confidence: 0.85 };
      const diffs = [];
      for (let i = 1; i < Math.min(ints.length, 64); i++) diffs.push(Math.abs(ints[i] - ints[i - 1]));
      const maxD = Math.max(...diffs);
      if (maxD > 0 && maxD < 1000) {
        return { dataClass: "walk", tool: "zrw", confidence: 0.65 };
      }
      return { dataClass: "mixed_ints", tool: "blackjack", confidence: 0.55 };
    }
  }

  if (zeroRatio > 0.6) return { dataClass: "zeros", tool: "zrw", confidence: 0.6 };
  if (printRatio > 0.9) return { dataClass: "json_series", tool: "shard-zip", confidence: 0.45 };
  return { dataClass: "binary", tool: "auto", confidence: 0.4 };
}
