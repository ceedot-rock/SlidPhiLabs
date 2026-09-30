/**
 * POST /api/rider/claim — mint a Rider credential after Stripe payment.
 *
 * Body: { session_id, sku }
 * 1. GET https://agentrider.fly.dev/api/provision?session_id= → merchant key
 * 2. POST https://agentrider.fly.dev/api/rider/issue with X-Merchant-Key → JWT
 * Returns { ok, jwt, expires_in } or { ok:false, message, detail }.
 */
function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    if (req.body != null && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
      resolve(req.body);
      return;
    }
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

const RIDER_HOST = "https://agentrider.fly.dev";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "POST only" });

  let body;
  try { body = await readJson(req); }
  catch { return json(res, 400, { ok: false, error: "bad_json" }); }

  const sessionId = String(body.session_id || "").trim();
  const sku = String(body.sku || "rider-solo").trim();
  if (!sessionId) return json(res, 400, { ok: false, error: "session_id_required" });

  // Step 1: provision lookup — session_id → merchant key
  let provision;
  try {
    const r = await fetch(`${RIDER_HOST}/api/provision?session_id=${encodeURIComponent(sessionId)}`);
    provision = await r.json();
  } catch (e) {
    return json(res, 502, {
      ok: false,
      message: "The Rider host did not answer.",
      detail: "Your seat is paid. Try refreshing in a minute, or email corey@slidphilabs.com.",
    });
  }

  const merchantKey = provision.merchant_key || provision.key || provision.merchant_live_;
  if (!merchantKey) {
    return json(res, 200, {
      ok: false,
      message: "Your seat is paid, but the Rider host did not return a credential for this checkout.",
      detail: provision.error
        ? "The host said: " + String(provision.error)
        : "Email corey@slidphilabs.com with your receipt and Corey will mint your name directly.",
    });
  }

  // Step 2: mint the credential
  let issued;
  try {
    const r = await fetch(`${RIDER_HOST}/api/rider/issue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Merchant-Key": merchantKey,
      },
      body: JSON.stringify({ sku }),
    });
    issued = await r.json();
  } catch (e) {
    return json(res, 502, {
      ok: false,
      message: "Your seat is paid and provisioned, but the mint did not answer.",
      detail: "Try refreshing in a minute, or email corey@slidphilabs.com.",
    });
  }

  const jwt = issued.rider || issued.jwt || issued.token || issued.credential;
  if (!jwt) {
    return json(res, 200, {
      ok: false,
      message: "Your seat is paid and provisioned, but no credential came back.",
      detail: issued.error
        ? "The host said: " + String(issued.error)
        : "Email corey@slidphilabs.com with your receipt and Corey will mint your name directly.",
    });
  }

  return json(res, 200, {
    ok: true,
    jwt,
    expires_in: issued.expires_in || 900,
  });
}
