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

/** Parked product: not listed, not for sale (no 402). Guards old SKUs with a clean 410. */
function parked(name, blurb) {
  return {
    name,
    amount_cents: 0,
    stripe: "https://www.slidphilabs.com/pricing",
    kind: "trugame",
    list: false,
    sell: false,
    parked: true,
    blurb,
  };
}

export const PRODUCT_CATALOG = {
  "chamber-month": {
    name: "Chamber · monthly cloak license",
    amount_cents: 2000,
    stripe: "https://www.slidphilabs.com/pay?sku=chamber-month",
    kind: "chamber",
    list: true,
    blurb: "License to seal new JSON for 30 days. Open already-sealed blobs with both keys.",
  },
  "chamber-year": {
    name: "Chamber · annual cloak license",
    amount_cents: 20000,
    stripe: "https://www.slidphilabs.com/pay?sku=chamber-year",
    kind: "chamber",
    list: true,
    blurb: "License to seal new JSON for 365 days. Ciphertext does not expire.",
  },
  "gc-day": retired("suite", "PCC · 24-hour seat (legacy → PCC meter)"),
  "gc-month": retired("pcc-pro", "PCC Pro · monthly (legacy → PCC Pro $25/mo)"),
  "gc-year": retired("pcc-pro-year", "PCC Pro · 12 months prepaid (legacy → PCC Pro annual)"),
  "pcc-pro": {
    name: "PCC Pro · monthly",
    amount_cents: 2500,
    stripe: "https://www.slidphilabs.com/pay?sku=pcc-pro",
    kind: "pcc",
    list: true,
    blurb: "Compression through your tools. 100 GB of input included each month, then $0.20/GB. Pay-as-you-go without a plan is $0.25/GB; first 1 GB/month free.",
    meter: { unit: "GB input", included_gb: 100, overage_cents_per_gb: 20, alert_fraction: 0.8 },
  },
  "pcc-pro-year": {
    name: "PCC Pro · 12 months prepaid",
    amount_cents: 25000,
    stripe: "https://www.slidphilabs.com/pay?sku=pcc-pro-year",
    kind: "pcc",
    list: true,
    blurb: "PCC Pro for 12 months. 100 GB of input included each month, then $0.20/GB.",
    meter: { unit: "GB input", included_gb: 100, overage_cents_per_gb: 20, alert_fraction: 0.8 },
  },
    "psi-meter": {
    name: "PSI Meter, monthly spend log",
    amount_cents: 2500,
    stripe: "https://www.slidphilabs.com/pay?sku=psi-meter",
    kind: "psi",
    list: true,
    blurb: "Meter every model call: tokens, dollars, carbon, time. Enforced caps and cache discipline. First audit free. $25/seat/month including 250,000 calls; then $2 per 100,000 calls. Free: 1 seat, 10,000 calls/month, 7-day retention.",
    meter: { unit: "logged calls", included: 250000, overage_cents_per_100k: 200, alert_fraction: 0.8 },
  },
  "psi-org": {
    name: "PSI Org, monthly audits plus enforcement",
    amount_cents: 7900,
    stripe: "https://www.slidphilabs.com/pay?sku=psi-team",
    kind: "psi",
    list: true,
    blurb: "Team seats, quarterly audits, enforced caps and cache discipline. First audit free.",
  },
  "psi-month": retired("psi-grant", "psi commercial seat, monthly (retired → unified grant)"),
  "psi-year": retired("psi-grant", "psi commercial seat, yearly (retired → unified grant)"),
  "unified-grant": {
    name: "Unified closed-use grant",
    amount_cents: 49000,
    stripe: "https://www.slidphilabs.com/pay?sku=unified-grant",
    kind: "license",
    list: true,
    blurb: "Unified closed-use grant: $490/product/year (founding $190 for the first 10 grants; 3+ products $390 each). Written grant, human-fulfilled, one product + one year per grant; the build is named in the grant document. TNSSRC grants cover 0.1.0 only.",
  },
  "psi-grant": {
    name: "PSI Embed · closed-use grant, one year",
    amount_cents: 49000,
    stripe: "https://www.slidphilabs.com/pay?sku=psi-grant",
    kind: "exception",
    list: true,
    blurb: "Unified closed-use grant: use, modify, and deploy psi in one closed product for one year. Written grant, human-fulfilled. No redistribution of psi source.",
  },
  "psi-meter-year": {
    name: "PSI Meter · annual, per seat",
    amount_cents: 25000,
    stripe: "https://www.slidphilabs.com/pay?sku=psi-meter-year",
    kind: "psi",
    list: true,
    blurb: "PSI Meter for 12 months, per seat. 250,000 logged calls/month included, then $2 per 100,000 calls.",
    meter: { unit: "logged calls", included: 250000, overage_cents_per_100k: 200, alert_fraction: 0.8 },
  },
"lab-check": {
    name: "CuNi check",
    amount_cents: 5,
    stripe: "https://www.slidphilabs.com/pay?sku=lab-check",
    kind: "lab",
    list: true,
    blurb: "One exactness check. First 100 checks/month free, then $0.05 per check. x402 on the verb.",
    meter: { unit: "check", free: 100, rate_cents: 5 },
  },
  "lab-translate": {
    name: "CuNi Bank paste",
    amount_cents: 10,
    stripe: "https://www.slidphilabs.com/pay?sku=lab-translate",
    kind: "lab",
    list: true,
    blurb: "One Bank paste. x402 on the verb.",
  },
  "lab-squeeze": {
    name: "PCCX squeeze",
    amount_cents: 10,
    stripe: "https://www.slidphilabs.com/pay?sku=lab-squeeze",
    kind: "lab",
    list: true,
    blurb: "One squeeze. x402 on the verb.",
  },
  "rider-solo": {
    name: "Rider · Solo seat",
    amount_cents: 1200,
    stripe: "https://www.slidphilabs.com/pay?sku=rider-solo",
    kind: "rider",
    list: true,
    blurb: "Signed agent identity L0–L4. 1 identity, 500 verifications/month. Overage $0.02 per verification; monthly cap default 2× plan price; 80% alert. Free identities carry no L3/L4 attestation.",
    meter: { unit: "verification", included: 500, overage_cents: 2, cap_default_cents: 2400, alert_fraction: 0.8 },
  },
  "rider-bundle": retired("rider-team", "Rider · Bundle seat (legacy → Rider Team)"),
  "rider-crew": retired("rider-team", "Rider · Crew seat (legacy → Rider Team)"),
  "rider-shop": retired("rider-fleet", "Rider · Shop seat (legacy → Rider Fleet)"),
  "rider-team": {
    name: "Rider · Team seat",
    amount_cents: 4900,
    stripe: "https://www.slidphilabs.com/pay?sku=rider-team",
    kind: "rider",
    list: true,
    blurb: "Signed agent identities L0–L4. 10 identities, 5,000 verifications/month, Warrant included. Overage $0.02 per verification; monthly cap default 2× plan price; 80% alert.",
    meter: { unit: "verification", included: 5000, overage_cents: 2, cap_default_cents: 9800, alert_fraction: 0.8 },
  },
  "rider-fleet": {
    name: "Rider · Fleet seat",
    amount_cents: 19900,
    stripe: "https://www.slidphilabs.com/pay?sku=rider-fleet",
    kind: "rider",
    list: true,
    blurb: "Signed agent identities L0–L4. 100 identities, 50,000 verifications/month, Warrant + fleet watch included. Overage $0.02 per verification; monthly cap default 2× plan price; 80% alert.",
    meter: { unit: "verification", included: 50000, overage_cents: 2, cap_default_cents: 39800, alert_fraction: 0.8 },
  },
  "rider-solo-year": {
    name: "Rider · Solo seat, annual",
    amount_cents: 12000,
    stripe: "https://www.slidphilabs.com/pay?sku=rider-solo-year",
    kind: "rider",
    list: true,
    blurb: "Signed agent identity L0–L4 for 12 months. 1 identity, 500 verifications/month. Overage $0.02 per verification; monthly cap default 2× plan price; 80% alert.",
    meter: { unit: "verification", included: 500, overage_cents: 2, cap_default_cents: 2400, alert_fraction: 0.8 },
  },
  "rider-team-year": {
    name: "Rider · Team seat, annual",
    amount_cents: 49000,
    stripe: "https://www.slidphilabs.com/pay?sku=rider-team-year",
    kind: "rider",
    list: true,
    blurb: "Signed agent identities L0–L4 for 12 months. 10 identities, 5,000 verifications/month, Warrant included. Overage $0.02 per verification; monthly cap default 2× plan price; 80% alert.",
    meter: { unit: "verification", included: 5000, overage_cents: 2, cap_default_cents: 9800, alert_fraction: 0.8 },
  },
  "rider-fleet-year": {
    name: "Rider · Fleet seat, annual",
    amount_cents: 199000,
    stripe: "https://www.slidphilabs.com/pay?sku=rider-fleet-year",
    kind: "rider",
    list: true,
    blurb: "Signed agent identities L0–L4 for 12 months. 100 identities, 50,000 verifications/month, Warrant + fleet watch included. Overage $0.02 per verification; monthly cap default 2× plan price; 80% alert.",
    meter: { unit: "verification", included: 50000, overage_cents: 2, cap_default_cents: 39800, alert_fraction: 0.8 },
  },
  "rider-ops-month": {
    name: "Rider Ops · monthly fleet watch",
    amount_cents: 3700,
    stripe: "https://www.slidphilabs.com/pay?sku=rider-ops-month",
    kind: "rider-ops",
    list: true,
    blurb: "Heartbeat + alert when a signed Rider agent goes quiet. We turn it on after payment. Needs a Rider seat.",
  },
  "rider-ops-year": {
    name: "Rider Ops · annual fleet watch",
    amount_cents: 36900,
    stripe: "https://www.slidphilabs.com/pay?sku=rider-ops-year",
    kind: "rider-ops",
    list: true,
    blurb: "Year of fleet watch for a Rider team. Heartbeat + alert. Needs a Rider seat.",
  },
  "warrant-month": retired("warrant-addon", "Warrant · monthly mandate seat (retired → Warrant add-on)"),
  "warrant-year": retired("warrant-addon-year", "Warrant · annual mandate seat (retired → Warrant add-on, annual)"),
  "warrant-addon": {
    name: "Warrant · add-on to Rider Solo",
    amount_cents: 800,
    stripe: "https://www.slidphilabs.com/pay?sku=warrant-addon",
    kind: "warrant",
    list: true,
    blurb: "Signed mandates and receipts bound to a Rider identity, added to a Solo account. Included in Rider Team and Fleet.",
  },
  "warrant-addon-year": {
    name: "Warrant · add-on to Rider Solo, annual",
    amount_cents: 8000,
    stripe: "https://www.slidphilabs.com/pay?sku=warrant-addon-year",
    kind: "warrant",
    list: true,
    blurb: "Warrant add-on for 12 months, added to a Solo account. Included in Rider Team and Fleet.",
  },
  "cuni-exception": {
    name: "CuNi · closed-app grant (one app, one year)",
    amount_cents: 49000,
    stripe: "https://www.slidphilabs.com/pay?sku=cuni-exception",
    kind: "exception",
    list: true,
    blurb: "Written grant for one closed app, one year. CuNi itself is free. Covers CuNi 0.10.0.",
  },
  "pulsar-exception": {
    name: "pulsar · closed-embed grant (one product, one year)",
    amount_cents: 49000,
    stripe: "https://www.slidphilabs.com/pay?sku=pulsar-exception",
    kind: "exception",
    list: true,
    blurb: "Written grant to embed pulsar in one closed-source product for one year. pulsar source stays GPLv3. Covers the published GPLv3 build.",
  },
  "lab-pass": {
    name: "Lab Pass · annual (Chamber + Rider Solo + PSI Meter + Warrant)",
    amount_cents: 49500,
    stripe: "https://www.slidphilabs.com/pay?sku=lab-pass",
    kind: "seat",
    list: true,
    blurb: "Chamber year + Rider Solo year + PSI Meter 1 seat year + Warrant add-on year. No compression. Parts $650; bundle $495.",
  },
  "tnssrc-grant": {
    name: "TNSSRC closed grant, one year",
    amount_cents: 49000,
    stripe: "https://www.slidphilabs.com/pay?sku=tnssrc-grant",
    kind: "exception",
    list: true,
    blurb: "Closed grant for TNSSRC 0.1.0 for one year. Written grant, human-fulfilled. Covers build 0.1.0 only.",
  },
  "tnssrc-bakeoff": {
    name: "TNSSRC host bake-off, monthly",
    amount_cents: 1931,
    stripe: "https://www.slidphilabs.com/pay?sku=tnssrc-bakeoff",
    kind: "seat",
    list: true,
    blurb: "Host bake-off per month, on a PCC seat. Human-scheduled.",
  },
  "foundry-plus": retired("lab-pass", "Foundry+ (retired — buy Lab Pass and the unified grant separately)"),
  "trugame-month": parked(
    "TruGame · monthly (parked)",
    "Parked/building — not a live engine. Not for sale. Info: https://www.slidphilabs.com/pricing"
  ),
  "trugame-year": parked(
    "TruGame · annual (parked)",
    "Parked/building — not a live engine. Not for sale. Info: https://www.slidphilabs.com/pricing"
  ),
  consulting: {
    name: "Lab consulting (2-hour minimum)",
    amount_cents: 35000,
    stripe: "https://www.slidphilabs.com/pay?sku=consulting",
    kind: "service",
    list: true,
    blurb: "$175/hour, 2-hour minimum, scoped SOW. Integration, benches, written grant, leftover math names.",
  },
  suite: {
    name: "PCC usage",
    amount_cents: 0,
    stripe: "https://www.slidphilabs.com/pps",
    kind: "usage",
    list: true,
    sell: false,
    page: "https://www.slidphilabs.com/pps",
    x402: "POST https://www.slidphilabs.com/api/x402-suite",
    blurb: "PCC meter: $0.25 per GB of input. First 1 GB each month free; Pro $25/month includes 100 GB, then $0.20/GB. Customer-set monthly cap (default $25), 80% alert. Agents: POST /api/x402-suite. Not a seat SKU.",
    meter: { unit: "GB input", free_gb: 1, rate_cents: 25, pro_rate_cents: 20, pro_included_gb: 100, cap_default_cents: 2500, alert_fraction: 0.8 },
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
    blurb: "Pay $0.02 per fetch. First 100 fetches/month free. Customer-set monthly cap (default $10), 80% alert. Not a seat. Missing URL → 400. Unpaid URL → 402.",
    meter: { unit: "fetch", free: 100, rate_cents: 2, cap_default_cents: 1000, alert_fraction: 0.8 },
  },
  "grant-founding": {
    name: "Unified closed-use grant · founding rate",
    amount_cents: 19000,
    stripe: "https://www.slidphilabs.com/pay?sku=grant-founding",
    kind: "exception",
    list: true,
    blurb: "Founding rate: first 10 unified grants only. One product, one year. Written grant, human-fulfilled. Renewal at the then-current schedule price.",
  },
  "grant-volume": {
    name: "Unified closed-use grant · 3+ products rate, each",
    amount_cents: 39000,
    stripe: "https://www.slidphilabs.com/pay?sku=grant-volume",
    kind: "exception",
    list: true,
    blurb: "3+ products: $390 per product per year, each. Written grant, human-fulfilled. Renewal at the then-current schedule price.",
  },
  "gitdepot": {
    name: "GitDepot · team seat, monthly",
    amount_cents: 1500,
    stripe: "https://www.slidphilabs.com/pay?sku=gitdepot",
    kind: "gitdepot",
    list: true,
    blurb: "Team artifact depot, live. Content-addressed blobs in team namespaces, quotas, eviction, audit log. 100 GB pooled storage included, then $0.10/GB/month. Invite-only.",
    meter: { unit: "GB pooled storage", included_gb: 100, overage_cents_per_gb: 10, alert_fraction: 0.8 },
  },
  "gitdepot-year": {
    name: "GitDepot · team seat, annual",
    amount_cents: 15000,
    stripe: "https://www.slidphilabs.com/pay?sku=gitdepot-year",
    kind: "gitdepot",
    list: true,
    blurb: "GitDepot for 12 months, per seat. 100 GB pooled storage included, then $0.10/GB/month. Invite-only.",
    meter: { unit: "GB pooled storage", included_gb: 100, overage_cents_per_gb: 10, alert_fraction: 0.8 },
  },
  "teachaid-student": {
    name: "TeachAid · student, monthly",
    amount_cents: 600,
    stripe: "https://www.slidphilabs.com/pay?sku=teachaid-student",
    kind: "teachaid",
    list: true,
    blurb: "Campus app with a teacher that cites the textbook. Voice + unlimited courses + curriculum builder. Free: 1 course, text-only cited answers.",
  },
  "teachaid-student-year": {
    name: "TeachAid · student, annual",
    amount_cents: 6000,
    stripe: "https://www.slidphilabs.com/pay?sku=teachaid-student-year",
    kind: "teachaid",
    list: true,
    blurb: "TeachAid student plan for 12 months. Voice + unlimited courses + curriculum builder.",
  },
  "teachaid-pilot": {
    name: "TeachAid · campus pilot, per semester",
    amount_cents: 250000,
    stripe: "https://www.slidphilabs.com/pay?sku=teachaid-pilot",
    kind: "teachaid",
    list: true,
    blurb: "Institutional pilot: one campus, one semester, up to 500 students, onboarding included.",
  },
  "acp-certification": {
    name: "ACP Conformant · assessment, one-time",
    amount_cents: 99000,
    stripe: "https://www.slidphilabs.com/pay?sku=acp-certification",
    kind: "certification",
    list: true,
    blurb: "Human-reviewed assessment against the 13 ACP layers. Pilot program: 3 free pilot certifications; assessment criteria published. ACP itself is an open standard, no direct price.",
  },
  "oss-support": {
    name: "OSS support (public libraries)",
    amount_cents: 19900,
    stripe: "https://www.slidphilabs.com/pay?sku=oss-support",
    kind: "support-oss",
    blurb: OSS_SUPPORT_BLURB,
  },
  blackjack: retired("oss-support", "Blackjack support (retired → OSS support)"),
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
  "tru8-day": retired("suite", "TRU8 · Day (historical → PCC meter)"),
  "tru8-month": retired("pcc-pro", "TRU8 · Month (historical → PCC Pro)"),
  "tru8-year": retired("pcc-pro-year", "TRU8 · Year (historical → PCC Pro annual)"),
  "tru8-commercial": retired("pcc-pro-year", "TRU8 commercial (historical → PCC Pro annual)"),
  "truchamber-day": retired("suite", "TRU8 Chamber day (historical → PCC meter)"),
  "truchamber-month": retired("pcc-pro", "TRU8 Chamber month (historical → PCC Pro)"),
  "truchamber-year": retired("pcc-pro-year", "TRU8 Chamber year (historical → PCC Pro annual)"),
  "gate-day": retired("suite", "Gate · Day (inside PCC)"),
  "gate-month": retired("pcc-pro", "Gate · Month (inside PCC)"),
  "gate-year": retired("pcc-pro-year", "Gate · Year (inside PCC)"),
  "aware-day": retired("suite", "AWARE · Day (legacy alias → PCC meter)"),
  "aware-month": retired("pcc-pro", "AWARE · Month (legacy alias → PCC Pro)"),
  "aware-year": retired("pcc-pro-year", "AWARE · Year (legacy alias → PCC Pro annual)"),
  "zrw-n00b": retired("pcc-pro-year", "ZRW N00b (retired → PCC Pro annual)"),
  "zrw-pro": retired("pcc-pro-year", "ZRW Pro (retired → PCC Pro annual)"),
  "zrw-l33t": retired("pcc-pro-year", "ZRW L33t (retired → PCC Pro annual)"),
  "trugame-rent-week": retired("trugame-month", "TruGame rent (retired)"),
  "slid-phi": retired("consulting", "slid-phi npm stub (not sold)"),
  "support-integration": retired("consulting", "Support + Integration → consulting"),
  "cddg-split": retired("consulting", "CDDG:Split (not sold as a SKU)"),
  "json-chamber": retired("chamber-year", "json-chamber unlock (historical → Chamber year)"),
  "try-gate": retired("suite", "Try Gate (retired → Suite meter)"),
};

export const SKU_ALIASES = {
  "psi-embed-grant": "psi-grant",
  "psi-license": "psi-grant",
  "pcc-meter": "suite",
  "psi-commercial": "psi-grant",
  "psi-seat": "psi-grant",
  residual: "consulting",
  "residual-governance": "consulting",
  twin: "consulting",
  cddg: "consulting",
  split: "consulting",
  zrw: "pcc-pro",
  n00b: "pcc-pro",
  noob: "pcc-pro",
  pro: "pcc-pro",
  "pcc-pro": "pcc-pro",
  l33t: "pcc-pro",
  "zrw-n00b": "pcc-pro",
  "zrw-pro": "pcc-pro",
  "zrw-l33t": "pcc-pro",
  gc: "pcc-pro",
  "combined-gc": "pcc-pro",
  "combined-gc-day": "suite",
  "combined-gc-month": "pcc-pro",
  "combined-gc-year": "pcc-pro-year",
  aware: "pcc-pro",
  "aware-day": "suite",
  "aware-month": "pcc-pro",
  "aware-year": "pcc-pro-year",
  pcc: "pcc-pro",
  "pcc-day": "suite",
  "pcc-month": "pcc-pro",
  "pcc-year": "pcc-pro-year",
  gate: "pcc-pro",
  "gate-day": "suite",
  "gate-month": "pcc-pro",
  "gate-year": "pcc-pro-year",
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
  rider: "rider-solo",
  "agent-rider": "rider-solo",
  agentrider: "rider-solo",
  "rider-team-month": "rider-team",
  "rider-ops": "rider-ops-year",
  fleetpulse: "rider-ops-year",
  "fleet-pulse": "rider-ops-year",
  ops: "rider-ops-month",
  warrant: "warrant-addon",
  "agent-warrant": "warrant-addon",
  "warrant-month": "warrant-month",
  "warrant-year": "warrant-year",
  "cuni-closed": "cuni-exception",
  exception: "cuni-exception",
  "pulsar-closed": "pulsar-exception",
  "pulsar-embed": "pulsar-exception",
  "gpl-exception-pulsar": "pulsar-exception",
  tru8: "pcc-pro-year",
  both: "pcc-pro-year",
  truchamber: "pcc-pro-year",
  "truchamber-day": "suite",
  "truchamber-month": "pcc-pro",
  "truchamber-year": "pcc-pro-year",
  "tru8-commercial": "pcc-pro-year",
  "tru8-day": "gc-day",
  "tru8-month": "gc-month",
  "tru8-year": "gc-year",
  "tru8-chamber": "gc-year",
  codec: "pcc-pro-year",
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
      free_cap_gb: 1,
      after_free_usd_per_gb: 0.25,
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
    policy: "Humans: Stripe Checkout, then /access. Teams: invoice/wire. Agents: x402 with auto-claim. Entitlement after Stripe session verify or x402 claim_token.",
    product_face: "Slid Phi Labs",
    x402_access_autoclaim: true,
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
    note: "Payment Links and Checkout Sessions settle in USD on Stripe. Agents: x402 Solana USDC + Base USDC, auto-claim ON (claim_token on paid POST). Notion order log needs NOTION_TOKEN on Fly.",
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
