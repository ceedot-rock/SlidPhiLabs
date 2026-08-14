/**
 * Universal payment rails for Slid Phi Labs.
 * Humans → Stripe (cards, wallets, bank, BNPL, …) + static Payment Links.
 * Agents → x402 (Solana USDC + Base USDC).
 * Anyone → manual crypto addresses + wire/invoice email.
 *
 * Env (optional overrides):
 *   STRIPE_SECRET_KEY | STRIPE_RESTRICTED_KEY
 *   X402_PAY_TO              Solana base58 receive
 *   X402_PAY_TO_BASE|X402_PAY_TO_EVM  0x receive (Base/EVM USDC)
 *   PAY_EVM_ADDRESS          public display (defaults to Base payTo)
 *   PAY_SOLANA_ADDRESS       public display (defaults to X402_PAY_TO)
 *   PAY_BTC_ADDRESS, PAY_PAYPAL, PAY_WIRE_INSTRUCTIONS
 *   PAYMENTS_CONTACT         default corey@slidphilabs.com
 */

export const USDC_SOLANA_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const USDC_BASE_MAINNET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const BASE_NETWORK = "eip155:8453";

/** Stripe Checkout payment_method_types that this account can enable (US). */
export const STRIPE_CHECKOUT_METHODS = [
  "card",
  "link",
  "cashapp",
  "amazon_pay",
  "us_bank_account",
  "klarna",
  "affirm",
  "afterpay_clearpay",
];

/** Human-readable labels for discovery UIs */
export const STRIPE_METHOD_LABELS = {
  card: "Cards (Visa, Mastercard, Amex, Discover, …) + Apple Pay / Google Pay when available",
  link: "Link (Stripe)",
  cashapp: "Cash App Pay",
  amazon_pay: "Amazon Pay",
  us_bank_account: "US bank ACH (debit)",
  klarna: "Klarna",
  affirm: "Affirm",
  afterpay_clearpay: "Afterpay / Clearpay",
};

/** Standing SKUs — keep in sync with x402-products.js CATALOG */
export const PRODUCT_CATALOG = {
  "chamber-day": {
    name: "Chamber · Day",
    amount_cents: 1250,
    stripe: "https://buy.stripe.com/14A4gAebHcxG0CV9kA6wE0x",
    kind: "chamber",
  },
  "chamber-month": {
    name: "Chamber · Month",
    amount_cents: 8750,
    stripe: "https://buy.stripe.com/3cI5kEffL0OY4TbfIY6wE0y",
    kind: "chamber",
  },
  "chamber-year": {
    name: "Chamber · Year",
    amount_cents: 95000,
    stripe: "https://buy.stripe.com/7sYfZid7D55edpHcwM6wE0z",
    kind: "chamber",
  },
  "tru8-day": {
    name: "TRU8 · Day",
    amount_cents: 2499,
    stripe: "https://buy.stripe.com/4gM3cw0kR9lu4Tb54k6wE0A",
    kind: "tru8",
  },
  "tru8-month": {
    name: "TRU8 · Month",
    amount_cents: 17500,
    stripe: "https://buy.stripe.com/8x23cw9Vr0OY85n54k6wE0B",
    kind: "tru8",
  },
  "tru8-year": {
    name: "TRU8 · Year (both products)",
    amount_cents: 190000,
    stripe: "https://buy.stripe.com/dRmaEYgjPbtCclDaoE6wE0C",
    kind: "both",
  },
  "cddg-split": {
    name: "CDDG:Split",
    amount_cents: 19900,
    stripe: "https://buy.stripe.com/14A4gA4B79lu71jdAQ6wE0f",
    kind: "license",
  },
  "zrw-n00b": {
    name: "ZRW N00b",
    amount_cents: 7900,
    stripe: "https://buy.stripe.com/28EfZic3z69i3P72Wc6wE0b",
    kind: "license",
  },
  "zrw-pro": {
    name: "ZRW Pro",
    amount_cents: 24900,
    stripe: "https://buy.stripe.com/cNidRaebHbtC71j8gw6wE0c",
    kind: "license",
  },
  "zrw-l33t": {
    name: "ZRW L33t$aUC3",
    amount_cents: 69900,
    stripe: "https://buy.stripe.com/14AeVe9Vr8hqadvbsI6wE0d",
    kind: "license",
  },
  blackjack: {
    name: "Blackjack",
    amount_cents: 19900,
    stripe: "https://buy.stripe.com/00w00k6Jf8hqgBTaoE6wE0h",
    kind: "support-oss",
    oss_npm: "blackjack-compression",
    blurb:
      "$199 = commercial support / integration / indemnification for the already-public library. You do not receive a secret extra engine.",
  },
  "shard-zip": {
    name: "shard-zip",
    amount_cents: 19900,
    stripe: "https://buy.stripe.com/3cI7sMd7D8hq1GZaoE6wE0i",
    kind: "support-oss",
    oss_npm: "shard-zip",
    blurb:
      "$199 = commercial support / integration / indemnification for the already-public library. You do not receive a secret extra engine.",
  },
  "shard-tsdb": {
    name: "shard-tsdb",
    amount_cents: 19900,
    stripe: "https://buy.stripe.com/9B628sd7DeFO99r9kA6wE0j",
    kind: "support-oss",
    oss_npm: "shard-tsdb",
    blurb:
      "$199 = commercial support / integration / indemnification for the already-public library. You do not receive a secret extra engine.",
  },
  "slid-phi": {
    name: "slid-phi",
    amount_cents: 19900,
    stripe: "https://buy.stripe.com/dRm6oI6JfgNWetL8gw6wE0k",
    kind: "stub",
    blurb: "Public npm stub / quote rail — not a private engine dump.",
  },
  "support-integration": {
    name: "Support + Integration",
    amount_cents: 19900,
    stripe: "https://buy.stripe.com/8x28wQebH41a85n2Wc6wE0l",
    kind: "service",
  },
  consulting: {
    name: "Consulting",
    amount_cents: 25000,
    stripe: "https://buy.stripe.com/eVqfZi0kR41a4TbgN26wE02",
    kind: "service",
  },
  sponsor: {
    name: "Sponsor",
    amount_cents: 2900,
    stripe: "https://buy.stripe.com/cNi6oI8RnbtCgBTgN26wE01",
    kind: "support",
  },
  donate: {
    name: "Donate",
    amount_cents: 2999,
    stripe: "https://buy.stripe.com/eVq9AUd7D0OY0CVdAQ6wE0a",
    kind: "support",
  },
  "gao-entry": {
    name: "Great Agentic Olympiad Entry",
    amount_cents: 100,
    stripe: "https://buy.stripe.com/8x24gAd7D7dm2L31S86wE0m",
    kind: "olympiad",
  },
};

export const SKU_ALIASES = {
  residual: "cddg-split",
  "residual-governance": "cddg-split",
  twin: "cddg-split",
  cddg: "cddg-split",
  split: "cddg-split",
  zrw: "zrw-n00b",
  n00b: "zrw-n00b",
  noob: "zrw-n00b",
  pro: "zrw-pro",
  l33t: "zrw-l33t",
  support: "support-integration",
  integration: "support-integration",
  donation: "donate",
  gao: "gao-entry",
  olympiad: "gao-entry",
  ppp: "suite",
  suite: "suite",
  "pay-per-suite": "suite",
  chamber: "chamber-year",
  "chamber-only": "chamber-year",
  tru8: "tru8-year",
  both: "tru8-year",
  truchamber: "tru8-year",
  "truchamber-day": "tru8-day",
  "truchamber-month": "tru8-month",
  "truchamber-year": "tru8-year",
  "tru8-commercial": "tru8-year",
};

export function resolveSku(raw) {
  const k = String(raw || "")
    .trim()
    .toLowerCase();
  if (!k) return null;
  if (k === "suite" || k === "ppp" || k === "pay-per-suite" || k === "auto") return "suite";
  if (PRODUCT_CATALOG[k]) return k;
  if (SKU_ALIASES[k]) return SKU_ALIASES[k];
  return null;
}

export function stripeSecret() {
  return (
    process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_RESTRICTED_KEY ||
    ""
  );
}

export function contactEmail() {
  return process.env.PAYMENTS_CONTACT || "corey@slidphilabs.com";
}

export function solanaPayTo() {
  return (
    process.env.X402_PAY_TO ||
    process.env.PAY_SOLANA_ADDRESS ||
    process.env.BLOKZ_SOLANA_ADDRESS ||
    ""
  ).trim();
}

export function evmPayTo() {
  return (
    process.env.X402_PAY_TO_BASE ||
    process.env.X402_PAY_TO_EVM ||
    process.env.X402_EVM_PAY_TO ||
    process.env.PAY_EVM_ADDRESS ||
    process.env.BLOKZ_WALLET_ADDRESS ||
    ""
  ).trim();
}

export function siteOrigin(req) {
  if (process.env.PUBLIC_SITE_ORIGIN) return process.env.PUBLIC_SITE_ORIGIN.replace(/\/$/, "");
  const proto = req?.headers?.["x-forwarded-proto"] || "https";
  const host =
    req?.headers?.["x-forwarded-host"] ||
    req?.headers?.host ||
    "www.slidphilabs.com";
  return `${proto}://${host}`;
}

/**
 * Build full payment matrix (discovery).
 */
export function buildPaymentsMatrix(req) {
  const origin = siteOrigin(req);
  const sol = solanaPayTo();
  const evm = evmPayTo();
  const btc = (process.env.PAY_BTC_ADDRESS || "").trim();
  const paypal = (process.env.PAY_PAYPAL || process.env.PAYPAL_ME || "").trim();
  const wire = (process.env.PAY_WIRE_INSTRUCTIONS || "").trim();
  const contact = contactEmail();
  const hasStripe = !!stripeSecret();

  const products = Object.entries(PRODUCT_CATALOG).map(([sku, p]) => {
    const row = {
      sku,
      name: p.name,
      amount_usd: (p.amount_cents / 100).toFixed(2),
      amount_cents: p.amount_cents,
      kind: p.kind,
      human_payment_link: p.stripe || null,
      checkout: `POST ${origin}/api/checkout { "sku": "${sku}" }`,
      agent_x402: `POST ${origin}/api/x402-products { "sku": "${sku}" }`,
    };
    if (p.blurb) row.blurb = p.blurb;
    if (p.oss_npm) row.oss_npm = p.oss_npm;
    return row;
  });

  const rails = [
    {
      id: "stripe_checkout",
      name: "Stripe Checkout (recommended · humans)",
      audience: ["humans", "agents_via_browser"],
      configured: hasStripe,
      methods: STRIPE_CHECKOUT_METHODS.map((id) => ({
        id,
        label: STRIPE_METHOD_LABELS[id] || id,
      })),
      note: "One session accepts cards, Link, Cash App, Amazon Pay, US bank ACH, Klarna, Affirm, Afterpay when Stripe enables them for the session.",
      how: {
        endpoint: `POST ${origin}/api/checkout`,
        body: { sku: "zrw-n00b", email: "you@example.com", rail: "stripe" },
        returns: "url → hosted Checkout",
      },
    },
    {
      id: "stripe_payment_link",
      name: "Stripe Payment Links (static)",
      audience: ["humans"],
      configured: true,
      note: "Per-SKU buy.stripe.com links already on catalog pages.",
      how: { use: "product.human_payment_link or GET /api/payments?sku=…" },
    },
    {
      id: "x402_solana_usdc",
      name: "x402 · Solana mainnet USDC",
      audience: ["agents"],
      configured: !!sol,
      network: "solana-mainnet-beta",
      asset: USDC_SOLANA_MAINNET,
      payTo: sol || null,
      header: "X-PAYMENT",
      how: {
        catalog: `GET ${origin}/api/x402-products`,
        buy: `POST ${origin}/api/x402-products { "sku": "…" } → 402 accepts[] → pay → retry with X-PAYMENT`,
      },
    },
    {
      id: "x402_base_usdc",
      name: "x402 · Base mainnet USDC",
      audience: ["agents"],
      configured: !!evm,
      network: BASE_NETWORK,
      asset: USDC_BASE_MAINNET,
      payTo: evm || null,
      header: "X-PAYMENT",
      how: {
        catalog: `GET ${origin}/api/x402-products`,
        buy: `POST ${origin}/api/x402-products { "sku": "…" }`,
      },
    },
    {
      id: "crypto_manual_solana",
      name: "Manual crypto · Solana (USDC or SOL)",
      audience: ["humans", "agents"],
      configured: !!sol,
      payTo: sol || null,
      asset_hint: "USDC (preferred) or SOL · mainnet",
      note: "Send exact USD-equivalent. Email receipt + tx signature to claim Access.",
      claim: `mailto:${contact}?subject=Payment%20claim`,
    },
    {
      id: "crypto_manual_evm",
      name: "Manual crypto · Base / EVM (USDC or ETH)",
      audience: ["humans", "agents"],
      configured: !!evm,
      payTo: evm || null,
      chains: ["base", "ethereum (USDC only if same address used)"],
      asset_hint: "USDC on Base preferred · same address receives ETH",
      note: "Send exact amount. Email tx hash + SKU to claim.",
      claim: `mailto:${contact}?subject=Payment%20claim`,
    },
    {
      id: "crypto_manual_btc",
      name: "Manual crypto · Bitcoin",
      audience: ["humans"],
      configured: !!btc,
      payTo: btc || null,
      note: btc
        ? "Send BTC equivalent; email txid + SKU."
        : "Set PAY_BTC_ADDRESS to enable.",
      claim: `mailto:${contact}?subject=BTC%20payment%20claim`,
    },
    {
      id: "paypal",
      name: "PayPal / PayPal.Me",
      audience: ["humans"],
      configured: !!paypal,
      url: paypal || null,
      note: paypal
        ? "Pay via PayPal then email receipt + SKU."
        : "Set PAY_PAYPAL or PAYPAL_ME to enable.",
    },
    {
      id: "wire_invoice_ach",
      name: "Wire / invoice / ACH offline",
      audience: ["humans", "enterprise"],
      configured: true,
      contact,
      instructions:
        wire ||
        `Email ${contact} with subject "Invoice request", SKU, company legal name, billing address, and preferred currency. We reply with ACH/wire or Stripe invoice. Net-15 default for approved accounts.`,
    },
    {
      id: "suite_metered",
      name: "SPL Pay Per Suite (metered freemium)",
      audience: ["humans", "agents"],
      configured: true,
      free_cap_gb: 100,
      after_free_usd_per_gb: 0.05,
      human: `POST ${origin}/api/ppp-checkout`,
      agent: `POST ${origin}/api/x402-suite`,
      ui: `${origin}/pps`,
    },
  ];

  const configured = rails.filter((r) => r.configured).map((r) => r.id);
  const missing = rails.filter((r) => !r.configured).map((r) => r.id);

  return {
    service: "Slid Phi Labs — Universal Payments",
    version: "1.0.0",
    policy: "Accept any workable rail. Entitlement after proof of payment (Stripe session verify works; x402 auto-claim is not wired — email proof or /access?product= + order id).",
    product_face: "TRU8",
    x402_access_autoclaim: false,
    contact,
    origin,
    access_after_pay: `${origin}/access`,
    endpoints: {
      matrix: `GET ${origin}/api/payments`,
      checkout: `POST ${origin}/api/checkout`,
      x402_products: `GET|POST ${origin}/api/x402-products`,
      x402_suite: `POST ${origin}/api/x402-suite`,
      ppp_quote: `POST ${origin}/api/ppp-quote`,
      ppp_checkout: `POST ${origin}/api/ppp-checkout`,
      agent: `GET ${origin}/api/agent`,
    },
    rails,
    configured_rails: configured,
    missing_or_optional: missing,
    products,
    preferred: {
      human: "stripe_checkout",
      agent: evm || sol ? (evm ? "x402_base_usdc" : "x402_solana_usdc") : "stripe_checkout",
      enterprise: "wire_invoice_ach",
    },
    note: "Payment Links and Checkout Sessions settle in USD on Stripe. Crypto rails settle on-chain; email proof for Access until auto-claim is wired.",
  };
}

/**
 * Create Stripe Checkout Session with broad payment_method_types.
 */
export async function createStripeCheckoutSession({
  amountCents,
  name,
  description,
  sku,
  email,
  origin,
  metadata = {},
  successPath = "/access",
  cancelPath = "/pay?cancel=1",
}) {
  const key = stripeSecret();
  if (!key) {
    const err = new Error("Stripe not configured (STRIPE_SECRET_KEY / STRIPE_RESTRICTED_KEY)");
    err.code = "stripe_unconfigured";
    throw err;
  }
  if (!amountCents || amountCents < 50) {
    const err = new Error("amount_cents must be ≥ 50 ($0.50)");
    err.code = "amount_too_small";
    throw err;
  }

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set(
    "success_url",
    `${origin}${successPath}?paid=1&product=${encodeURIComponent(sku || "custom")}&session_id={CHECKOUT_SESSION_ID}`
  );
  params.set("cancel_url", `${origin}${cancelPath}`);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", "usd");
  params.set("line_items[0][price_data][unit_amount]", String(Math.round(amountCents)));
  params.set("line_items[0][price_data][product_data][name]", String(name || "Slid Phi Labs").slice(0, 200));
  if (description) {
    params.set(
      "line_items[0][price_data][product_data][description]",
      String(description).slice(0, 500)
    );
  }
  STRIPE_CHECKOUT_METHODS.forEach((m, i) => {
    params.set(`payment_method_types[${i}]`, m);
  });
  params.set("metadata[sku]", String(sku || "custom").slice(0, 40));
  params.set("metadata[source]", "spl_universal_checkout");
  for (const [k, v] of Object.entries(metadata)) {
    if (v == null) continue;
    params.set(`metadata[${k}]`, String(v).slice(0, 500));
  }
  if (email) params.set("customer_email", String(email).slice(0, 120));
  params.set("submit_type", "pay");
  params.set("billing_address_collection", "auto");
  params.set("allow_promotion_codes", "true");

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
    // Fallback: card+link only if expanded methods rejected
    if (data?.error?.param?.includes("payment_method") || data?.error?.code) {
      const fallback = new URLSearchParams(params);
      // wipe payment_method_types and set minimal
      const keys = [...fallback.keys()].filter((k) => k.startsWith("payment_method_types"));
      keys.forEach((k) => fallback.delete(k));
      ["card", "link", "cashapp", "amazon_pay"].forEach((m, i) =>
        fallback.set(`payment_method_types[${i}]`, m)
      );
      const r2 = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: fallback.toString(),
      });
      const d2 = await r2.json().catch(() => ({}));
      if (!r2.ok) {
        const err = new Error(d2?.error?.message || data?.error?.message || `Stripe ${r.status}`);
        err.code = "stripe_error";
        err.detail = d2?.error || data?.error;
        throw err;
      }
      return d2;
    }
    const err = new Error(data?.error?.message || `Stripe ${r.status}`);
    err.code = "stripe_error";
    err.detail = data?.error;
    throw err;
  }
  return data;
}

export function manualCryptoInstructions({ sku, amount_cents, origin }) {
  const sol = solanaPayTo();
  const evm = evmPayTo();
  const btc = (process.env.PAY_BTC_ADDRESS || "").trim();
  const contact = contactEmail();
  const usd = ((amount_cents || 0) / 100).toFixed(2);
  return {
    amount_usd: usd,
    sku: sku || null,
    instructions: [
      sol && {
        rail: "solana",
        payTo: sol,
        amount_usd: usd,
        preferred_asset: "USDC",
        mint: USDC_SOLANA_MAINNET,
        memo: `SPL ${sku || "pay"} ${usd}`,
      },
      evm && {
        rail: "base_evm",
        payTo: evm,
        amount_usd: usd,
        preferred_asset: "USDC",
        contract: USDC_BASE_MAINNET,
        chain: "base",
        memo: `SPL ${sku || "pay"} ${usd}`,
      },
      btc && {
        rail: "bitcoin",
        payTo: btc,
        amount_usd: usd,
      },
    ].filter(Boolean),
    claim: {
      email: contact,
      subject: `Payment claim · ${sku || "custom"} · $${usd}`,
      body: `SKU: ${sku || "custom"}\nAmount USD: ${usd}\nTx signature/hash:\nChain:\nEmail used:\n`,
      access: `${origin}/access?product=${encodeURIComponent(sku || "custom")}`,
    },
  };
}
