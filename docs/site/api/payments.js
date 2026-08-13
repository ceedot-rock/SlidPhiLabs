/**
 * GET  /api/payments           → full multi-rail matrix
 * GET  /api/payments?sku=…     → one product + all rails for that amount
 * POST /api/payments           → same as checkout (compat)
 */
import {
  buildPaymentsMatrix,
  resolveSku,
  PRODUCT_CATALOG,
  createStripeCheckoutSession,
  manualCryptoInstructions,
  siteOrigin,
  solanaPayTo,
  evmPayTo,
  contactEmail,
} from "./lib/payments-rails.js";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-PAYMENT, Authorization"
  );
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=30");
  res.end(JSON.stringify(body, null, 0));
}

function productPayload(sku, origin) {
  const p = PRODUCT_CATALOG[sku];
  if (!p) return null;
  const sol = solanaPayTo();
  const evm = evmPayTo();
  return {
    sku,
    name: p.name,
    amount_cents: p.amount_cents,
    amount_usd: (p.amount_cents / 100).toFixed(2),
    kind: p.kind,
    rails: {
      stripe_payment_link: p.stripe,
      stripe_checkout: {
        method: "POST",
        url: `${origin}/api/checkout`,
        body: { sku, rail: "stripe" },
      },
      x402: {
        method: "POST",
        url: `${origin}/api/x402-products`,
        body: { sku },
        solana_configured: !!sol,
        base_configured: !!evm,
      },
      crypto_manual: manualCryptoInstructions({
        sku,
        amount_cents: p.amount_cents,
        origin,
      }),
      invoice: {
        email: contactEmail(),
        subject: `Invoice · ${p.name} · $${(p.amount_cents / 100).toFixed(2)}`,
      },
    },
    access: `${origin}/access?product=${encodeURIComponent(sku)}`,
  };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const origin = siteOrigin(req);

  if (req.method === "GET") {
    const q = req.query || {};
    const skuRaw = q.sku || q.product;
    if (skuRaw) {
      const sku = resolveSku(skuRaw);
      if (!sku || sku === "suite") {
        if (sku === "suite") {
          return json(res, 200, {
            sku: "suite",
            name: "SPL Pay Per Suite",
            note: "Metered freemium — quote then checkout",
            quote: `POST ${origin}/api/ppp-quote`,
            checkout: `POST ${origin}/api/ppp-checkout`,
            agent: `POST ${origin}/api/x402-suite`,
            ui: `${origin}/pps`,
          });
        }
        return json(res, 404, { error: "unknown_sku", sku: skuRaw });
      }
      return json(res, 200, productPayload(sku, origin));
    }
    return json(res, 200, buildPaymentsMatrix(req));
  }

  if (req.method === "POST") {
    // Compat: forward shape of /api/checkout
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
    const customCents = body.amount_cents != null ? Number(body.amount_cents) : null;

    if (sku === "suite") {
      return json(res, 200, {
        ok: true,
        redirect: `${origin}/pps`,
        quote: `POST ${origin}/api/ppp-checkout`,
        message: "Use suite quote/checkout for metered jobs",
      });
    }

    let amount_cents;
    let name;
    let payment_link = null;
    if (sku && PRODUCT_CATALOG[sku]) {
      amount_cents = PRODUCT_CATALOG[sku].amount_cents;
      name = PRODUCT_CATALOG[sku].name;
      payment_link = PRODUCT_CATALOG[sku].stripe;
    } else if (customCents && customCents >= 50) {
      amount_cents = Math.round(customCents);
      name = String(body.name || "Slid Phi Labs payment").slice(0, 200);
    } else {
      return json(res, 400, {
        error: "sku_or_amount_required",
        hint: 'POST { "sku": "zrw-n00b" } or { "amount_cents": 5000, "name": "…" }',
        catalog: `${origin}/api/payments`,
      });
    }

    if (rail === "link" || rail === "payment_link") {
      if (!payment_link) {
        return json(res, 400, { error: "no_payment_link", use: "stripe or crypto" });
      }
      return json(res, 200, { ok: true, mode: "payment_link", url: payment_link, sku });
    }

    if (rail === "crypto" || rail === "manual" || rail === "onchain") {
      return json(res, 200, {
        ok: true,
        mode: "crypto_manual",
        ...manualCryptoInstructions({ sku: sku || "custom", amount_cents, origin }),
      });
    }

    if (rail === "x402" || rail === "agent") {
      return json(res, 200, {
        ok: true,
        mode: "x402",
        buy: `POST ${origin}/api/x402-products`,
        body: { sku: sku || undefined, email },
        catalog: `${origin}/api/x402-products`,
      });
    }

    if (rail === "invoice" || rail === "wire") {
      return json(res, 200, {
        ok: true,
        mode: "invoice",
        email: contactEmail(),
        subject: `Invoice · ${name} · $${(amount_cents / 100).toFixed(2)}`,
        amount_usd: (amount_cents / 100).toFixed(2),
        sku: sku || "custom",
      });
    }

    try {
      const session = await createStripeCheckoutSession({
        amountCents: amount_cents,
        name,
        description: `Slid Phi Labs · ${sku || "custom"} · multi-method checkout`,
        sku: sku || "custom",
        email,
        origin,
        metadata: {
          rail: "stripe",
          note: String(body.note || "").slice(0, 200),
        },
      });
      return json(res, 200, {
        ok: true,
        mode: "stripe_checkout",
        url: session.url,
        session_id: session.id,
        payment_method_types: session.payment_method_types,
        amount_cents,
        sku: sku || "custom",
        payment_link_fallback: payment_link,
      });
    } catch (e) {
      if (payment_link) {
        return json(res, 200, {
          ok: true,
          mode: "payment_link_fallback",
          url: payment_link,
          warning: e.message,
          sku,
        });
      }
      return json(res, 502, { error: e.message, code: e.code || "checkout_failed" });
    }
  }

  return json(res, 405, { error: "Method not allowed" });
}
