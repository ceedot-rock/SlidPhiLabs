/**
 * GET /api/access-verify?session=cs_...&product=tru8-year
 * GET /api/access-verify?claim=spl1....&product=chamber-year
 *
 * Rails:
 *   Stripe  — Checkout Session paid (cs_…)
 *   x402    — HMAC claim token issued after X-PAYMENT verify
 *
 * Primary SKUs (SoT: /pricing.json):
 *   TRU8 (compression): tru8-day $19 | tru8-month $99 | tru8-year $990 (year = both products)
 *   Chamber (security): chamber-day $9 | chamber-month $49 | chamber-year $490
 *   Aliases: truchamber-* → tru8-*
 *
 * One email only: corey@slidphilabs.com
 */

import { verifyClaim } from "./lib/x402-claim.mjs";

const FULFILL_EMAIL = "corey@slidphilabs.com";
const BASE = "https://www.slidphilabs.com";

/** Two products × Day/Month/Year. TRU8 Year = both products + seat for full year. */
const SEATS = {
  "chamber-day": {
    name: "Chamber · Day",
    list_usd: 12.5,
    unit: "24 hours",
    amount_cents: 1250,
    product: "chamber",
    stack: "chamber",
    includes: ["Chamber security only"],
    does_not_include: ["TRU8 production path"],
  },
  "chamber-month": {
    name: "Chamber · Month",
    list_usd: 87.5,
    unit: "calendar month",
    amount_cents: 8750,
    product: "chamber",
    stack: "chamber",
    includes: ["Chamber security only"],
    does_not_include: ["TRU8 production path"],
  },
  "chamber-year": {
    name: "Chamber · Year",
    list_usd: 950,
    unit: "calendar year",
    amount_cents: 95000,
    product: "chamber",
    stack: "chamber",
    includes: ["Chamber security only"],
    does_not_include: ["TRU8 production path"],
  },
  "tru8-day": {
    name: "TRU8 · Day",
    list_usd: 24.99,
    unit: "24 hours",
    amount_cents: 2499,
    product: "tru8",
    stack: "tru8",
    includes: ["TRU8 production path"],
    does_not_include: ["Chamber security seat"],
  },
  "tru8-month": {
    name: "TRU8 · Month",
    list_usd: 175,
    unit: "calendar month",
    amount_cents: 17500,
    product: "tru8",
    stack: "tru8",
    includes: ["TRU8 production path"],
    does_not_include: ["Chamber security seat"],
  },
  "tru8-year": {
    name: "TRU8 · Year (both products + seat)",
    list_usd: 1900,
    unit: "calendar year",
    amount_cents: 190000,
    product: "tru8",
    stack: "both",
    includes: [
      "TRU8 production path",
      "Chamber security seat",
      "Both products for the full year",
    ],
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
  if (sku.startsWith("tru8-") || sku.startsWith("truchamber-")) prefix = "t8_";
  else if (sku.startsWith("chamber-")) prefix = "ch_";
  else if (sku === "tru8-commercial") prefix = "t8_";
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
    residual: "cddg-split",
    "residual-governance": "cddg-split",
    twin: "cddg-split",
    cddg: "cddg-split",
    split: "cddg-split",
    chip: "try-gate",
    "try-gate-chip-in": "try-gate",
    trygate: "try-gate",
    n00b: "zrw-n00b",
    "zrw-starting-gate": "zrw-n00b",
    "zrw-pro-starter": "zrw-pro",
    "zrw-l33t-unlimited": "zrw-l33t",
    support: "support-integration",
    // Chamber product
    "chamber-day": "chamber-day",
    "chamber-month": "chamber-month",
    "chamber-year": "chamber-year",
    chamber: "chamber-year",
    security: "chamber-year",
    "security-only": "chamber-year",
    "chamber-only": "chamber-year",
    "json-chamber": "chamber-year",
    unlock: "chamber-year",
    // TRU8 product
    "tru8-day": "tru8-day",
    "tru8-month": "tru8-month",
    "tru8-year": "tru8-year",
    tru8: "tru8-year",
    day: "tru8-day",
    month: "tru8-month",
    year: "tru8-year",
    yearly: "tru8-year",
    annual: "tru8-year",
    both: "tru8-year",
    full: "tru8-year",
    seat: "tru8-year",
    truchamber: "tru8-year",
    "truchamber-day": "tru8-day",
    "truchamber-month": "tru8-month",
    "truchamber-year": "tru8-year",
    "tru8-commercial": "tru8-year",
    "tru8-chamber": "tru8-year",
    license: "tru8-year",
    studio: "tru8-year",
    commercial: "tru8-year",
    // legacy
    "day-pass": "tru8-day",
    monthly: "tru8-month",
    residual: "cddg-split",
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
    "Instant residual engine tarball on this page",
    "Suite meter credit (use /pps separately)",
  ]);
  const pack = both ? "tru8" : isChamber ? "chamber" : "tru8";
  const entitlement = {
    type: "slid_phi_labs_entitlement",
    version: "1.2",
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
    stack: meta.stack,
    issued_at: new Date().toISOString(),
    issuer: BASE,
    product: both ? "TRU8 Year (both products)" : isChamber ? "Chamber" : "TRU8",
    includes,
    package_access: "open",
    ip_guard: both
      ? "TRU8 Year = Chamber seat + TRU8 production for full year. Package Access opens on payment confirm."
      : isChamber
        ? "Chamber security only. Half price. No TRU8 production. Package Access open on payment."
        : "TRU8 production only for this term. Chamber seat not included (buy TRU8 Year for both).",
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
      (both
        ? "TRU8 Year = Chamber seat + TRU8 for the full year (both products)."
        : isChamber
          ? "Chamber security only — half price. No TRU8 production."
          : "TRU8 production only for this term. Chamber not included.") +
      " Download your entitlement and install pack below.",
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
      ip_guard:
        "Public evaluation seat only. No private process, engines, or secret sauce.",
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
          title: "Buy TRU8 production",
          href: "/access?product=tru8-year",
          detail: "Day $19 · Month $99 · Year $990 (year = both products).",
        },
      ],
      next: "Download entitlement JSON, then consider a TRU8 or Chamber plan.",
    };
  }

  // --- Full packages: paid confirmed; human-fulfilled ---
  const names = {
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
    if (!sku && paid && amountTotal === 9900) sku = "chamber-year";

    const deliverable = buildDeliverable({
      paid,
      sku,
      sessionId: body.id,
      email,
      amountTotal,
      currency,
    });

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
