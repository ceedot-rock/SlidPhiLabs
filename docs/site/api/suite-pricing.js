/**
 * SPL Pay Per Suite — freemium usage pricing (canonical)
 *
 * Free showcase: first FREE_BYTES of every job — $0 (feel the platform).
 * Paid usage: only bytes over free cap, at rates far under typical cloud egress
 * (~$0.05–$0.09/GB class). No surprise $2/9GB marketing fiction.
 *
 * License packages (CDDG, ZRW tiers) are separate fixed Stripe SKUs.
 */

export const FREE_BYTES = 1 * 1024 * 1024 * 1024; // 1 GiB free per job
export const MAX_BYTES = 100 * 1024 * 1024 * 1024; // 100 GiB
export const MAX_CENTS = 1_000_000; // $10,000 Stripe-ish cap
/** Minimum charge once over free tier (still << competitor egress on multi‑GB). */
export const MIN_PAID_CENTS = 15; // $0.15

/**
 * Optional product adder (cents) only when paid — keeps process SKU slightly higher.
 * Not applied on free tier.
 */
export const PRODUCT_ADD_CENTS = {
  auto: 0,
  zrw: 0,
  "cddg-split": 50, // +$0.50 process path when billable
  blackjack: 0,
  "shard-zip": 0,
  "shard-tsdb": 0,
  "slid-phi": 0,
};

/** Mild class mults — shouldn't erase freemium story. */
export const DATA_MULT = {
  zeros: 0.9,
  ramp: 0.95,
  walk: 1.0,
  mixed_ints: 1.05,
  timeseries: 1.05,
  json_series: 1.0,
  binary: 1.1,
  unknown: 1.0,
};

export const OP_MULT = {
  compress: 1.0,
  decompress: 0.75,
  roundtrip: 1.15,
};

/**
 * Usage fee on billable GiB (after free cap), USD cents.
 *   first 50 GiB over free:  $0.015 / GiB  (1.5¢)
 *   after that:              $0.008 / GiB  (0.8¢)
 * Far under ~5–9¢/GB cloud egress class.
 */
export function usageFeeCents(billableBytes) {
  const b = Math.max(0, Number(billableBytes) || 0);
  if (b <= 0) return 0;
  const gb = b / (1024 * 1024 * 1024);
  if (gb <= 50) return Math.round(gb * 1.5); // $0.015/GB → 1.5 cents
  return Math.round(50 * 1.5 + (gb - 50) * 0.8);
}

/**
 * @returns {object} quote with free tier flags
 */
export function computeQuote({
  product = "auto",
  dataClass = "unknown",
  op = "compress",
  bytes = 0,
} = {}) {
  const prod =
    PRODUCT_ADD_CENTS[product] != null ? product : "auto";
  const cls = DATA_MULT[dataClass] != null ? dataClass : "unknown";
  const operation = OP_MULT[op] != null ? op : "compress";
  const b = Math.max(0, Math.min(Number(bytes) || 0, MAX_BYTES));

  const free_bytes = FREE_BYTES;
  const billable = Math.max(0, b - free_bytes);
  const free = billable <= 0;

  if (free) {
    return {
      ok: true,
      service: "SPL Pay Per Suite",
      currency: "usd",
      amount_cents: 0,
      amount_display: "0.00",
      free: true,
      tier: "free_showcase",
      message:
        "Free showcase — first 1 GB per job is $0. Feel the platform; pay only for usage above the cap.",
      breakdown: {
        product: prod,
        product_add_cents: 0,
        free_bytes,
        free_gb: 1,
        billable_bytes: 0,
        usage_cents: 0,
        size_cents: 0,
        data_class: cls,
        data_multiplier: DATA_MULT[cls],
        op: operation,
        op_multiplier: OP_MULT[operation],
        bytes: b,
        mb: +(b / (1024 * 1024)).toFixed(4),
        gb: +(b / (1024 * 1024 * 1024)).toFixed(6),
        min_paid_cents: MIN_PAID_CENTS,
        max_cents: MAX_CENTS,
        rates: {
          free_cap_gb: 1,
          usd_per_gb_first_50: 0.015,
          usd_per_gb_after_50: 0.008,
          note: "vs typical cloud egress often ~$0.05–$0.09/GB",
        },
      },
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
    message:
      "Usage pricing — first 1 GB free, then ~1.5¢/GB (0.8¢/GB after 50 GB over free). Far under typical cloud egress.",
    breakdown: {
      product: prod,
      product_add_cents: add,
      free_bytes,
      free_gb: 1,
      billable_bytes: billable,
      usage_cents: usage,
      size_cents: usage,
      data_class: cls,
      data_multiplier: DATA_MULT[cls],
      op: operation,
      op_multiplier: OP_MULT[operation],
      bytes: b,
      mb: +(b / (1024 * 1024)).toFixed(4),
      gb: +(b / (1024 * 1024 * 1024)).toFixed(6),
      min_paid_cents: MIN_PAID_CENTS,
      max_cents: MAX_CENTS,
      rates: {
        free_cap_gb: 1,
        usd_per_gb_first_50: 0.015,
        usd_per_gb_after_50: 0.008,
        note: "vs typical cloud egress often ~$0.05–$0.09/GB",
      },
    },
  };
}

/** Example anchors for docs / UI */
export const PRICING_EXAMPLES = [
  { gb: 0.5, label: "500 MB", approx: "$0 (free)" },
  { gb: 1, label: "1 GB", approx: "$0 (free cap)" },
  { gb: 9, label: "9 GB", approx: "~$0.15 (min paid)" },
  { gb: 50, label: "50 GB", approx: "~$0.75 usage" },
  { gb: 100, label: "100 GB", approx: "~$1.15 usage" },
];
