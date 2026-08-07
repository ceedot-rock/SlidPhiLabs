/**
 * PPP checkout — POST /api/ppp-checkout
 * Freemium: $0 under 1 GB free cap (no Stripe). Paid usage → Checkout Session.
 */
import { computeQuote } from "./suite-pricing.js";

const PPP_PAYMENT_LINK =
  process.env.PPP_PAYMENT_LINK ||
  "https://buy.stripe.com/aFa00k4B70OYetL0O46wE0g";

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

  // Free showcase — no Stripe
  if (quote.free || quote.amount_cents === 0) {
    const token =
      "free_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 10);
    return json(res, 200, {
      ok: true,
      mode: "free_showcase",
      free: true,
      token,
      quote,
      access_url:
        origin +
        "/access?product=suite-free&free=1&token=" +
        encodeURIComponent(token),
      next: "Free under 1 GB cap — submit the job from /pps (no payment). Upgrade is automatic when size exceeds free.",
      instructions:
        "This quote is $0 (free showcase). Submit your project on the suite page without Stripe.",
    });
  }

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
        free: false,
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
    free: false,
    url: link.toString(),
    quote,
    instructions:
      "On Stripe, set the amount to $" +
      quote.amount_display +
      " (your live quote). Then return here to submit the project.",
  });
}

