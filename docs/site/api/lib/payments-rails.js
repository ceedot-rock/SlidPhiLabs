/**
 * Universal payment rails for Slid Phi Labs.
 * Humans → Stripe Checkout (card, wallets, bank, BNPL when Stripe enables them) + invoice/wire.
 * Agents → x402 (Solana USDC + Base USDC).
 * Anyone → manual crypto addresses + invoice email.
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

/** Stripe Checkout methods. Apple/Google Pay ride on `card`. */
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

export const STRIPE_CHECKOUT_METHODS_FALLBACK = [
  "card",
  "link",
  "cashapp",
  "amazon_pay",
];

/** Human-readable labels for discovery UIs */
export const STRIPE_METHOD_LABELS = {
  card: "Card (Visa, Mastercard, Amex) · Apple Pay / Google Pay when available",
  link: "Link",
  cashapp: "Cash App Pay",
  amazon_pay: "Amazon Pay",
  us_bank_account: "US bank account (ACH)",
  klarna: "Klarna",
  affirm: "Affirm",
  afterpay_clearpay: "Afterpay",
};

/** Standing SKUs. x402-products.js imports this object — do not duplicate. */
const OSS_SUPPORT_BLURB =
  "$199 = commercial support for an already-public GPLv3 library. You do not receive the PCC engine or a secret extra engine.";

function retired(alias, name) {
  return {
    name,
    amount_cents: 0,
    stripe: `https://www.slidphilabs.com/pay?sku=${alias}`,
    kind: "retired",
    retired: true,
    alias,
    blurb: `Not sold. Checkout maps this name to ${alias}.`,
  };
}

export const PRODUCT_CATALOG = {
  "chamber-month": {
    name: "Chamber · monthly cloak license",
    amount_cents: 900,
    stripe: "https://www.slidphilabs.com/pay?sku=chamber-month",
    kind: "chamber",
    list: true,
    blurb: "License to seal new JSON for 30 days. Open already-sealed blobs with both keys.",
  },
  "chamber-year": {
    name: "Chamber · annual cloak license",
    amount_cents: 9900,
    stripe: "https://www.slidphilabs.com/pay?sku=chamber-year",
    kind: "chamber",
    list: true,
    blurb: "License to seal new JSON for 365 days. Ciphertext does not expire.",
  },
  "gc-day": {
    name: "PCC · 24-hour compressor seat",
    amount_cents: 900,
    stripe: "https://www.slidphilabs.com/pay?sku=gc-day",
    kind: "gc",
    list: true,
    blurb: "Hosted lossless compressor. 24 hours. Engine stays in the lab.",
  },
  "gc-month": {
    name: "PCC · monthly compressor seat",
    amount_cents: 4900,
    stripe: "https://www.slidphilabs.com/pay?sku=gc-month",
    kind: "gc",
    list: true,
    blurb: "Hosted lossless compressor. Calendar month.",
  },
  "gc-year": {
    name: "PCC · annual compressor seat",
    amount_cents: 49000,
    stripe: "https://www.slidphilabs.com/pay?sku=gc-year",
    kind: "gc",
    list: true,
    blurb: "Hosted lossless compressor. Calendar year. Gate / TRU8 / ZRW are names inside this stack, not extra SKUs.",
  },
  "rider-month": {
    name: "Agent-Rider · monthly team seat",
    amount_cents: 7900,
    stripe: "https://www.slidphilabs.com/pay?sku=rider-month",
    kind: "rider",
    list: true,
    blurb: "Signed agent identity L0–L4. Not in Lab Pass.",
  },
  "rider-year": {
    name: "Agent-Rider · annual team seat",
    amount_cents: 79000,
    stripe: "https://www.slidphilabs.com/pay?sku=rider-year",
    kind: "rider",
    list: true,
    blurb: "Signed agent identity L0–L4. Year. Not in Lab Pass.",
  },
  "rider-ops-month": {
    name: "Rider Ops · monthly fleet watch",
    amount_cents: 2900,
    stripe: "https://www.slidphilabs.com/pay?sku=rider-ops-month",
    kind: "rider-ops",
    list: true,
    blurb: "Heartbeat + alert when a signed Rider agent goes quiet. We turn it on after payment. Needs a Rider seat.",
  },
  "rider-ops-year": {
    name: "Rider Ops · annual fleet watch",
    amount_cents: 29000,
    stripe: "https://www.slidphilabs.com/pay?sku=rider-ops-year",
    kind: "rider-ops",
    list: true,
    blurb: "Year of fleet watch for a Rider team. Heartbeat + alert. Needs a Rider seat.",
  },
  "warrant-month": {
    name: "Warrant · monthly mandate seat",
    amount_cents: 2900,
    stripe: "https://www.slidphilabs.com/pay?sku=warrant-month",
    kind: "warrant",
    list: true,
    blurb: "Signed mandates and receipts bound to a Rider identity. Pair with a Rider token.",
  },
  "warrant-year": {
    name: "Warrant · annual mandate seat",
    amount_cents: 29000,
    stripe: "https://www.slidphilabs.com/pay?sku=warrant-year",
    kind: "warrant",
    list: true,
    blurb: "Year of mandates and receipts. Pair with Agent-Rider.",
  },
  "cuni-exception": {
    name: "CuNi · closed-app exception (one product, one year)",
    amount_cents: 49000,
    stripe: "https://www.slidphilabs.com/pay?sku=cuni-exception",
    kind: "exception",
    list: true,
    blurb: "Written exception for one closed product, one year. CuNi itself is free.",
  },
  "pulsar-exception": {
    name: "pulsar · closed-embed exception (one product, one year)",
    amount_cents: 49000,
    stripe: "https://www.slidphilabs.com/pay?sku=pulsar-exception",
    kind: "exception",
    list: true,
    blurb: "Written exception to embed pulsar in one closed-source product for one year. pulsar source stays GPLv3. Not Combined GC, not PCC, not LBR1. $199 OSS support is help, not this grant.",
  },
  "lab-pass": {
    name: "Lab Pass · annual (Chamber + PCC + TruGame)",
    amount_cents: 66800,
    stripe: "https://www.slidphilabs.com/pay?sku=lab-pass",
    kind: "seat",
    list: true,
    blurb: "Chamber year $99 + PCC year $490 + TruGame year $79. Not Rider.",
  },
  "trugame-month": {
    name: "TruGame · monthly engine seat",
    amount_cents: 1200,
    stripe: "https://www.slidphilabs.com/pay?sku=trugame-month",
    kind: "trugame",
    list: true,
    blurb: "Engine seat. Not a store. No rent desk.",
  },
  "trugame-year": {
    name: "TruGame · annual engine seat",
    amount_cents: 7900,
    stripe: "https://www.slidphilabs.com/pay?sku=trugame-year",
    kind: "trugame",
    list: true,
    blurb: "Engine seat for 365 days.",
  },
  consulting: {
    name: "Lab consulting (2 hours)",
    amount_cents: 25000,
    stripe: "https://www.slidphilabs.com/pay?sku=consulting",
    kind: "service",
    list: true,
    blurb: "Scoped lab time. Integration, benches, written exception, leftover math names.",
  },
  quikgater: {
    name: "Quikgater · pay-per-fact fetch",
    amount_cents: 0,
    stripe: "https://www.slidphilabs.com/quikgater",
    kind: "usage",
    list: true,
    sell: false,
    page: "https://www.slidphilabs.com/quikgater",
    x402: "https://quikgater-worker.ceedotrock.workers.dev/",
    blurb: "Not a seat. Agents pay x402 per fetch. Missing URL → 400. Unpaid URL → 402.",
  },
  "oss-support": {
    name: "OSS support (public libraries)",
    amount_cents: 19900,
    stripe: "https://www.slidphilabs.com/pay?sku=oss-support",
    kind: "support-oss",
    blurb: OSS_SUPPORT_BLURB,
  },
  blackjack: {
    name: "Blackjack support",
    amount_cents: 19900,
    stripe: "https://www.slidphilabs.com/pay?sku=oss-support",
    kind: "support-oss",
    oss_npm: "blackjack-compression",
    blurb: OSS_SUPPORT_BLURB,
  },
  "shard-zip": {
    name: "shard-zip support",
    amount_cents: 19900,
    stripe: "https://www.slidphilabs.com/pay?sku=oss-support",
    kind: "support-oss",
    oss_npm: "shard-zip",
    blurb: OSS_SUPPORT_BLURB,
  },
  "shard-tsdb": {
    name: "shard-tsdb support",
    amount_cents: 19900,
    stripe: "https://www.slidphilabs.com/pay?sku=oss-support",
    kind: "support-oss",
    oss_npm: "shard-tsdb",
    blurb: OSS_SUPPORT_BLURB,
  },
  sponsor: {
    name: "Sponsor",
    amount_cents: 2900,
    stripe: "https://www.slidphilabs.com/pay?sku=sponsor",
    kind: "support",
  },
  donate: {
    name: "Donate",
    amount_cents: 2999,
    stripe: "https://www.slidphilabs.com/pay?sku=donate",
    kind: "support",
  },
  "gao-entry": {
    name: "Great Agentic Olympiad Entry",
    amount_cents: 100,
    stripe: "https://www.slidphilabs.com/olympiad",
    kind: "olympiad",
    blurb: "$1 tryout marker. Event page: /olympiad. Not a lab seat.",
  },
  "chamber-week": retired("chamber-month", "Chamber · weekly (not sold)"),
  "chamber-day": retired("chamber-month", "Chamber · day (not sold — try is free)"),
  "tru8-day": retired("gc-day", "TRU8 · Day (historical name → PCC day)"),
  "tru8-month": retired("gc-month", "TRU8 · Month (historical name → PCC month)"),
  "tru8-year": retired("gc-year", "TRU8 · Year (historical name → PCC year)"),
  "tru8-commercial": retired("gc-year", "TRU8 commercial (historical → PCC year)"),
  "truchamber-day": retired("gc-day", "TRU8 Chamber day (historical → PCC day)"),
  "truchamber-month": retired("gc-month", "TRU8 Chamber month (historical → PCC month)"),
  "truchamber-year": retired("gc-year", "TRU8 Chamber year (historical → PCC year)"),
  "gate-day": retired("gc-day", "Gate · Day (inside PCC)"),
  "gate-month": retired("gc-month", "Gate · Month (inside PCC)"),
  "gate-year": retired("gc-year", "Gate · Year (inside PCC)"),
  "aware-day": retired("gc-day", "AWARE · Day (legacy alias → PCC day)"),
  "aware-month": retired("gc-month", "AWARE · Month (legacy alias → PCC month)"),
  "aware-year": retired("gc-year", "AWARE · Year (legacy alias → PCC year)"),
  "zrw-n00b": retired("gc-year", "ZRW N00b (retired → PCC year)"),
  "zrw-pro": retired("gc-year", "ZRW Pro (retired → PCC year)"),
  "zrw-l33t": retired("gc-year", "ZRW L33t (retired → PCC year)"),
  "trugame-rent-week": retired("trugame-month", "TruGame rent (retired)"),
  "slid-phi": retired("consulting", "slid-phi npm stub (not sold)"),
  "support-integration": retired("consulting", "Support + Integration → consulting"),
  "cddg-split": retired("consulting", "CDDG:Split (not sold as a SKU)"),
  "json-chamber": retired("chamber-year", "json-chamber unlock (historical → Chamber year)"),
  "try-gate": retired("suite", "Try Gate (retired → Suite meter)"),
};

export const SKU_ALIASES = {
  residual: "consulting",
  "residual-governance": "consulting",
  twin: "consulting",
  cddg: "consulting",
  split: "consulting",
  zrw: "gc-year",
  n00b: "gc-year",
  noob: "gc-year",
  pro: "gc-year",
  l33t: "gc-year",
  "zrw-n00b": "gc-year",
  "zrw-pro": "gc-year",
  "zrw-l33t": "gc-year",
  gc: "gc-year",
  "combined-gc": "gc-year",
  "combined-gc-day": "gc-day",
  "combined-gc-month": "gc-month",
  "combined-gc-year": "gc-year",
  aware: "gc-year",
  "aware-day": "gc-day",
  "aware-month": "gc-month",
  "aware-year": "gc-year",
  pcc: "gc-year",
  "pcc-day": "gc-day",
  "pcc-month": "gc-month",
  "pcc-year": "gc-year",
  gate: "gc-year",
  "gate-day": "gc-day",
  "gate-month": "gc-month",
  "gate-year": "gc-year",
  "lab-pass-year": "lab-pass",
  pass: "lab-pass",
  support: "consulting",
  integration: "consulting",
  "support-integration": "consulting",
  donation: "donate",
  gao: "gao-entry",
  olympiad: "gao-entry",
  "olympiad-entry": "gao-entry",
  ppp: "suite",
  suite: "suite",
  rent: "trugame-month",
  "game-rent": "trugame-month",
  "trugame-rent": "trugame-month",
  "trugame-week": "trugame-month",
  "trugame-rent-week": "trugame-month",
  "trugame-pass": "trugame-month",
  "pay-per-suite": "suite",
  chamber: "chamber-year",
  "chamber-only": "chamber-year",
  security: "chamber-year",
  "json-chamber": "chamber-year",
  unlock: "chamber-year",
  week: "chamber-month",
  weekly: "chamber-month",
  "chamber-week": "chamber-month",
  "chamber-day": "chamber-month",
  rider: "rider-year",
  "agent-rider": "rider-year",
  agentrider: "rider-year",
  "rider-team-month": "rider-month",
  "rider-team-year": "rider-year",
  "rider-ops": "rider-ops-year",
  fleetpulse: "rider-ops-year",
  "fleet-pulse": "rider-ops-year",
  ops: "rider-ops-month",
  warrant: "warrant-year",
  "agent-warrant": "warrant-year",
  "warrant-month": "warrant-month",
  "warrant-year": "warrant-year",
  "cuni-closed": "cuni-exception",
  exception: "cuni-exception",
  "pulsar-closed": "pulsar-exception",
  "pulsar-embed": "pulsar-exception",
  "gpl-exception-pulsar": "pulsar-exception",
  tru8: "gc-year",
  both: "gc-year",
  truchamber: "gc-year",
  "truchamber-day": "gc-day",
  "truchamber-month": "gc-month",
  "truchamber-year": "gc-year",
  "tru8-commercial": "gc-year",
  "tru8-day": "gc-day",
  "tru8-month": "gc-month",
  "tru8-year": "gc-year",
  "tru8-chamber": "gc-year",
  codec: "gc-year",
  fetch: "quikgater",
  "quik-gater": "quikgater",
  fetchgate: "quikgater",
};

export function resolveSku(raw) {
  const k = String(raw || "")
    .trim()
    .toLowerCase();
  if (!k) return null;
  if (k === "suite" || k === "ppp" || k === "pay-per-suite" || k === "auto") return "suite";
  let hit = SKU_ALIASES[k] || k;
  const seen = new Set();
  while (
    hit &&
    PRODUCT_CATALOG[hit] &&
    PRODUCT_CATALOG[hit].retired &&
    PRODUCT_CATALOG[hit].alias &&
    !seen.has(hit)
  ) {
    seen.add(hit);
    hit = PRODUCT_CATALOG[hit].alias;
  }
  if (hit === "suite") return "suite";
  if (PRODUCT_CATALOG[hit] && !PRODUCT_CATALOG[hit].retired) return hit;
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

  function rowFor(sku, p) {
    const sell = p.sell !== false && p.kind !== "usage" && p.kind !== "retired" && (p.amount_cents || 0) >= 50;
    const row = {
      sku,
      name: p.name,
      amount_usd: ((p.amount_cents || 0) / 100).toFixed(2),
      amount_cents: p.amount_cents || 0,
      kind: p.kind,
      list: !!p.list,
      sell,
      human_payment_link: p.stripe || null,
      checkout: sell
        ? `POST ${origin}/api/checkout { "sku": "${sku}" }`
        : p.page || p.stripe || `${origin}/products`,
      agent_x402:
        p.kind === "usage"
          ? p.x402 || `${origin}/quikgater`
          : `POST ${origin}/api/x402-products { "sku": "${sku}" }`,
    };
    if (p.blurb) row.blurb = p.blurb;
    if (p.oss_npm) row.oss_npm = p.oss_npm;
    if (p.page) row.page = p.page;
    if (p.x402) row.x402 = p.x402;
    return row;
  }
  const products = Object.entries(PRODUCT_CATALOG)
    .filter(([, p]) => !p.retired)
    .map(([sku, p]) => rowFor(sku, p));
  const listed = Object.entries(PRODUCT_CATALOG)
    .filter(([, p]) => !p.retired && p.list)
    .map(([sku, p]) => rowFor(sku, p));

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
      note: "Hosted Checkout. Card, Link, Cash App, Amazon Pay, US bank ACH, Klarna, Affirm, Afterpay when Stripe enables them for the session. Apple Pay and Google Pay ride on card.",
      how: {
        endpoint: `POST ${origin}/api/checkout`,
        body: { sku: "chamber-year", email: "you@example.com", rail: "stripe" },
        returns: "url → hosted Checkout",
      },
    },
    {
      id: "stripe_payment_link",
      name: "Stripe Payment Links (static)",
      audience: ["humans"],
      configured: true,
      note: "Checkout sessions from POST /api/checkout. No static Payment Links on the public catalog.",
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
      free_cap_gb: 6.9,
      after_free_usd_per_gb: 0.05,
      human: `POST ${origin}/api/ppp-checkout`,
      agent: `POST ${origin}/api/x402-suite`,
      ui: `${origin}/pps`,
    },
  ];

  const configured = rails.filter((r) => r.configured).map((r) => r.id);
  const missing = rails.filter((r) => !r.configured).map((r) => r.id);

  return {
    service: "Slid Phi Labs — lab checkout",
    version: "1.2.0",
    policy: "Humans: Stripe Checkout, then /access. Teams: invoice/wire. Agents: x402. Entitlement after Stripe session verify or x402 claim.",
    product_face: "Slid Phi Labs",
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
    listed,
    products,
    aliases: SKU_ALIASES,
    preferred: {
      human: "stripe_checkout",
      agent: evm || sol ? (evm ? "x402_base_usdc" : "x402_solana_usdc") : "stripe_checkout",
      enterprise: "wire_invoice_ach",
    },
    note: "Payment Links and Checkout Sessions settle in USD on Stripe. Crypto rails settle on-chain; email proof for Access until auto-claim is wired.",
  };
}

/**
 * Create Stripe Checkout Session — card (Apple/Google Pay ride on card).
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
      STRIPE_CHECKOUT_METHODS_FALLBACK.forEach((m, i) =>
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
