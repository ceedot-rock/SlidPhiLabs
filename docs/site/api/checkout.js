/**
 * POST /api/checkout
 * Universal checkout for any standing SKU or custom amount.
 *
 * Body:
 *   { sku, email?, rail?, note?, amount_cents?, name? }
 *
 * rail: stripe (default) | link | crypto | x402 | invoice
 */
import {
  resolveSku,
  PRODUCT_CATALOG,
  createStripeCheckoutSession,
  manualCryptoInstructions,
  siteOrigin,
  contactEmail,
} from "./lib/payments-rails.js";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const origin = siteOrigin(req);

  if (req.method === "GET") {
    return json(res, 200, {
      service: "Slid Phi Labs checkout",
      post: {
        url: `${origin}/api/checkout`,
        body: { sku: "zrw-n00b", email: "you@example.com", rail: "stripe" },
        rails: ["stripe", "link", "crypto", "x402", "invoice"],
      },
      matrix: `${origin}/api/payments`,
      methods_on_stripe: [
        "card",
        "link",
        "cashapp",
        "amazon_pay",
        "us_bank_account",
        "klarna",
        "affirm",
        "afterpay_clearpay",
        "apple_pay_google_pay_via_card",
      ],
    });
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

  const sku = resolveSku(body.sku || body.product);
  const rail = String(body.rail || body.method || "stripe").toLowerCase();
  const email = String(body.email || "").trim().slice(0, 120);
  const customCents =
    body.amount_cents != null
      ? Number(body.amount_cents)
      : body.amount_usd != null
        ? Math.round(Number(body.amount_usd) * 100)
        : null;

  if (sku === "suite") {
    return json(res, 200, {
      ok: true,
      mode: "suite",
      message: "Metered suite — use /pps or ppp-checkout",
      ui: `${origin}/pps`,
      checkout: `POST ${origin}/api/ppp-checkout`,
    });
  }

  let amount_cents;
  let name;
  let payment_link = null;
  let kind = "custom";

  if (sku && PRODUCT_CATALOG[sku]) {
    const p = PRODUCT_CATALOG[sku];
    amount_cents = p.amount_cents;
    name = p.name;
    payment_link = p.stripe;
    kind = p.kind;
  } else if (customCents && customCents >= 50) {
    amount_cents = Math.round(customCents);
    name = String(body.name || "Slid Phi Labs payment").slice(0, 200);
  } else {
    return json(res, 400, {
      error: "sku_or_amount_required",
      hint: 'Body: { "sku": "cddg-split" } or { "amount_cents": 5000, "name": "Custom" }',
      skus: Object.keys(PRODUCT_CATALOG),
      matrix: `${origin}/api/payments`,
    });
  }

  if (rail === "link" || rail === "payment_link") {
    if (!payment_link) {
      return json(res, 400, {
        error: "no_static_link",
        try: "stripe or crypto",
      });
    }
    return json(res, 200, {
      ok: true,
      mode: "payment_link",
      url: payment_link,
      sku,
      amount_cents,
    });
  }

  if (rail === "crypto" || rail === "manual" || rail === "onchain") {
    return json(res, 200, {
      ok: true,
      mode: "crypto_manual",
      sku: sku || "custom",
      amount_cents,
      ...manualCryptoInstructions({
        sku: sku || "custom",
        amount_cents,
        origin,
      }),
    });
  }

  if (rail === "x402" || rail === "agent") {
    if (!sku) {
      return json(res, 400, { error: "x402_requires_sku" });
    }
    return json(res, 200, {
      ok: true,
      mode: "x402",
      next: {
        method: "POST",
        url: `${origin}/api/x402-products`,
        body: { sku, email: email || undefined },
      },
      note: "POST buy without payment → 402 accepts[] (Solana + Base USDC). Pay exact, retry with X-PAYMENT.",
    });
  }

  if (rail === "invoice" || rail === "wire" || rail === "ach_offline") {
    return json(res, 200, {
      ok: true,
      mode: "invoice",
      email: contactEmail(),
      subject: `Invoice request · ${name} · $${(amount_cents / 100).toFixed(2)}`,
      amount_usd: (amount_cents / 100).toFixed(2),
      amount_cents,
      sku: sku || "custom",
      kind,
      body_template: `Please invoice:\nSKU: ${sku || "custom"}\nAmount: $${(amount_cents / 100).toFixed(2)} USD\nCompany:\nBilling email: ${email || ""}\nAddress:\nPreferred rail: ACH / wire / Stripe invoice\n`,
    });
  }

  // default: stripe multi-method session
  try {
    const session = await createStripeCheckoutSession({
      amountCents: amount_cents,
      name: `Slid Phi Labs — ${name}`,
      description: `${kind} · multi-rail checkout (cards, wallets, bank, BNPL)`,
      sku: sku || "custom",
      email,
      origin,
      metadata: {
        kind,
        note: String(body.note || "").slice(0, 200),
      },
      successPath: "/access",
      cancelPath: "/pay?cancel=1",
    });
    return json(res, 200, {
      ok: true,
      mode: "stripe_checkout",
      url: session.url,
      session_id: session.id,
      payment_method_types: session.payment_method_types,
      amount_cents,
      amount_usd: (amount_cents / 100).toFixed(2),
      sku: sku || "custom",
      name,
      payment_link_fallback: payment_link,
      also: {
        crypto: `POST ${origin}/api/checkout { "sku": "${sku || "custom"}", "rail": "crypto" }`,
        x402: sku ? `POST ${origin}/api/x402-products { "sku": "${sku}" }` : null,
        invoice: `POST ${origin}/api/checkout { "sku": "${sku || "custom"}", "rail": "invoice" }`,
      },
    });
  } catch (e) {
    if (payment_link) {
      return json(res, 200, {
        ok: true,
        mode: "payment_link_fallback",
        url: payment_link,
        warning: String(e.message || e),
        sku,
        amount_cents,
      });
    }
    return json(res, 502, {
      error: String(e.message || e),
      code: e.code || "checkout_failed",
    });
  }
}
