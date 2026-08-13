/**
 * GET /api/access-verify?session=cs_...&product=truchamber-year
 * Confirms Stripe Checkout Session paid status and returns deliverable pack.
 *
 * Primary SKUs (SoT: /pricing.json):
 *   truchamber-day   $24.99
 *   truchamber-month $175
 *   truchamber-year  $1,750  (includes TRU8 production path)
 *
 * Legacy: try-gate instant seat; historical packages → PACKAGE ACCESS
 * Retired aliases: tru8-commercial → truchamber-year; json-chamber → seats
 *
 * One email only: corey@slidphilabs.com
 * Env: STRIPE_SECRET_KEY or STRIPE_RESTRICTED_KEY (checkout.sessions read).
 */

const FULFILL_EMAIL = "corey@slidphilabs.com";
const BASE = "https://www.slidphilabs.com";

const TRUCHAMBER = {
  "truchamber-day": {
    name: "TruChamber Day Pass",
    list_usd: 24.99,
    unit: "24 hours",
    amount_cents: 2499,
  },
  "truchamber-month": {
    name: "TruChamber Monthly",
    list_usd: 175,
    unit: "calendar month",
    amount_cents: 17500,
  },
  "truchamber-year": {
    name: "TruChamber Yearly",
    list_usd: 1750,
    unit: "calendar year",
    amount_cents: 175000,
  },
};

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
  if (sku.startsWith("truchamber-")) prefix = "tc_";
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

function normalizeSku(raw) {
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
    // TruChamber seats (primary)
    day: "truchamber-day",
    "day-pass": "truchamber-day",
    "truchamber-day-pass": "truchamber-day",
    month: "truchamber-month",
    monthly: "truchamber-month",
    year: "truchamber-year",
    yearly: "truchamber-year",
    annual: "truchamber-year",
    truchamber: "truchamber-year",
    seat: "truchamber-year",
    // retired → year seat
    tru8: "truchamber-year",
    "tru8-commercial": "truchamber-year",
    "tru8-chamber": "truchamber-year",
    "tru8_chamber": "truchamber-year",
    license: "truchamber-year",
    studio: "truchamber-year",
    commercial: "truchamber-year",
    "project-license": "truchamber-year",
    chamber: "truchamber-year",
    "json-chamber": "truchamber-year",
    "chamber-unlock": "truchamber-year",
    unlock: "truchamber-year",
  };
  return aliases[s] || s || null;
}

function buildTruchamberDeliverable({ paid, sku, sessionId, email, amountTotal, currency }) {
  const meta = TRUCHAMBER[sku];
  const seat_id = simpleSeatId(sessionId, sku);
  const entitlement = {
    type: "slid_phi_labs_entitlement",
    version: "1.1",
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
    issued_at: new Date().toISOString(),
    issuer: BASE,
    product: "TruChamber",
    includes: [
      "TruChamber cloak/open under live license",
      "TRU8 production path with this seat (not a public residual dump)",
    ],
    ip_guard:
      "Seat entitlement only. Residual / production TRU8 ships via human PACKAGE ACCESS — never as a public download from Access.",
    ships: {
      entitlement_json: true,
      what_ships: BASE + "/access/packs/truchamber/what-ships.md",
      checklist: BASE + "/access/packs/truchamber/checklist.md",
      pricing: BASE + "/pricing.json",
      public_demos: BASE + "/demos",
      chamber: BASE + "/chamber",
    },
    does_not_include: [
      "Instant residual engine tarball on this page",
      "Public dump of closed coefficients",
      "Suite meter credit (use /pps separately)",
    ],
    human_followup: {
      email: FULFILL_EMAIL,
      subject: "PACKAGE ACCESS " + sku + " " + seat_id,
    },
  };

  return {
    state: "paid_confirmed",
    sku,
    title: meta.name + " — payment confirmed",
    instant: false,
    seat_id,
    summary:
      "Stripe reports paid for " +
      meta.name +
      " (" +
      meta.unit +
      "). Download entitlement JSON. Package / license key ships from corey@ (usually same day). Access is not a residual dump.",
    entitlement,
    downloads: [
      {
        id: "what-ships",
        label: "What ships",
        href: "/access/packs/truchamber/what-ships.md",
      },
      {
        id: "checklist",
        label: "Fulfillment checklist",
        href: "/access/packs/truchamber/checklist.md",
      },
    ],
    steps: [
      {
        n: 1,
        title: "Email PACKAGE ACCESS",
        href: packageMailto(sku, sessionId, email),
        detail: "To " + FULFILL_EMAIL + " only. Include product, session, checkout email.",
      },
      {
        n: 2,
        title: "Read what ships",
        href: "/access/packs/truchamber/what-ships.md",
        detail: "Seat scope + TRU8 with seat — no public secret dump.",
      },
      {
        n: 3,
        title: "Public demos while you wait",
        href: "/demos",
        detail: "TRU8 public tokens free with credit.",
      },
    ],
    next:
      "Email " +
      FULFILL_EMAIL +
      " subject PACKAGE ACCESS " +
      sku +
      " with this session id (usually same day).",
  };
}

function buildDeliverable({ paid, sku, sessionId, email, amountTotal, currency }) {
  if (!paid) {
    return {
      state: "not_paid",
      next: "Complete Stripe checkout, then return with session id.",
      steps: [],
    };
  }

  const product = sku || "unknown";
  const base = BASE;

  if (TRUCHAMBER[product]) {
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
        "TruChamber seat",
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
        "Payment confirmed. Legacy eval seat. Prefer TruChamber seats for production TRU8.",
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
          title: "Upgrade to TruChamber seat",
          href: "/access?product=truchamber-year",
          detail: "Day $24.99 · Month $175 · Year $1,750.",
        },
      ],
      next: "Download entitlement JSON, then consider a TruChamber seat.",
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

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const sessionId = String(req.query.session || req.query.session_id || "").trim();
  const productQ = normalizeSku(req.query.product || req.query.sku || "");

  if (!sessionId || !sessionId.startsWith("cs_")) {
    return res.status(400).json({ ok: false, error: "missing_or_invalid_session" });
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
    if (!sku && paid && amountTotal === 2499) sku = "truchamber-day";
    if (!sku && paid && amountTotal === 17500) sku = "truchamber-month";
    if (!sku && paid && amountTotal === 175000) sku = "truchamber-year";
    // retired amounts → year seat path
    if (!sku && paid && amountTotal === 9900) sku = "truchamber-year";
    if (!sku && paid && amountTotal === 190000) sku = "truchamber-year";

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
