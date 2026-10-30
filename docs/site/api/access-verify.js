/**
 * GET /api/access-verify?session=cs_...&product=tru8-year
 * GET /api/access-verify?claim=spl1....&product=chamber-year
 *
 * Rails:
 *   Stripe  — Checkout Session paid (cs_…)
 *   x402    — HMAC claim token issued after X-PAYMENT verify
 *
 * Primary SKUs (SoT: /pricing.json; blank-slate pricing 2026-10-30):
 *   Chamber: chamber-month $20 | chamber-year $200  (open is keys-only)
 *   PCC: metered $0.25/GB input, 1 GB/mo free · Pro $25/mo (100 GB incl., then $0.20/GB)
 *   Rider: Solo $12 · Team $49 · Fleet $199 (per month; annual 10x) · Ops $37/$369 (unchanged)
 *   Lab Pass $495 (Chamber + Rider Solo + PSI Meter seat + Warrant add-on; NO compression)
 *   Legacy gc-day/month/year, tru8, and old-rider entries stay below for old receipts only.
 *
 * One email only: corey@slidphilabs.com
 */

import { verifyClaim } from "./lib/x402-claim.mjs";
import { reportPurchase } from "./lib/ga4.mjs";
import { recordSale } from "./lib/sales-ledger.mjs";

const FULFILL_EMAIL = "corey@slidphilabs.com";
const BASE = "https://www.slidphilabs.com";

/** Listed lab seats. Legacy TRU8 / Gate SKUs stay for old receipts. */
const SEATS = {
  "chamber-week": {
    name: "Chamber · weekly (not sold)",
    list_usd: 1.99,
    unit: "7 days",
    valid_days: 7,
    amount_cents: 199,
    product: "chamber",
    stack: "chamber",
    includes: ["Cloak new JSON for 7 days"],
    does_not_include: ["Kill switch on already-sealed blobs", "AWARE", "Hosted storage"],
  },
  "chamber-day": {
    name: "Chamber · 24-hour seat",
    list_usd: 9,
    unit: "24 hours",
    valid_days: 1,
    amount_cents: 900,
    product: "chamber",
    stack: "chamber",
    includes: ["Chamber JSON seal"],
    does_not_include: ["AWARE compressor", "Agent-Rider"],
  },
  "chamber-month": {
    name: "Chamber · monthly seat",
    list_usd: 20,
    unit: "calendar month",
    valid_days: 30,
    amount_cents: 2000,
    product: "chamber",
    stack: "chamber",
    includes: [
      "License to cloak new JSON for 30 days",
      "json-chamber-sdk",
      "Open already-sealed blobs with both keys (no extra payment)",
    ],
    does_not_include: ["AWARE compressor", "Agent-Rider", "Hosted blob storage", "Kill switch on stored secrets"],
  },
  "chamber-year": {
    name: "Chamber · annual cloak license",
    list_usd: 200,
    unit: "calendar year",
    valid_days: 365,
    amount_cents: 20000,
    product: "chamber",
    stack: "chamber",
    includes: [
      "License to cloak new JSON for 365 days",
      "json-chamber-sdk",
      "Open already-sealed blobs with both keys (no extra payment)",
    ],
    does_not_include: ["AWARE compressor", "Agent-Rider", "Hosted blob storage", "Kill switch on stored secrets"],
  },
  "gc-day": {
    name: "PCC · 24-hour compressor seat",
    list_usd: 9,
    unit: "24 hours",
    amount_cents: 900,
    product: "pcc",
    stack: "pcc",
    includes: ["AWARE hosted compressor access"],
    does_not_include: ["engine source", "Chamber", "Agent-Rider"],
  },
  "gc-month": {
    name: "PCC · monthly compressor seat",
    list_usd: 37,
    unit: "calendar month",
    amount_cents: 3700,
    product: "pcc",
    stack: "pcc",
    includes: ["AWARE hosted compressor access"],
    does_not_include: ["engine source", "Chamber", "Agent-Rider"],
  },
  "gc-year": {
    name: "PCC · annual compressor seat",
    list_usd: 369,
    unit: "calendar year",
    amount_cents: 36900,
    product: "pcc",
    stack: "pcc",
    includes: ["AWARE hosted compressor access"],
    does_not_include: ["engine source", "Chamber", "Agent-Rider"],
  },
  "rider-solo": {
    name: "Rider · Solo seat",
    list_usd: 12,
    unit: "seat",
    amount_cents: 1200,
    product: "rider",
    stack: "rider",
    includes: ["Agent-Rider signed identity L0–L4", "1 identity, 500 verifications/month"],
    does_not_include: ["Chamber", "PCC", "Lab Pass"],
  },
  "rider-team": {
    name: "Rider · Team seat",
    list_usd: 49,
    unit: "seat",
    amount_cents: 4900,
    product: "rider",
    stack: "rider",
    includes: ["Agent-Rider signed identities L0–L4", "10 identities, 5,000 verifications/month, Warrant included"],
    does_not_include: ["Chamber", "PCC", "Lab Pass"],
  },
  "rider-solo-year": {
    name: "Rider · Solo seat, annual",
    list_usd: 120,
    unit: "seat",
    amount_cents: 12000,
    product: "rider",
    stack: "rider",
    includes: ["Agent-Rider signed identity L0–L4", "1 identity, 500 verifications/month"],
    does_not_include: ["Chamber", "PCC", "Lab Pass"],
  },
  "rider-team-year": {
    name: "Rider · Team seat, annual",
    list_usd: 490,
    unit: "seat",
    amount_cents: 49000,
    product: "rider",
    stack: "rider",
    includes: ["Agent-Rider signed identities L0–L4", "10 identities, 5,000 verifications/month, Warrant included"],
    does_not_include: ["Chamber", "PCC", "Lab Pass"],
  },
  "rider-fleet-year": {
    name: "Rider · Fleet seat, annual",
    list_usd: 1990,
    unit: "seat",
    amount_cents: 199000,
    product: "rider",
    stack: "rider",
    includes: ["Agent-Rider signed identities L0–L4", "100 identities, 50,000 verifications/month, Warrant + fleet watch included"],
    does_not_include: ["Chamber", "PCC", "Lab Pass"],
  },
  "rider-bundle": {
    name: "Rider · Bundle seat",
    list_usd: 19.31,
    unit: "seat",
    amount_cents: 1931,
    product: "rider",
    stack: "rider",
    includes: ["Agent-Rider signed identity L0–L4"],
    does_not_include: ["Chamber", "AWARE", "Lab Pass"],
  },
  "rider-crew": {
    name: "Rider · Crew seat",
    list_usd: 49,
    unit: "seat",
    amount_cents: 4900,
    product: "rider",
    stack: "rider",
    includes: ["Agent-Rider signed identity L0–L4"],
    does_not_include: ["Chamber", "AWARE", "Lab Pass"],
  },
  "rider-shop": {
    name: "Rider · Shop seat",
    list_usd: 199,
    unit: "seat",
    amount_cents: 19900,
    product: "rider",
    stack: "rider",
    includes: ["Agent-Rider signed identity L0–L4"],
    does_not_include: ["Chamber", "AWARE", "Lab Pass"],
  },
  "rider-fleet": {
    name: "Rider · Fleet seat",
    list_usd: 199,
    unit: "seat",
    amount_cents: 19900,
    product: "rider",
    stack: "rider",
    includes: ["Agent-Rider signed identities L0–L4", "100 identities, 50,000 verifications/month, Warrant + fleet watch included"],
    does_not_include: ["Chamber", "PCC", "Lab Pass"],
  },
  "cuni-exception": {
    name: "CuNi · closed-app grant",
    list_usd: 490,
    unit: "calendar year",
    amount_cents: 49000,
    product: "exception",
    stack: "exception",
    includes: ["Written grant for one closed app, one year. Covers CuNi 0.10.0."],
    does_not_include: ["Engine source", "Chamber", "Agent-Rider"],
  },
  "rider-ops-month": {
    name: "Rider Ops · monthly fleet watch",
    list_usd: 37,
    unit: "calendar month",
    amount_cents: 3700,
    product: "rider-ops",
    stack: "rider-ops",
    includes: ["Heartbeat ingest", "Alert when a signed Rider agent goes quiet"],
    does_not_include: ["Agent-Rider identity seat", "AWARE", "Chamber"],
  },
  "warrant-month": {
    name: "Warrant · monthly mandate seat",
    list_usd: 37,
    unit: "calendar month",
    amount_cents: 3700,
    product: "warrant",
    stack: "warrant",
    includes: ["Issue warrants bound to a Rider", "File receipts", "Verify and revoke"],
    does_not_include: ["Agent-Rider identity seat", "AWARE", "Chamber"],
  },
  "warrant-year": {
    name: "Warrant · annual mandate seat",
    list_usd: 369,
    unit: "calendar year",
    amount_cents: 36900,
    product: "warrant",
    stack: "warrant",
    includes: ["Issue warrants bound to a Rider", "File receipts", "Verify and revoke"],
    does_not_include: ["Agent-Rider identity seat", "AWARE", "Chamber"],
  },
  "rider-ops-year": {
    name: "Rider Ops · annual fleet watch",
    list_usd: 369,
    unit: "calendar year",
    amount_cents: 36900,
    product: "rider-ops",
    stack: "rider-ops",
    includes: ["Heartbeat ingest", "Alert when a signed Rider agent goes quiet"],
    does_not_include: ["Agent-Rider identity seat", "AWARE", "Chamber"],
  },
  consulting: {
    name: "Lab consulting (2-hour minimum)",
    list_usd: 350,
    unit: "2 hours",
    amount_cents: 35000,
    product: "service",
    stack: "service",
    includes: ["Scoped lab time, $175/hour, 2-hour minimum"],
    does_not_include: ["Engine source", "A product seat"],
  },
  "oss-support": {
    name: "OSS support (public libraries)",
    list_usd: 199,
    unit: "engagement",
    amount_cents: 19900,
    product: "support-oss",
    stack: "support-oss",
    includes: ["Support for an already-public GPLv3 library"],
    does_not_include: ["AWARE source", "A secret extra engine"],
  },
  "lab-pass": {
    name: "Lab Pass · annual",
    list_usd: 495,
    unit: "calendar year",
    amount_cents: 49500,
    product: "seat",
    stack: "seat",
    includes: ["Chamber", "Rider Solo", "PSI Meter 1 seat", "Warrant add-on"],
    does_not_include: ["PCC / compression", "Agent-Rider", "engine source"],
  },
  "pcc-pro": {
    name: "PCC Pro · monthly",
    list_usd: 25,
    unit: "calendar month",
    valid_days: 30,
    amount_cents: 2500,
    product: "pcc",
    stack: "pcc",
    includes: ["Compression through your tools: 100 GB input/month included, then $0.20/GB"],
    does_not_include: ["engine source", "Chamber", "Agent-Rider"],
  },
  "pcc-pro-year": {
    name: "PCC Pro · 12 months prepaid",
    list_usd: 250,
    unit: "calendar year",
    valid_days: 365,
    amount_cents: 25000,
    product: "pcc",
    stack: "pcc",
    includes: ["Compression through your tools: 100 GB input/month included, then $0.20/GB"],
    does_not_include: ["engine source", "Chamber", "Agent-Rider"],
  },
  "psi-meter": {
    name: "PSI Meter, monthly spend log",
    list_usd: 25,
    unit: "calendar month",
    valid_days: 30,
    amount_cents: 2500,
    product: "psi",
    stack: "psi",
    includes: ["Meter every model call", "250,000 logged calls/month included, then $2 per 100,000 calls"],
    does_not_include: ["Engine source", "Chamber", "Agent-Rider"],
  },
  "psi-meter-year": {
    name: "PSI Meter · annual, per seat",
    list_usd: 250,
    unit: "calendar year",
    valid_days: 365,
    amount_cents: 25000,
    product: "psi",
    stack: "psi",
    includes: ["Meter every model call", "250,000 logged calls/month included, then $2 per 100,000 calls"],
    does_not_include: ["Engine source", "Chamber", "Agent-Rider"],
  },
  "psi-grant": {
    name: "PSI Embed · closed-use grant, one year",
    list_usd: 490,
    unit: "calendar year",
    valid_days: 365,
    amount_cents: 49000,
    product: "exception",
    stack: "exception",
    includes: ["Written grant: use, modify, and deploy psi in one closed product for one year"],
    does_not_include: ["Redistribution of psi source", "Chamber", "Agent-Rider"],
  },
  "pulsar-exception": {
    name: "pulsar · closed-embed grant",
    list_usd: 490,
    unit: "calendar year",
    valid_days: 365,
    amount_cents: 49000,
    product: "exception",
    stack: "exception",
    includes: ["Written grant to embed pulsar in one closed-source product for one year"],
    does_not_include: ["Engine source", "Chamber", "Agent-Rider"],
  },
  "tnssrc-grant": {
    name: "TNSSRC closed grant, one year",
    list_usd: 490,
    unit: "calendar year",
    valid_days: 365,
    amount_cents: 49000,
    product: "exception",
    stack: "exception",
    includes: ["Written grant for TNSSRC 0.1.0 for one year. Covers build 0.1.0 only."],
    does_not_include: ["Engine source", "Chamber", "Agent-Rider"],
  },
  "warrant-addon": {
    name: "Warrant · add-on to Rider Solo",
    list_usd: 8,
    unit: "calendar month",
    valid_days: 30,
    amount_cents: 800,
    product: "warrant",
    stack: "warrant",
    includes: ["Issue warrants bound to a Rider", "File receipts", "Verify and revoke"],
    does_not_include: ["Agent-Rider identity seat", "Chamber"],
  },
  "warrant-addon-year": {
    name: "Warrant · add-on to Rider Solo, annual",
    list_usd: 80,
    unit: "calendar year",
    valid_days: 365,
    amount_cents: 8000,
    product: "warrant",
    stack: "warrant",
    includes: ["Issue warrants bound to a Rider", "File receipts", "Verify and revoke"],
    does_not_include: ["Agent-Rider identity seat", "Chamber"],
  },
  "gitdepot": {
    name: "GitDepot · team seat, monthly",
    list_usd: 15,
    unit: "calendar month",
    valid_days: 30,
    amount_cents: 1500,
    product: "gitdepot",
    stack: "gitdepot",
    includes: ["Team artifact depot, live", "100 GB pooled storage included, then $0.10/GB/month"],
    does_not_include: ["Git hosting", "Public storage"],
  },
  "gitdepot-year": {
    name: "GitDepot · team seat, annual",
    list_usd: 150,
    unit: "calendar year",
    valid_days: 365,
    amount_cents: 15000,
    product: "gitdepot",
    stack: "gitdepot",
    includes: ["Team artifact depot, live", "100 GB pooled storage included, then $0.10/GB/month"],
    does_not_include: ["Git hosting", "Public storage"],
  },
  "teachaid-student": {
    name: "TeachAid · student, monthly",
    list_usd: 6,
    unit: "calendar month",
    valid_days: 30,
    amount_cents: 600,
    product: "teachaid",
    stack: "teachaid",
    includes: ["Voice + unlimited courses + curriculum builder"],
    does_not_include: ["Textbook-citation rights clearance"],
  },
  "teachaid-student-year": {
    name: "TeachAid · student, annual",
    list_usd: 60,
    unit: "calendar year",
    valid_days: 365,
    amount_cents: 6000,
    product: "teachaid",
    stack: "teachaid",
    includes: ["Voice + unlimited courses + curriculum builder"],
    does_not_include: ["Textbook-citation rights clearance"],
  },
  "teachaid-pilot": {
    name: "TeachAid · campus pilot, per semester",
    list_usd: 2500,
    unit: "semester",
    amount_cents: 250000,
    product: "teachaid",
    stack: "teachaid",
    includes: ["One campus, one semester, up to 500 students, onboarding included"],
    does_not_include: ["Textbook-citation rights clearance"],
  },
  "acp-certification": {
    name: "ACP Conformant · assessment, one-time",
    list_usd: 990,
    unit: "one-time assessment",
    amount_cents: 99000,
    product: "certification",
    stack: "certification",
    includes: ["Human-reviewed assessment against the 13 ACP layers"],
    does_not_include: ["ACP itself (open standard, no direct price)"],
  },
  "grant-founding": {
    name: "Unified closed-use grant · founding rate",
    list_usd: 190,
    unit: "calendar year",
    valid_days: 365,
    amount_cents: 19000,
    product: "exception",
    stack: "exception",
    includes: ["Founding rate: first 10 unified grants only. One product, one year."],
    does_not_include: ["Engine source", "Chamber", "Agent-Rider"],
  },
  "grant-volume": {
    name: "Unified closed-use grant · 3+ products rate, each",
    list_usd: 390,
    unit: "calendar year",
    valid_days: 365,
    amount_cents: 39000,
    product: "exception",
    stack: "exception",
    includes: ["3+ products: $390 per product per year, each. One year."],
    does_not_include: ["Engine source", "Chamber", "Agent-Rider"],
  },
  "tru8-day": {
    name: "TRU8 · Day",
    list_usd: 19,
    unit: "24 hours",
    amount_cents: 1900,
    product: "tru8",
    stack: "tru8",
    includes: ["TRU8 production path"],
    does_not_include: ["Chamber security seat"],
  },
  "tru8-month": {
    name: "TRU8 · Month",
    list_usd: 99,
    unit: "calendar month",
    amount_cents: 9900,
    product: "tru8",
    stack: "tru8",
    includes: ["TRU8 production path"],
    does_not_include: ["Chamber security seat"],
  },
  "tru8-year": {
    name: "TRU8 · Year (both products + seat)",
    list_usd: 990,
    unit: "calendar year",
    amount_cents: 99000,
    product: "tru8",
    stack: "both",
    includes: [
      "TRU8 production path",
      "Chamber security seat",
      "Both products for the full year",
    ],
    does_not_include: [],
  },
  "trugame-rent-week": {
    name: "TruGame rent · 7 days",
    list_usd: 3.99,
    unit: "7 days",
    amount_cents: 399,
    product: "trugame",
    stack: "trugame",
    includes: ["All TruGames desks for 7 days"],
    does_not_include: ["Pass after the box dies"],
  },
  "trugame-month": {
    name: "TruGame Pass · Month",
    list_usd: 12,
    unit: "calendar month",
    amount_cents: 1200,
    product: "trugame",
    stack: "trugame",
    includes: ["All TruGames desks"],
    does_not_include: [],
  },
  "trugame-year": {
    name: "TruGame Pass · Year",
    list_usd: 79,
    unit: "calendar year",
    amount_cents: 7900,
    product: "trugame",
    stack: "trugame",
    includes: ["All TruGames desks"],
    does_not_include: [],
  },
};
const TRUCHAMBER = SEATS;

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function simpleSeatId(sessionId, sku) {
  let h = 2166136261;
  const s = String(sessionId) + "|" + String(sku);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let prefix = "tg_";
  if (sku.startsWith("tru8-") || sku.startsWith("truchamber-") || sku === "tru8-commercial") prefix = "t8_";
  else if (sku.startsWith("chamber-")) prefix = "ch_";
  else if (sku.startsWith("gc-")) prefix = "aw_";
  else if (sku.startsWith("rider-")) prefix = "ar_";
  else if (sku === "lab-pass") prefix = "lp_";
  else if (sku === "cuni-exception") prefix = "cu_";
  return prefix + (h >>> 0).toString(16).padStart(8, "0");
}

function packageMailto(product, sessionId, email) {
  return (
    "mailto:" +
    FULFILL_EMAIL +
    "?subject=" +
    encodeURIComponent("PACKAGE ACCESS " + product) +
    "&body=" +
    encodeURIComponent(
      "Product: " +
        product +
        "\nSession: " +
        sessionId +
        "\nEmail: " +
        (email || "") +
        "\n"
    )
  );
}

export function normalizeSku(raw) {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  const aliases = {
    residual: "consulting",
    "residual-governance": "consulting",
    twin: "consulting",
    cddg: "consulting",
    split: "consulting",
    chip: "suite",
    "try-gate-chip-in": "suite",
    trygate: "suite",
    n00b: "gc-year",
    "zrw-starting-gate": "gc-year",
    "zrw-pro-starter": "gc-year",
    "zrw-l33t-unlimited": "gc-year",
    support: "consulting",
    integration: "consulting",
    "support-integration": "consulting",
    // Chamber product
    "chamber-day": "chamber-month",
    "chamber-week": "chamber-month",
    week: "chamber-month",
    weekly: "chamber-month",
    "chamber-month": "chamber-month",
    "chamber-year": "chamber-year",
    chamber: "chamber-year",
    security: "chamber-year",
    "security-only": "chamber-year",
    "chamber-only": "chamber-year",
    "json-chamber": "chamber-year",
    unlock: "chamber-year",
    "gc-day": "gc-day",
    "gc-month": "gc-month",
    "gc-year": "gc-year",
    gc: "gc-year",
    aware: "gc-year",
    "combined-gc": "gc-year",
    "rider-month": "rider-solo",
    "rider-year": "rider-crew",
    rider: "rider-solo",
    "agent-rider": "rider-solo",
    agentrider: "rider-solo",
    "rider-team-month": "rider-crew",
    "rider-team-year": "rider-crew",
    "lab-pass": "lab-pass",
    "lab-pass-year": "lab-pass",
    "cuni-exception": "cuni-exception",
    "cuni-closed": "cuni-exception",
    exception: "cuni-exception",
    // Historical TRU8 / Gate names → AWARE for new claims. Bare tru8-year stays for old receipts.
    "tru8-day": "gc-day",
    "tru8-month": "gc-month",
    tru8: "gc-year",
    both: "gc-year",
    truchamber: "gc-year",
    "truchamber-day": "gc-day",
    "truchamber-month": "gc-month",
    "truchamber-year": "gc-year",
    "tru8-commercial": "gc-year",
    "tru8-chamber": "gc-year",
    license: "chamber-year",
    commercial: "gc-year",
    gate: "gc-year",
    "gate-day": "gc-day",
    "gate-month": "gc-month",
    "gate-year": "gc-year",
    rent: "trugame-month",
    "trugame-rent": "trugame-month",
    "trugame-week": "trugame-month",
    trugame: "trugame-month",
    "rider-ops": "rider-ops-year",
    fleetpulse: "rider-ops-year",
    consulting: "consulting",
    quikgater: "quikgater",
    "oss-support": "oss-support",
  };
  return aliases[s] || s || null;
}

function buildTruchamberDeliverable({ paid, sku, sessionId, email, amountTotal, currency }) {
  const meta = SEATS[sku];
  const seat_id = simpleSeatId(sessionId, sku);
  const both = meta.stack === "both";
  const isChamber = meta.stack === "chamber";
  const isTru8Only = meta.stack === "tru8";
  const includes = meta.includes || [];
  const doesNot = (meta.does_not_include || []).concat([
    "Engine source dump",
    "Suite meter credit (use /pps separately)",
  ]);
  const pack = isChamber ? "chamber" : both || isTru8Only ? "tru8" : "chamber";
  const productLabel =
    meta.stack === "pcc" ? "PCC"
    : meta.stack === "rider" ? "Agent-Rider"
    : meta.stack === "exception" ? "CuNi exception"
    : meta.stack === "seat" ? "Lab Pass"
    : meta.stack === "trugame" ? "TruGame"
    : both ? "TRU8 Year (legacy bundle)"
    : isChamber ? "Chamber"
    : isTru8Only ? "TRU8 (legacy)"
    : meta.name;
  const issued = new Date();
  const validDays = Number(meta.valid_days) || 0;
  const validUntil = validDays
    ? new Date(issued.getTime() + validDays * 86400000).toISOString()
    : null;
  const entitlement = {
    type: "slid_phi_labs_entitlement",
    version: "1.3",
    sku,
    name: meta.name,
    seat_id,
    session_id: sessionId,
    email: email || null,
    paid: true,
    amount_total: amountTotal,
    currency: currency || "usd",
    list_price_usd: meta.list_usd,
    unit: meta.unit,
    valid_days: validDays || null,
    valid_until: validUntil,
    stack: meta.stack,
    issued_at: issued.toISOString(),
    issuer: BASE,
    product: productLabel,
    includes,
    package_access: "open",
    open_policy: isChamber
      ? "keys_only — already-sealed blobs open with both shares; no extra payment"
      : null,
    cloak_until: isChamber ? validUntil : null,
    note: isChamber
      ? "License to cloak new JSON until " +
        (validUntil || "term end") +
        ". Opening a secret you already sealed takes both keys, not another payment."
      : validUntil
        ? meta.name + " until " + validUntil
        : meta.name + " for this term.",
    ships: {
      entitlement_json: true,
      package_access: "open_on_payment",
      what_ships: BASE + "/access/packs/" + pack + "/what-ships.md",
      checklist: BASE + "/access/packs/" + pack + "/checklist.md",
      pricing: BASE + "/pricing.json",
      public_demos: BASE + "/demos",
      chamber: BASE + "/chamber",
      sdk: "https://github.com/ceedot-rock/json-chamber-sdk",
    },
    does_not_include: doesNot,
    human_followup: {
      email: FULFILL_EMAIL,
      subject: "SUPPORT " + sku + " " + seat_id,
      note: "Optional help only — Package Access already open after payment.",
    },
  };

  return {
    state: "package_open",
    package_access: "open",
    sku,
    title: meta.name + " — Package Access OPEN",
    instant: true,
    seat_id,
    summary:
      "Payment confirmed. Package Access is open now — no extra email gate. " +
      meta.name +
      ". Download your entitlement below.",
    entitlement,
    downloads: [
      {
        id: "what-ships",
        label: "Open package guide",
        href: "/access/packs/" + pack + "/what-ships.md",
      },
      {
        id: "checklist",
        label: "Install checklist",
        href: "/access/packs/" + pack + "/checklist.md",
      },
      {
        id: "sdk",
        label: "Chamber SDK",
        href: "https://github.com/ceedot-rock/json-chamber-sdk",
      },
    ],
    steps: [
      {
        n: 1,
        title: "Download entitlement JSON",
        detail: "Your Package Access proof (seat_id " + seat_id + "). Use the button on this page.",
      },
      {
        n: 2,
        title: "Open package guide",
        href: "/access/packs/" + pack + "/what-ships.md",
        detail: both
          ? "Both products full year — install path."
          : isChamber
            ? "Chamber security install path."
            : "TRU8 production install path.",
      },
      {
        n: 3,
        title: isChamber || both ? "Get Chamber SDK" : "TRU8 demos + production path",
        href: isChamber || both
          ? "https://github.com/ceedot-rock/json-chamber-sdk"
          : "/demos",
        detail:
          "Install from the open pack. Support (optional): " +
          FULFILL_EMAIL +
          " subject SUPPORT " +
          sku +
          ".",
      },
    ],
    next:
      "Package Access is open. Download entitlement JSON, follow the package guide. Email " +
      FULFILL_EMAIL +
      " only if you need human support.",
  };
}

export function buildDeliverable({ paid, sku, sessionId, email, amountTotal, currency }) {
  if (!paid) {
    return {
      state: "not_paid",
      next: "Complete Stripe checkout, then return with session id.",
      steps: [],
    };
  }

  const product = sku || "unknown";
  const base = BASE;

  if (SEATS[product]) {
    return buildTruchamberDeliverable({
      paid,
      sku: product,
      sessionId,
      email,
      amountTotal,
      currency,
    });
  }

  // --- Try Gate: legacy instant evaluation seat ---
  if (product === "try-gate") {
    const seat_id = simpleSeatId(sessionId, "try-gate");
    const entitlement = {
      type: "slid_phi_labs_entitlement",
      version: "1.0",
      sku: "try-gate",
      name: "Try Gate evaluation seat (legacy)",
      seat_id,
      session_id: sessionId,
      email: email || null,
      paid: true,
      amount_total: amountTotal,
      currency: currency || "usd",
      issued_at: new Date().toISOString(),
      issuer: base,

      unlocks: {
        demos: base + "/demos",
        standings: base + "/standings",
        suite_quote: base + "/pps",
        eval_guide: base + "/access/packs/try-gate/eval-guide.md",
        checklist: base + "/access/packs/try-gate/checklist.md",
      },
      does_not_include: [
        "Private codec process",
        "Closed-source engine tarballs",
        "Chamber seat",
      ],
      human_followup: {
        email: FULFILL_EMAIL,
        subject: "TRY GATE SEAT " + seat_id,
      },
    };

    return {
      state: "instant",
      sku: "try-gate",
      title: "Try Gate evaluation seat — unlocked (legacy)",
      instant: true,
      seat_id,
      summary:
        "Payment confirmed. Legacy eval seat. Prefer Chamber or TRU8 Year for production.",
      entitlement,
      downloads: [
        {
          id: "eval-guide",
          label: "Evaluation guide",
          href: "/access/packs/try-gate/eval-guide.md",
        },
        {
          id: "checklist",
          label: "Checklist",
          href: "/access/packs/try-gate/checklist.md",
        },
      ],
      steps: [
        {
          n: 1,
          title: "Open TRU8 demos",
          href: "/demos",
          detail: "Public tokens free with credit.",
        },
        {
          n: 2,
          title: "Buy PCC Pro",
          href: "/pay?sku=pcc-pro",
          detail: "$25/mo, 100 GB included, then $0.20/GB. Metered $0.25/GB without a plan.",
        },
      ],
      next: "Download entitlement JSON, then consider a TRU8 or Chamber plan.",
    };
  }

  // --- psi commercial grant: license grant, instant ---
  if (product === "psi-grant") {
    const seat_id = simpleSeatId(sessionId, product);
    const title = "PSI Embed · closed-use grant, one year";
    const entitlement = {
      type: "slid_phi_labs_entitlement",
      version: "1.0",
      sku: product,
      name: title,
      seat_id,
      session_id: sessionId,
      email: email || null,
      paid: true,
      amount_total: amountTotal,
      currency: currency || "usd",
      issued_at: new Date().toISOString(),
      issuer: BASE,
      unlocks: {
        commercial_grant: "Use, modify, and deploy psi in your products without AGPL obligations for the paid term. No redistribution of psi source. No public competing persistent-agent service except under separate written deal.",
        license_file: "https://github.com/ceedot-rock/psi/blob/main/LICENSE",
        repo: "https://github.com/ceedot-rock/psi",
        terms: "https://www.slidphilabs.com/licensing.json",
      },
      does_not_include: ["Redistribution of psi source", "Trademark license", "Signing keys, production data, private credentials", "Support unless invoiced"],
      human_followup: { email: FULFILL_EMAIL, subject: "psi SEAT " + seat_id },
    };
    return {
      state: "instant",
      sku: product,
      title,
      instant: true,
      seat_id,
      summary: "Paid " + title + ". Private-repo invite follows; keep the claim token as license proof.",
      entitlement,
      downloads: [
        { label: "LICENSE (commercial)", url: "https://github.com/ceedot-rock/psi/blob/main/LICENSE" },
        { label: "Terms (licensing.json)", url: "https://www.slidphilabs.com/licensing.json" },
      ],
      steps: [
        "Keep this claim token: it is the license proof.",
        email ? "Private-repo invite follows at " + email + "."
              : "Reply to " + FULFILL_EMAIL + " with the seat_id for the private-repo invite.",
      ],
      next: { receipt: "Open the access_url from your purchase response with your claim token.", repo: "https://github.com/ceedot-rock/psi" },
    };
  }

  // --- Full packages: paid confirmed; human-fulfilled ---
  const names = {
    "psi-month": "psi commercial seat, monthly",
    "psi-year": "psi commercial seat, yearly",
    "psi-grant": "PSI Embed · closed-use grant, one year",
    "cddg-split": "CDDG:Split",
    "zrw-n00b": "ZRW N00b",
    "zrw-pro": "ZRW Pro",
    "zrw-l33t": "ZRW L33t$aUC3",
    "support-integration": "Support + Integration",
    consulting: "Consulting",
    sponsor: "Sponsor",
    donate: "Donate",
  };

  return {
    state: "paid_confirmed",
    sku: product,
    title: (names[product] || product) + " — payment confirmed",
    instant: false,
    summary:
      "Stripe reports paid. Private install package is fulfilled by the lab (usually same day). Keep this session id.",
    steps: [
      {
        n: 1,
        title: "Email PACKAGE ACCESS",
        href: packageMailto(product, sessionId, email),
        detail: "Include product, session id, checkout email.",
      },
      {
        n: 2,
        title: "Wait for install instructions",
        detail: "Typically within one business day.",
      },
      {
        n: 3,
        title: "Use public demos while you wait",
        href: "/demos",
        detail: "TRU8 public demos stay open.",
      },
    ],
    next:
      "Email " +
      FULFILL_EMAIL +
      " subject PACKAGE ACCESS with this session id for install package (usually same day).",
    downloads: [],
  };
}

function q(req, name) {
  const v = req.query?.[name];
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const sessionId = String(q(req, "session") || q(req, "session_id") || "").trim();
  const claimTok = String(q(req, "claim") || q(req, "x402_claim") || q(req, "token") || "").trim();
  const productQ = normalizeSku(q(req, "product") || q(req, "sku") || "");

  // --- x402 auto-claim path ---
  if (claimTok) {
    const v = verifyClaim(claimTok);
    if (!v.ok) {
      return res.status(401).json({
        ok: false,
        error: v.error || "claim_invalid",
        message: "x402 claim token invalid or expired. Re-buy or email PACKAGE ACCESS.",
      });
    }
    const sku = normalizeSku(productQ || v.payload.sku) || v.payload.sku;
    const deliverable = buildDeliverable({
      paid: true,
      sku,
      sessionId: v.payload.order_id,
      email: v.payload.email || null,
      amountTotal: v.payload.amount_cents,
      currency: "usd",
    });
    if (deliverable.entitlement) {
      deliverable.entitlement.rail = "x402";
      deliverable.entitlement.order_id = v.payload.order_id;
      deliverable.entitlement.tx = v.payload.tx || null;
      deliverable.entitlement.network = v.payload.network || null;
      deliverable.entitlement.claim_expires_at = v.payload.exp
        ? new Date(v.payload.exp * 1000).toISOString()
        : null;
    }
    void reportPurchase({
      sku,
      amountCents: v.payload.amount_cents,
      currency: "usd",
      orderId: v.payload.order_id,
    });
    void recordSale({
      sku,
      amountCents: v.payload.amount_cents,
      currency: "usd",
      orderId: v.payload.order_id,
      rail: "x402",
    });
    return res.status(200).json({
      ok: true,
      paid: true,
      rail: "x402",
      status: "complete",
      payment_status: "paid",
      order_id: v.payload.order_id,
      session_id: v.payload.order_id,
      amount_total: v.payload.amount_cents,
      currency: "usd",
      email: v.payload.email || null,
      product_hint: sku,
      tx: v.payload.tx || null,
      network: v.payload.network || null,
      claim_expires_at: v.payload.exp
        ? new Date(v.payload.exp * 1000).toISOString()
        : null,
      deliverable,
    });
  }

  if (!sessionId || !sessionId.startsWith("cs_")) {
    return res.status(400).json({
      ok: false,
      error: "missing_or_invalid_session",
      message: "Provide session=cs_… (Stripe) or claim=spl1.… (x402).",
    });
  }

  const key =
    process.env.STRIPE_SECRET_KEY || process.env.STRIPE_RESTRICTED_KEY || "";
  if (!key) {
    return res.status(503).json({
      ok: false,
      error: "stripe_not_configured",
      message: "Payment verify temporarily unavailable. Email PACKAGE ACCESS.",
    });
  }

  try {
    const r = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      { headers: { Authorization: `Bearer ${key}` } }
    );
    const body = await r.json();
    if (!r.ok) {
      return res.status(r.status === 404 ? 404 : 502).json({
        ok: false,
        error: "stripe_error",
        message: body?.error?.message || "Could not load session",
      });
    }

    const paid =
      body.payment_status === "paid" || body.status === "complete";
    const amountTotal = body.amount_total;
    const currency = body.currency;
    const email =
      body.customer_details?.email || body.customer_email || null;
    const productHint = normalizeSku(
      productQ ||
        body.metadata?.product ||
        body.metadata?.sku ||
        body.client_reference_id ||
        ""
    );

    let sku = productHint;
    if (!sku && paid && amountTotal === 900) sku = "try-gate";
    if (!sku && paid && amountTotal === 2900) sku = "sponsor";
    if (!sku && paid && amountTotal === 1250) sku = "chamber-day";
    if (!sku && paid && amountTotal === 8750) sku = "chamber-month";
    if (!sku && paid && amountTotal === 95000) sku = "chamber-year";
    if (!sku && paid && amountTotal === 2499) sku = "tru8-day";
    if (!sku && paid && amountTotal === 17500) sku = "tru8-month";
    if (!sku && paid && amountTotal === 190000) sku = "tru8-year";
    // legacy
    if (!sku && paid && amountTotal === 175000) sku = "tru8-year";
    /* flat $369/yr: amounts no longer identify a SKU; Stripe metadata sku rules. */

    const deliverable = buildDeliverable({
      paid,
      sku,
      sessionId: body.id,
      email,
      amountTotal,
      currency,
    });

    if (paid) {
      void reportPurchase({
        sku,
        amountCents: amountTotal,
        currency,
        orderId: body.id,
      });
      void recordSale({
        sku,
        amountCents: amountTotal,
        currency,
        orderId: body.id,
        rail: "stripe",
      });
    }
    return res.status(200).json({
      ok: true,
      paid,
      rail: "stripe",
      status: body.status,
      payment_status: body.payment_status,
      session_id: body.id,
      amount_total: amountTotal,
      currency,
      email,
      product_hint: sku,
      mode: body.mode,
      deliverable,
    });
  } catch (e) {
    console.error("access-verify", e.message || e);
    return res.status(500).json({ ok: false, error: "verify_failed" });
  }
}
