/**
 * Hosted compression meter.
 * First 2 GB each month are free. After that, 8¢ per GB of input.
 * $1 minimum when a card charge is due (Stripe's fee eats smaller ones).
 *
 * Why 8¢: Fly NA egress is $0.02/GB. A compress job can send about that
 * much back out, plus CPU on the machine (~$3.20/mo for the 512 MB box).
 * 8¢ is 4× the bandwidth floor so free-tier users and Stripe fees get covered.
 */
export const FREE_GB = 2;
export const FREE_BYTES = 2 * 1024 * 1024 * 1024;
export const CENTS_PER_GB = 8;
export const MIN_PAID_CENTS = 100;
export const MAX_BYTES = 1024 * 1024 * 1024 * 1024;
export const MAX_CENTS = 1_000_000;

/** Extra included GB on a paid AWARE / Lab Pass plan (still 8¢ after that). */
export const INCLUDED_GB = Object.freeze({
  "": FREE_GB,
  env: FREE_GB,
  "gc-day": 10,
  "gc-month": 200,
  "gc-year": 2000,
  "lab-pass": 2000,
  "lab-pass-year": 2000,
});

export function includedBytesForSku(sku) {
  const k = String(sku || "").toLowerCase();
  const gb = INCLUDED_GB[k] != null ? INCLUDED_GB[k] : FREE_GB;
  return Math.round(gb * 1024 * 1024 * 1024);
}

export function usageFeeCents(billableBytes) {
  const b = Math.max(0, Number(billableBytes) || 0);
  if (b <= 0) return 0;
  const gb = b / (1024 * 1024 * 1024);
  return Math.round(gb * CENTS_PER_GB);
}

export function computeQuote({
  product = "auto",
  dataClass = "unknown",
  op = "compress",
  bytes = 0,
  used_bytes = 0,
  sku = "",
} = {}) {
  const b = Math.max(0, Math.min(Number(bytes) || 0, MAX_BYTES));
  const used = Math.max(0, Number(used_bytes) || 0);
  const included = includedBytesForSku(sku);
  const free_left = Math.max(0, included - used);
  const billable = Math.max(0, b - free_left);
  const free = billable <= 0;
  const rates = {
    free_cap_gb: FREE_GB,
    included_gb: included / (1024 * 1024 * 1024),
    usd_per_gb: CENTS_PER_GB / 100,
    min_paid_usd: MIN_PAID_CENTS / 100,
    window: "calendar_month",
  };
  const plain_free = `First ${FREE_GB} GB each month are free. After that, ${CENTS_PER_GB}¢ per GB. Card charges start at $1.`;
  if (free) {
    return {
      ok: true,
      service: "AWARE meter",
      plain: plain_free,
      currency: "usd",
      amount_cents: 0,
      amount_display: "0.00",
      free: true,
      tier: "free",
      message: plain_free,
      breakdown: {
        product,
        op,
        data_class: dataClass,
        bytes: b,
        used_bytes: used,
        free_left,
        billable_bytes: 0,
        usage_cents: 0,
        rates,
        sku: sku || null,
      },
    };
  }
  const usage = usageFeeCents(billable);
  const cents = Math.min(MAX_CENTS, Math.max(MIN_PAID_CENTS, usage));
  return {
    ok: true,
    service: "AWARE meter",
    plain: `${plain_free} This job: $${(cents / 100).toFixed(2)}.`,
    currency: "usd",
    amount_cents: cents,
    amount_display: (cents / 100).toFixed(2),
    free: false,
    tier: "usage",
    message: `Over the free ${FREE_GB} GB — ${CENTS_PER_GB}¢/GB, $1 minimum on card.`,
    breakdown: {
      product,
      op,
      data_class: dataClass,
      bytes: b,
      used_bytes: used,
      free_left,
      billable_bytes: billable,
      usage_cents: usage,
      rates,
      sku: sku || null,
    },
  };
}

export const PRICING_EXAMPLES = [
  { gb: 1, label: "1 GB", approx: "$0 (under 2 GB free)" },
  { gb: 2, label: "2 GB", approx: "$0 (free cap)" },
  { gb: 3, label: "3 GB", approx: "$1 minimum (1 GB over at 8¢ would be $0.08; card floor is $1)" },
  { gb: 20, label: "20 GB", approx: "$1.44 (18 GB × 8¢)" },
];
