/** SPL Pay Per Suite — unpaid cap 6.9 GB + 3 hours, then ~5¢/GB. */
export const FREE_BYTES = Math.round(6.9 * 1024 * 1024 * 1024);
export const TRIAL_SECONDS = 3 * 60 * 60;
export const MAX_BYTES = 1024 * 1024 * 1024 * 1024;
export const MAX_CENTS = 1_000_000;
export const MIN_PAID_CENTS = 5;
export const PRODUCT_ADD_CENTS = { auto: 0, zrw: 0, "cddg-split": 25, blackjack: 0, "shard-zip": 0, "shard-tsdb": 0, "slid-phi": 0 };
export const DATA_MULT = { zeros: 0.9, ramp: 0.95, walk: 1.0, mixed_ints: 1.05, timeseries: 1.05, json_series: 1.0, binary: 1.1, unknown: 1.0 };
export const OP_MULT = { compress: 1.0, decompress: 0.75, roundtrip: 1.15 };
export function usageFeeCents(billableBytes) {
  const b = Math.max(0, Number(billableBytes) || 0);
  if (b <= 0) return 0;
  const gb = b / (1024 * 1024 * 1024);
  if (gb <= 100) return Math.round(gb * 5);
  return Math.round(100 * 5 + (gb - 100) * 4);
}
export function computeQuote({ product = "auto", dataClass = "unknown", op = "compress", bytes = 0 } = {}) {
  const prod = PRODUCT_ADD_CENTS[product] != null ? product : "auto";
  const cls = DATA_MULT[dataClass] != null ? dataClass : "unknown";
  const operation = OP_MULT[op] != null ? op : "compress";
  const b = Math.max(0, Math.min(Number(bytes) || 0, MAX_BYTES));
  const free_bytes = FREE_BYTES;
  const billable = Math.max(0, b - free_bytes);
  const free = billable <= 0;
  const rates = { free_cap_gb: 6.9, trial_seconds: TRIAL_SECONDS, usd_per_gb_first_100: 0.05, usd_per_gb_after_100: 0.04 };
  if (free) {
    return { ok: true, service: "SPL Pay Per Suite", currency: "usd", amount_cents: 0, amount_display: "0.00", free: true, tier: "unpaid_cap", message: "Unpaid cap 6.9 GB and 3 hours. Then ~5¢/GB.", breakdown: { product: prod, free_bytes, free_gb: 6.9, billable_bytes: 0, usage_cents: 0, bytes: b, rates, trial_seconds: TRIAL_SECONDS } };
  }
  const usage = usageFeeCents(billable);
  const add = PRODUCT_ADD_CENTS[prod] || 0;
  const raw = Math.round((usage + add) * DATA_MULT[cls] * OP_MULT[operation]);
  const cents = Math.min(MAX_CENTS, Math.max(MIN_PAID_CENTS, raw));
  return { ok: true, service: "SPL Pay Per Suite", currency: "usd", amount_cents: cents, amount_display: (cents / 100).toFixed(2), free: false, tier: "usage", message: "Over 6.9 GB unpaid cap — ~5¢/GB (4¢ bulk).", breakdown: { product: prod, product_add_cents: add, free_bytes, free_gb: 6.9, billable_bytes: billable, usage_cents: usage, bytes: b, rates, trial_seconds: TRIAL_SECONDS } };
}
export const PRICING_EXAMPLES = [
  { gb: 1, label: "1 GB", approx: "$0 (under 6.9 GB cap)" },
  { gb: 6.9, label: "6.9 GB", approx: "$0 (cap)" },
  { gb: 10, label: "10 GB", approx: "~$0.16 (3.1 GB × 5¢)" },
];
