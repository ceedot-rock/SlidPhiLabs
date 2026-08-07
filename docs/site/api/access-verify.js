/**
 * GET /api/access-verify?session=cs_...
 * Confirms Stripe Checkout Session paid status for /access page.
 * Uses STRIPE_SECRET_KEY or STRIPE_RESTRICTED_KEY (must allow checkout.sessions read).
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const sessionId = String(req.query.session || req.query.session_id || "").trim();
  if (!sessionId || !sessionId.startsWith("cs_")) {
    return res.status(400).json({ ok: false, error: "missing_or_invalid_session" });
  }

  const key =
    process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_RESTRICTED_KEY ||
    "";
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
      {
        headers: { Authorization: `Bearer ${key}` },
      }
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
      body.payment_status === "paid" ||
      body.status === "complete";
    const amountTotal = body.amount_total;
    const currency = body.currency;
    const email =
      body.customer_details?.email ||
      body.customer_email ||
      null;
    const productHint =
      body.metadata?.product ||
      body.metadata?.sku ||
      body.client_reference_id ||
      null;

    return res.status(200).json({
      ok: true,
      paid,
      status: body.status,
      payment_status: body.payment_status,
      session_id: body.id,
      amount_total: amountTotal,
      currency,
      email,
      product_hint: productHint,
      mode: body.mode,
      // Human next-step: full private tarball still manual until signed storage
      deliverable: paid
        ? {
            state: "paid_confirmed",
            next:
              "Email ceedotrock@gmail.com subject PACKAGE ACCESS with this session id for install package (usually same day).",
          }
        : {
            state: "not_paid",
            next: "Complete Stripe checkout, then return with session id.",
          },
    });
  } catch (e) {
    console.error("access-verify", e.message || e);
    return res.status(500).json({ ok: false, error: "verify_failed" });
  }
}
