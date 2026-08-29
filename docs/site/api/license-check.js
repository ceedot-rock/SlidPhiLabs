/**
 * POST /api/license-check
 * LicenseBox remote check. Returns { active, period_end } from Stripe subscriptions.
 * Body: { project_id?, email?, customer?, subscription? }
 * Never logs full Stripe objects.
 */
const STRIPE = "https://api.stripe.com/v1";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(body));
}

function key() {
  return (process.env.STRIPE_SECRET_KEY || process.env.STRIPE_RESTRICTED_KEY || "").trim();
}

async function stripeGet(path) {
  const k = key();
  if (!k) return { error: "no_stripe_key" };
  const r = await fetch(STRIPE + path, {
    headers: { Authorization: `Bearer ${k}` },
    signal: AbortSignal.timeout(15000),
  });
  const data = await r.json();
  return data;
}

function periodEnd(sub) {
  const t = sub?.current_period_end || sub?.items?.data?.[0]?.current_period_end;
  return typeof t === "number" ? t : null;
}

function isActive(sub) {
  const st = String(sub?.status || "");
  return st === "active" || st === "trialing";
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.end();
  }

  if (req.method === "GET") {
    return json(res, 200, {
      service: "license-check",
      post: { body: { email: "you@example.com" }, returns: { active: "bool", period_end: "unix|null" } },
    });
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "method_not_allowed", active: false });
  }

  if (!key()) {
    return json(res, 503, { error: "stripe_unconfigured", active: false, period_end: null });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  body = body || {};

  try {
    if (body.subscription) {
      const sub = await stripeGet(`/subscriptions/${encodeURIComponent(String(body.subscription))}`);
      if (sub?.id) {
        return json(res, 200, { active: isActive(sub), period_end: periodEnd(sub), status: sub.status });
      }
    }
    if (body.customer) {
      const list = await stripeGet(
        `/subscriptions?customer=${encodeURIComponent(String(body.customer))}&status=all&limit=10`
      );
      const live = (list.data || []).find(isActive);
      if (live) return json(res, 200, { active: true, period_end: periodEnd(live), status: live.status });
      return json(res, 200, { active: false, period_end: null });
    }
    const email = String(body.email || "").trim().toLowerCase();
    if (email && email.includes("@")) {
      const cust = await stripeGet(`/customers?email=${encodeURIComponent(email)}&limit=5`);
      for (const c of cust.data || []) {
        const list = await stripeGet(`/subscriptions?customer=${encodeURIComponent(c.id)}&status=all&limit=10`);
        const live = (list.data || []).find(isActive);
        if (live) return json(res, 200, { active: true, period_end: periodEnd(live), status: live.status });
      }
      return json(res, 200, { active: false, period_end: null });
    }
    return json(res, 200, { active: false, period_end: null, hint: "pass email, customer, or subscription" });
  } catch (e) {
    return json(res, 200, { active: false, period_end: null, error: "check_failed" });
  }
}
