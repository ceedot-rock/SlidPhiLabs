/**
 * TruGame rental — $3.99 / 7-day black box. Then buy or it dies.
 */
import {
  createStripeCheckoutSession,
  PRODUCT_CATALOG,
  siteOrigin,
} from "./lib/payments-rails.js";

const RENT_MS = 7 * 24 * 3600 * 1000;
const COOKIE = "spl_rent";
const PASS = "spl_game";
const BUY = {
  rent: { sku: "trugame-rent-week", usd: 3.99, label: "Rent 7 days · $3.99" },
  month: { sku: "trugame-month", usd: 12, label: "Buy month · $12" },
  year: { sku: "trugame-year", usd: 79, label: "Buy year · $79" },
};

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function cookies(req) {
  const out = {};
  for (const p of String(req.headers?.cookie || "").split(";")) {
    const i = p.indexOf("=");
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  }
  return out;
}

function inspect(req) {
  const c = cookies(req);
  const now = Date.now();
  const pass = /^(month|year)\.(\d+)$/.exec(c[PASS] || "");
  if (pass) {
    const started = Number(pass[2]);
    const life = pass[1] === "year" ? 365 * 864e5 : 30 * 864e5;
    if (now - started < life) {
      return { ok: true, door: "pass", kind: pass[1], box_open: true, hours_left: (life - (now - started)) / 3600000 };
    }
  }
  const rent = /^1\.(\d+)$/.exec(c[COOKIE] || "");
  if (rent) {
    const started = Number(rent[1]);
    const left = RENT_MS - (now - started);
    if (left > 0) {
      return { ok: true, door: "rent", box_open: true, hours_left: +(left / 3600000).toFixed(2), days_left: +(left / 864e5).toFixed(2) };
    }
    return { ok: false, door: "dead", box_open: false, hours_left: 0, error: "7-day box closed", buy: BUY };
  }
  return { ok: false, door: "none", box_open: false, buy: BUY };
}

function json(res, n, body) {
  res.statusCode = n;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method === "GET") {
    return json(res, 200, { protocol: "splb-rent-7d", ...inspect(req), buy: BUY });
  }
  if (req.method !== "POST") return json(res, 405, { error: "method" });

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return json(res, 400, { error: "json" });
    }
  }
  body = body || {};
  const action = String(body.action || "checkout");
  const sku = String(body.sku || "trugame-rent-week");
  const origin = siteOrigin(req);
  const item = PRODUCT_CATALOG[sku];
  if (!item) return json(res, 400, { error: "unknown_sku" });

  if (action === "checkout") {
    try {
      const session = await createStripeCheckoutSession({
        amountCents: item.amount_cents,
        name: item.name,
        description:
          sku === "trugame-rent-week"
            ? "7-day black box. Then buy a Pass or the box dies."
            : "TruGame Pass. All desks.",
        sku,
        email: body.email,
        origin,
        successPath: "/games",
        cancelPath: "/games?rent=cancel",
      });
      return json(res, 200, { ok: true, url: session.url, sku });
    } catch (e) {
      return json(res, 503, { ok: false, error: e.code || "checkout", message: e.message, buy: BUY });
    }
  }

  if (action === "activate") {
    const sessionId = String(body.session || body.session_id || "");
    if (!sessionId.startsWith("cs_")) return json(res, 400, { error: "need_session" });
    const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_RESTRICTED_KEY || "";
    if (!key) return json(res, 503, { error: "stripe_not_configured" });
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const sess = await r.json();
    const paid = sess.payment_status === "paid" || sess.status === "complete";
    if (!paid) return json(res, 402, { ok: false, error: "not_paid" });
    const paidSku = sess.metadata?.sku || sku;
    const now = Date.now();
    if (paidSku === "trugame-month" || paidSku === "trugame-year") {
      const kind = paidSku.endsWith("year") ? "year" : "month";
      res.setHeader(
        "Set-Cookie",
        `${PASS}=${kind}.${now}; Path=/; Max-Age=${kind === "year" ? 31536000 : 2592000}; SameSite=Lax`,
      );
      return json(res, 200, { ok: true, door: "pass", kind });
    }
    res.setHeader("Set-Cookie", `${COOKIE}=1.${now}; Path=/; Max-Age=604800; SameSite=Lax`);
    return json(res, 200, { ok: true, door: "rent", hours_left: 168 });
  }

  return json(res, 200, inspect(req));
}
