/**
 * GET /api/access-verify?session=cs_...&product=tru8-commercial
 * Confirms Stripe Checkout Session paid status and returns a real deliverable
 * pack for the Access page.
 *
 * SKUs:
 *   try-gate        — legacy instant eval seat
 *   tru8-commercial — TRU8 / tru8-chamber project license (human-fulfilled; not residual dump)
 *   json-chamber    — $99 Chamber unlock (support path after Stripe)
 *   other full SKUs — paid_confirmed + PACKAGE ACCESS mail
 *
 * Env: STRIPE_SECRET_KEY or STRIPE_RESTRICTED_KEY (checkout.sessions read).
 *
 * One lab email only: corey@slidphilabs.com (PACKAGE ACCESS + commercial).
 */

const FULFILL_EMAIL = "corey@slidphilabs.com";
const BASE = "https://www.slidphilabs.com";

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
  const prefix = sku === "tru8-commercial" ? "t8_" : "tg_";
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
    // TRU8 commercial loop
    tru8: "tru8-commercial",
    "tru8-chamber": "tru8-commercial",
    "tru8_chamber": "tru8-commercial",
    license: "tru8-commercial",
    studio: "tru8-commercial",
    commercial: "tru8-commercial",
    "project-license": "tru8-commercial",
    // Chamber security unlock
    chamber: "json-chamber",
    "json-chamber": "json-chamber",
    "chamber-unlock": "json-chamber",
    unlock: "json-chamber",
  };
  return aliases[s] || s || null;
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

  // --- Try Gate: instant evaluation seat (no private engine dump) ---
  if (product === "try-gate") {
    const seat_id = simpleSeatId(sessionId, "try-gate");
    const entitlement = {
      type: "slid_phi_labs_entitlement",
      version: "1.0",
      sku: "try-gate",
      name: "Try Gate evaluation seat",
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
        web: base + "/web",
        standings: base + "/standings",
        truth: base + "/truth",
        suite_quote: base + "/pps",
        eval_guide: base + "/access/packs/try-gate/eval-guide.md",
        checklist: base + "/access/packs/try-gate/checklist.md",
        blog: base + "/blog",
        agents: base + "/agents",
        discovery: base + "/api/agent",
      },
      does_not_include: [
        "Private codec process",
        "Closed-source engine tarballs",
        "Residual coefficients or internal math",
      ],
      human_followup: {
        email: FULFILL_EMAIL,
        subject: "TRY GATE SEAT " + seat_id,
      },
    };

    return {
      state: "instant",
      sku: "try-gate",
      title: "Try Gate evaluation seat — unlocked",
      instant: true,
      seat_id,
      summary:
        "Payment confirmed. Your evaluation seat is active now. Use public demos and proof pages; full private packages still require a product purchase.",
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
          title: "Compress something free",
          href: "/web",
          detail: "Web mode — no account.",
        },
        {
          n: 2,
          title: "Check public standings",
          href: "/standings",
          detail: "Outcomes vs industry baselines we publish.",
        },
        {
          n: 3,
          title: "Quote a suite job (optional)",
          href: "/pps",
          detail: "See bulk-cheap pricing for your bytes.",
        },
        {
          n: 4,
          title: "TRU8 commercial when ready",
          href: "/access?product=tru8-commercial",
          detail: "tru8-chamber project license — residual path, human-fulfilled.",
        },
      ],
      next: "Download your entitlement JSON on this page, then run the checklist.",
    };
  }

  // --- TRU8 commercial / tru8-chamber: entitlement + human package (not residual dump) ---
  if (product === "tru8-commercial") {
    const seat_id = simpleSeatId(sessionId, "tru8-commercial");
    const entitlement = {
      type: "slid_phi_labs_entitlement",
      version: "1.0",
      sku: "tru8-commercial",
      name: "TRU8 Commercial / tru8-chamber project license",
      seat_id,
      session_id: sessionId,
      email: email || null,
      paid: true,
      amount_total: amountTotal,
      currency: currency || "usd",
      list_price_usd: 1900,
      term: "project_year",
      issued_at: new Date().toISOString(),
      issuer: base,
      ip_guard:
        "Commercial entitlement only. Residual engine and private coefficients ship via human PACKAGE ACCESS — never as a public download from this page.",
      ships: {
        entitlement_json: true,
        what_ships: base + "/access/packs/tru8-commercial/what-ships.md",
        checklist: base + "/access/packs/tru8-commercial/checklist.md",
        public_demos: base + "/demos",
        license_page: base + "/license",
        support_window: "project year (human onboarding)",
      },
      does_not_include: [
        "Instant residual engine tarball on this page",
        "Public dump of T_SPARSE / Continuous-1088 / closed coefficients",
        "Unlimited redistribution of proprietary sources",
      ],
      human_followup: {
        email: FULFILL_EMAIL,
        subject: "PACKAGE ACCESS tru8-commercial " + seat_id,
      },
    };

    return {
      state: "paid_confirmed",
      sku: "tru8-commercial",
      title: "tru8-chamber project license — payment confirmed",
      instant: false,
      seat_id,
      summary:
        "Stripe reports paid for the tru8-chamber project license ($1,900/project/year — not a per-user seat). Download your entitlement JSON. Private residual package is fulfilled by the lab (usually same day) — Access is not a codec dump.",
      entitlement,
      downloads: [
        {
          id: "what-ships",
          label: "What ships",
          href: "/access/packs/tru8-commercial/what-ships.md",
        },
        {
          id: "checklist",
          label: "Fulfillment checklist",
          href: "/access/packs/tru8-commercial/checklist.md",
        },
      ],
      steps: [
        {
          n: 1,
          title: "Email PACKAGE ACCESS",
          href: packageMailto("tru8-commercial", sessionId, email),
          detail:
            "To " +
            FULFILL_EMAIL +
            " only. Include product, session, checkout email, project name.",
        },
        {
          n: 2,
          title: "Read what ships",
          href: "/access/packs/tru8-commercial/what-ships.md",
          detail: "Entitlement + residual package scope — no public secret dump.",
        },
        {
          n: 3,
          title: "Public demos while you wait",
          href: "/demos",
          detail: "TRU8 public tokens stay free with credit.",
        },
      ],
      next:
        "Email " +
        FULFILL_EMAIL +
        " subject PACKAGE ACCESS tru8-commercial with this session id (usually same day).",
    };
  }

  // --- json-chamber $99 unlock ---
  if (product === "json-chamber") {
    const seat_id = simpleSeatId(sessionId, "json-chamber");
    return {
      state: "paid_confirmed",
      sku: "json-chamber",
      title: "json-chamber unlock — payment confirmed",
      instant: false,
      seat_id,
      summary:
        "Stripe reports paid for Chamber permanent unlock ($99 / domain — not a user seat, not compression). Lab sends VerifiedDR / unlock steps by email (usually same day).",
      steps: [
        {
          n: 1,
          title: "Email PACKAGE ACCESS",
          href: packageMailto("json-chamber", sessionId, email),
          detail: "Include domain / install host if known.",
        },
        {
          n: 2,
          title: "Chamber product page",
          href: "/chamber",
          detail: "Docs and trial path.",
        },
      ],
      next:
        "Email " +
        FULFILL_EMAIL +
        " subject PACKAGE ACCESS json-chamber with this session id.",
      downloads: [],
    };
  }

  // --- Full packages: paid confirmed; package still human-fulfilled ---
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
        detail: "Download link or npm path — typically within one business day.",
      },
      {
        n: 3,
        title: "Use public demos while you wait",
        href: "/demos",
        detail: "TRU8 public demos + Chamber trial stay open.",
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

    // Heuristic when Stripe metadata missing
    let sku = productHint;
    if (!sku && paid && amountTotal === 900) sku = "try-gate";
    if (!sku && paid && amountTotal === 2900) sku = "sponsor";
    if (!sku && paid && amountTotal === 9900) sku = "json-chamber";
    if (!sku && paid && amountTotal === 190000) sku = "tru8-commercial";

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
