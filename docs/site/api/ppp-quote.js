/**
 * PPP quote — POST /api/ppp-quote
 * Validates client quote inputs and returns a canonical price (USD cents).
 * No proprietary process details — size, data class, service, and product only.
 */
function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

/** Product / service value (base USD cents) — small; bulk is size fee. */
const PRODUCT_BASE = {
  auto: 99, // $0.99
  zrw: 99,
  "cddg-split": 299, // process path still a bit higher
  blackjack: 149,
  "shard-zip": 149,
  "shard-tsdb": 149,
  "slid-phi": 149,
};

/** Data-class multipliers (near 1 — shape shouldn't explode multi‑GB bills). */
const DATA_MULT = {
  zeros: 0.9,
  ramp: 0.95,
  walk: 1.0,
  mixed_ints: 1.05,
  timeseries: 1.05,
  json_series: 1.0,
  binary: 1.1,
  unknown: 1.0,
};

const OP_MULT = {
  compress: 1.0,
  decompress: 0.75,
  roundtrip: 1.2,
};

const MIN_CENTS = 50; // $0.50 floor
const MAX_CENTS = 1000000; // $10,000 Stripe custom-amount cap
const MAX_BYTES = 100 * 1024 * 1024 * 1024; // 100 GB

/**
 * Size fee: bulk compression is cheap. Multi‑GB should feel near‑free after a small base.
 * Model (USD cents):
 *   first 50 MB free (covered by product base)
 *   then ~$0.12 / GB through 10 GB
 *   then ~$0.04 / GB through 100 GB
 *   then ~$0.015 / GB after
 * Examples (size component only, before product base / mults):
 *   100 MB ≈ $0.01 · 1 GB ≈ $0.11 · 9 GB ≈ $1.07 · 50 GB ≈ $2.67
 */
function sizeFeeCents(bytes) {
  const b = Math.max(0, Number(bytes) || 0);
  const free = 50 * 1024 * 1024; // 50 MB
  const billable = Math.max(0, b - free);
  if (billable <= 0) return 0;
  const gb = billable / (1024 * 1024 * 1024);
  if (gb <= 10) return Math.round(gb * 12); // $0.12/GB
  if (gb <= 100) return Math.round(10 * 12 + (gb - 10) * 4); // $0.04/GB
  return Math.round(10 * 12 + 90 * 4 + (gb - 100) * 1.5); // $0.015/GB
}


export function computeQuote({
  product = "auto",
  dataClass = "unknown",
  op = "compress",
  bytes = 0,
} = {}) {
  const prod = PRODUCT_BASE[product] != null ? product : "auto";
  const cls = DATA_MULT[dataClass] != null ? dataClass : "unknown";
  const operation = OP_MULT[op] != null ? op : "compress";
  const b = Math.max(0, Math.min(Number(bytes) || 0, MAX_BYTES));

  const base = PRODUCT_BASE[prod];
  const size = sizeFeeCents(b);
  const raw = Math.round((base + size) * DATA_MULT[cls] * OP_MULT[operation]);
  const cents = Math.min(MAX_CENTS, Math.max(MIN_CENTS, raw));

  return {
    ok: true,
    service: "SPL Pay Per Suite",
    currency: "usd",
    amount_cents: cents,
    amount_display: (cents / 100).toFixed(2),
    breakdown: {
      product: prod,
      product_base_cents: base,
      size_cents: size,
      data_class: cls,
      data_multiplier: DATA_MULT[cls],
      op: operation,
      op_multiplier: OP_MULT[operation],
      bytes: b,
      mb: +(b / (1024 * 1024)).toFixed(4),
      gb: +(b / (1024 * 1024 * 1024)).toFixed(6),
      min_cents: MIN_CENTS,
      max_cents: MAX_CENTS,
    },
  };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return json(res, 400, { error: "Invalid JSON" });
    }
  }
  body = body || {};

  const quote = computeQuote({
    product: String(body.product || "auto"),
    dataClass: String(body.dataClass || body.data_class || "unknown"),
    op: String(body.op || "compress"),
    bytes: body.bytes,
  });

  return json(res, 200, quote);
}
