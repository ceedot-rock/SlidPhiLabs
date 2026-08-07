/**
 * SPL Pay Per Suite — local quote engine (matches site /api/ppp-quote).
 * Price = product value base + size fee × data-class × operation.
 */

export const PRODUCT_BASE = {
  auto: 2900,
  zrw: 2900,
  "cddg-split": 4900,
  blackjack: 3900,
  "shard-zip": 3900,
  "shard-tsdb": 3900,
  "slid-phi": 3900,
};

export const DATA_MULT = {
  zeros: 0.85,
  ramp: 0.95,
  walk: 1.05,
  mixed_ints: 1.15,
  timeseries: 1.2,
  json_series: 1.1,
  binary: 1.25,
  unknown: 1.15,
};

export const OP_MULT = {
  compress: 1.0,
  decompress: 0.85,
  roundtrip: 1.35,
};

export const MIN_CENTS = 900;
export const MAX_CENTS = 1_000_000;

export const STRIPE_PAYMENT_LINK =
  process.env.SPL_PPS_PAYMENT_LINK ||
  "https://buy.stripe.com/aFa00k4B70OYetL0O46wE0g";

export const SITE_PPS = process.env.SPL_PPS_SITE || "https://www.slidphilabs.com/pps";
export const API_BASE = process.env.SPL_PPS_API || "https://www.slidphilabs.com";

function sizeFeeCents(bytes) {
  const mb = Math.max(0, Number(bytes) || 0) / (1024 * 1024);
  if (mb <= 0) return 0;
  if (mb <= 1) return Math.round(mb * 800);
  if (mb <= 10) return 800 + Math.round((mb - 1) * 450);
  if (mb <= 100) return 800 + 9 * 450 + Math.round((mb - 10) * 220);
  return 800 + 9 * 450 + 90 * 220 + Math.round((mb - 100) * 90);
}

/**
 * @param {{ product?: string, dataClass?: string, op?: string, bytes?: number }} opts
 */
export function computeQuote({
  product = "auto",
  dataClass = "unknown",
  op = "compress",
  bytes = 0,
} = {}) {
  const prod = PRODUCT_BASE[product] != null ? product : "auto";
  const cls = DATA_MULT[dataClass] != null ? dataClass : "unknown";
  const operation = OP_MULT[op] != null ? op : "compress";
  const b = Math.max(0, Math.min(Number(bytes) || 0, 5 * 1024 * 1024 * 1024));
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
      min_cents: MIN_CENTS,
      max_cents: MAX_CENTS,
    },
    pay_url: STRIPE_PAYMENT_LINK,
    suite_url: SITE_PPS,
  };
}

/**
 * Lightweight data-class heuristic from a Buffer / Uint8Array sample.
 * Does not run proprietary codecs.
 */
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

  // JSON-ish
  if (printRatio > 0.85 && (u8[0] === 0x7b || u8[0] === 0x5b)) {
    return { dataClass: "json_series", tool: "zrw", confidence: 0.7 };
  }

  // Look for int32-like ramp/zeros if length multiple of 4
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
