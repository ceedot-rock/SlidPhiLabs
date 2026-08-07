/**
 * SPL Pay Per Suite — freemium pricing (canonical)
 *
 * Rule (product requirement):
 *   1) Equal when theirs is $0  → free up to the common free-egress size limit
 *   2) Under their first paid charge → per‑GB under first hyperscale egress tier
 *
 * Reference (public list prices, US-ish, 2025–26):
 *   AWS/Azure-class free egress often ~100 GB/month aggregate free
 *   First paid egress tier often ~$0.09/GB (AWS), ~$0.087 (Azure), higher on GCP
 *   R2 / DIY compress = $0 always for pure transfer/software
 *
 * We match $0 through FREE_BYTES, then charge under ~$0.09/GB.
 * License packages (CDDG, ZRW, …) stay separate fixed SKUs.
 */

export const FREE_BYTES = 100 * 1024 * 1024 * 1024; // 100 GiB free per job (match free-tier size class)
export const MAX_BYTES = 1024 * 1024 * 1024 * 1024; // 1 TiB hard cap per job
export const MAX_CENTS = 1_000_000; // $10,000
/** Min once over free — under first 1 GB of paid egress (~$0.09) */
export const MIN_PAID_CENTS = 5; // $0.05

export const PRODUCT_ADD_CENTS = {
  auto: 0,
  zrw: 0,
  "cddg-split": 25, // +$0.25 process path when billable only
  blackjack: 0,
  "shard-zip": 0,
  "shard-tsdb": 0,
  "slid-phi": 0,
};

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
 * Usage on billable GiB after free cap (USD cents).
 *   first 100 GiB over free:  $0.05 / GiB  (under ~$0.09 first paid egress)
 *   after that:               $0.04 / GiB
 */
export function usageFeeCents(billableBytes) {
  const b = Math.max(0, Number(billableBytes) || 0);
  if (b <= 0) return 0;
  const gb = b / (1024 * 1024 * 1024);
  if (gb <= 100) return Math.round(gb * 5); // $0.05/GB
  return Math.round(100 * 5 + (gb - 100) * 4); // $0.04/GB after
}

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

  const rates = {
    free_cap_gb: 100,
    min_paid_usd: 0.05,
    usd_per_gb_first_100: 0.05,
    usd_per_gb_after_100: 0.04,
    competitor_ref: {
      free_tier_size_class_gb: 100,
      first_paid_egress_usd_per_gb: 0.09,
      note: "Equal at $0 through free-tier size; under first paid egress (~$0.09/GB)",
    },
  };

  if (free) {
    return {
      ok: true,
      service: "SPL Pay Per Suite",
      currency: "usd",
      amount_cents: 0,
      amount_display: "0.00",
      free: true,
      tier: "free_match",
      message:
        "Free — matches $0 competitor free-tier size (first 100 GB per job). Pay only above free, under ~$0.09/GB first paid egress.",
      breakdown: {
        product: prod,
        product_add_cents: 0,
        free_bytes,
        free_gb: 100,
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
        rates,
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
    tier: "usage_undercut",
    message:
      "Usage — free first 100 GB, then ~5¢/GB (4¢ after 100 GB over free): under typical first paid cloud egress (~9¢/GB).",
    breakdown: {
      product: prod,
      product_add_cents: add,
      free_bytes,
      free_gb: 100,
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
      rates,
    },
  };
}

export const PRICING_EXAMPLES = [
  { gb: 1, label: "1 GB", approx: "$0 (free)" },
  { gb: 9, label: "9 GB", approx: "$0 (free — under free-tier size)" },
  { gb: 100, label: "100 GB", approx: "$0 (free cap)" },
  { gb: 110, label: "110 GB", approx: "~$0.50 (10 GB × 5¢)" },
  { gb: 200, label: "200 GB", approx: "~$5.00 (100 GB × 5¢)" },
];
