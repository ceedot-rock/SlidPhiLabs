/**
 * SPL Pay Per Suite — freemium usage pricing (canonical)
 *
 * Free showcase: first FREE_BYTES of every job — $0 (feel the platform).
 * Paid: min floor covers Stripe + lab intake; per‑GB still under typical
 * cloud egress class (~$0.05–$0.09/GB) so volume stays a win for buyers
 * and unit economics work for the lab.
 *
 * License packages (CDDG, ZRW tiers) are separate fixed Stripe SKUs.
 */

export const FREE_BYTES = 1 * 1024 * 1024 * 1024; // 1 GiB free per job
export const MAX_BYTES = 100 * 1024 * 1024 * 1024; // 100 GiB
export const MAX_CENTS = 1_000_000; // $10,000
/** Minimum once over free — covers fees + minimal lab cost (not 15¢). */
export const MIN_PAID_CENTS = 200; // $2.00

/**
 * Optional product adder (cents) only when paid.
 */
export const PRODUCT_ADD_CENTS = {
  auto: 0,
  zrw: 0,
  "cddg-split": 100, // +$1.00 process path when billable
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
 * Usage fee on billable GiB (after free cap), USD cents.
 *   first 50 GiB over free:  $0.03 / GiB  (3¢)
 *   after that:              $0.02 / GiB  (2¢)
 * Still under ~5–9¢/GB cloud egress class on volume.
 */
export function usageFeeCents(billableBytes) {
  const b = Math.max(0, Number(billableBytes) || 0);
  if (b <= 0) return 0;
  const gb = b / (1024 * 1024 * 1024);
  if (gb <= 50) return Math.round(gb * 3); // $0.03/GB
  return Math.round(50 * 3 + (gb - 50) * 2); // $0.02/GB after
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

  const rates = {
    free_cap_gb: 1,
    min_paid_usd: 2.0,
    usd_per_gb_first_50: 0.03,
    usd_per_gb_after_50: 0.02,
    note: "Free showcase 1 GB · paid min $2 · per‑GB under typical cloud egress (~$0.05–$0.09/GB)",
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
      message:
        "Free showcase — first 1 GB per job is $0. Over free: from $2 min · ~3¢/GB (lab makes money; you stay under egress-class rates).",
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
    tier: "usage",
    message:
      "Usage pricing — first 1 GB free, then from $2 min · ~3¢/GB (2¢/GB after 50 GB over free). Built to make money and still undercut egress-class rates at volume.",
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
      rates,
    },
  };
}

export const PRICING_EXAMPLES = [
  { gb: 0.5, label: "500 MB", approx: "$0 (free)" },
  { gb: 1, label: "1 GB", approx: "$0 (free cap)" },
  { gb: 9, label: "9 GB", approx: "$2.00 (min paid)" },
  { gb: 50, label: "50 GB", approx: "$2.00 (min / light usage)" },
  { gb: 100, label: "100 GB", approx: "~$2.50 usage" },
  { gb: 200, label: "200 GB", approx: "~$4.50 usage" },
];
