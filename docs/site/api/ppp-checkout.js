/**
 * PPP checkout — POST /api/ppp-checkout
 * Prefer Stripe Checkout Session with exact quoted amount when STRIPE_SECRET_KEY is set.
 * Otherwise returns the PPP Payment Link (customer enters the quoted amount).
 */
const PPP_PAYMENT_LINK =
  process.env.PPP_PAYMENT_LINK ||
  "https://buy.stripe.com/aFa00k4B70OYetL0O46wE0g";

const PRODUCT_BASE = {
  auto: 2900,
  zrw: 2900,
  "cddg-split": 4900,
  blackjack: 3900,
  "shard-zip": 3900,
  "shard-tsdb": 3900,
  "slid-phi": 3900,
};
const DATA_MULT = {
  zeros: 0.85,
  ramp: 0.95,
  walk: 1.05,
  mixed_ints: 1.15,
  timeseries: 1.2,
  json_series: 1.1,
  binary: 1.25,
  unknown: 1.15,
};
const OP_MULT = { compress: 1.0, decompress: 0.85, roundtrip: 1.35 };
const MIN_CENTS = 900;
const MAX_CENTS = 1000000;

function sizeFeeCents(bytes) {
  const mb = Math.max(0, Number(bytes) || 0) / (1024 * 1024);
  if (mb <= 0) return 0;
  if (mb <= 1) return Math.round(mb * 800);
  if (mb <= 10) return 800 + Math.round((mb - 1) * 450);
  if (mb <= 100) return 800 + 9 * 450 + Math.round((mb - 10) * 220);
  return 800 + 9 * 450 + 90 * 220 + Math.round((mb - 100) * 90);
}

function computeQuote({ product = "auto", dataClass = "unknown", op = "compress", bytes = 0 } = {}) {
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
  };
}

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

function siteOrigin(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "slidphilabs.com";
  return `${proto}://${host}`;
}

async function createCheckoutSession({ amountCents, quote, email, origin }) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", `${origin}/access?paid=1&product=auto&session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${origin}/pps?cancel=1`);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", "usd");
  params.set("line_items[0][price_data][unit_amount]", String(amountCents));
  params.set(
    "line_items[0][price_data][product_data][name]",
    `SPL Pay Per Suite — ${quote.breakdown.op} · ${quote.breakdown.product}`
  );
  params.set(
    "line_items[0][price_data][product_data][description]",
    `${quote.breakdown.mb} MB · ${quote.breakdown.data_class} · SPL Pay Per Suite`
  );
  params.set("metadata[sku]", "ppp");
  params.set("metadata[product]", quote.breakdown.product);
  params.set("metadata[op]", quote.breakdown.op);
  params.set("metadata[data_class]", quote.breakdown.data_class);
  params.set("metadata[bytes]", String(quote.breakdown.bytes));
  if (email) params.set("customer_email", email);
  params.set("submit_type", "pay");

  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data?.error?.message || `Stripe ${r.status}`);
  }
  return data;
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

  const email = String(body.email || "").trim().slice(0, 120);
  const origin = siteOrigin(req);

  try {
    const session = await createCheckoutSession({
      amountCents: quote.amount_cents,
      quote,
      email,
      origin,
    });
    if (session?.url) {
      return json(res, 200, {
        ok: true,
        mode: "checkout_session",
        url: session.url,
        session_id: session.id,
        quote,
      });
    }
  } catch (e) {
    console.error("ppp-checkout session failed:", e.message || e);
  }

  const link = new URL(PPP_PAYMENT_LINK);
  if (email) link.searchParams.set("prefilled_email", email);

  return json(res, 200, {
    ok: true,
    mode: "payment_link",
    url: link.toString(),
    quote,
    instructions:
      "On Stripe, set the amount to $" +
      quote.amount_display +
      " (your live quote). Then return here to submit the project.",
  });
}

