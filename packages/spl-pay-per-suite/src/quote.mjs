/**
 * SPL Pay Per Suite — local quote (matches site freemium money model).
 * Free first 1 GiB · over free: min $2 · ~3¢/GB (2¢ after 50 GB over free).
 * Try Gate retired.
 */

export const FREE_BYTES = 1 * 1024 * 1024 * 1024;
export const MAX_BYTES = 100 * 1024 * 1024 * 1024;
export const MAX_CENTS = 1_000_000;
export const MIN_PAID_CENTS = 200; // $2.00
/** @deprecated free tier can be $0 */
export const MIN_CENTS = 0;

export const PRODUCT_ADD_CENTS = {
  auto: 0,
  zrw: 0,
  "cddg-split": 100,
  blackjack: 0,
  "shard-zip": 0,
  "shard-tsdb": 0,
  "slid-phi": 0,
};
export const PRODUCT_BASE = PRODUCT_ADD_CENTS;

export const DATA_MULT = {
  zeros: 0.9, ramp: 0.95, walk: 1.0, mixed_ints: 1.05,
  timeseries: 1.05, json_series: 1.0, binary: 1.1, unknown: 1.0,
};
export const OP_MULT = {
  compress: 1.0, decompress: 0.75, roundtrip: 1.15,
};

export const STRIPE_PAYMENT_LINK =
  process.env.SPL_PPS_PAYMENT_LINK ||
  "https://buy.stripe.com/aFa00k4B70OYetL0O46wE0g";
export const SITE_PPS = process.env.SPL_PPS_SITE || "https://www.slidphilabs.com/pps";
export const API_BASE = process.env.SPL_PPS_API || "https://www.slidphilabs.com";

export function usageFeeCents(billableBytes) {
  const b = Math.max(0, Number(billableBytes) || 0);
  if (b <= 0) return 0;
  const gb = b / (1024 * 1024 * 1024);
  if (gb <= 50) return Math.round(gb * 3);
  return Math.round(50 * 3 + (gb - 50) * 2);
}

export function computeQuote({
  product = "auto",
  dataClass = "unknown",
  op = "compress",
  bytes = 0,
} = {}) {
  const prod = PRODUCT_ADD_CENTS[product] != null ? product : "auto";
  const cls = DATA_MULT[dataClass] != null ? dataClass : "unknown";
  const operation = OP_MULT[op] != null ? op : "compress";
  const b = Math.max(0, Math.min(Number(bytes) || 0, MAX_BYTES));
  const free_bytes = FREE_BYTES;
  const billable = Math.max(0, b - free_bytes);
  const free = billable <= 0;
  const rates = {
    free_cap_gb: 1,
    min_paid_usd: 2.0,
    usd_per_gb_first_50: 0.03,
    usd_per_gb_after_50: 0.02,
  };

  if (free) {
    return {
      ok: true,
      service: "SPL Pay Per Suite",
      currency: "usd",
      amount_cents: 0,
      amount_display: "0.00",
      free: true,
      tier: "free_showcase",
      message: "Free showcase — first 1 GB $0. Over free: from $2 min · ~3¢/GB.",
      breakdown: {
        product: prod, product_add_cents: 0, product_base_cents: 0,
        free_bytes, free_gb: 1, billable_bytes: 0, usage_cents: 0, size_cents: 0,
        data_class: cls, data_multiplier: DATA_MULT[cls],
        op: operation, op_multiplier: OP_MULT[operation],
        bytes: b, mb: +(b/1024/1024).toFixed(4), gb: +(b/1024/1024/1024).toFixed(6),
        min_cents: 0, min_paid_cents: MIN_PAID_CENTS, max_cents: MAX_CENTS, rates,
      },
      pay_url: STRIPE_PAYMENT_LINK,
      suite_url: SITE_PPS,
    };
  }

  const usage = usageFeeCents(billable);
  const add = PRODUCT_ADD_CENTS[prod] || 0;
  const raw = Math.round((usage + add) * DATA_MULT[cls] * OP_MULT[operation]);
  const cents = Math.min(MAX_CENTS, Math.max(MIN_PAID_CENTS, raw));
  return {
    ok: true,
    service: "SPL Pay Per Suite",
    currency: "usd",
    amount_cents: cents,
    amount_display: (cents / 100).toFixed(2),
    free: false,
    tier: "usage",
    message: "Usage — free 1 GB, then from $2 min · ~3¢/GB (2¢ after 50 GB over free).",
    breakdown: {
      product: prod, product_add_cents: add, product_base_cents: add,
      free_bytes, free_gb: 1, billable_bytes: billable, usage_cents: usage, size_cents: usage,
      data_class: cls, data_multiplier: DATA_MULT[cls],
      op: operation, op_multiplier: OP_MULT[operation],
      bytes: b, mb: +(b/1024/1024).toFixed(4), gb: +(b/1024/1024/1024).toFixed(6),
      min_cents: MIN_PAID_CENTS, min_paid_cents: MIN_PAID_CENTS, max_cents: MAX_CENTS, rates,
    },
    pay_url: STRIPE_PAYMENT_LINK,
    suite_url: SITE_PPS,
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
