/**
 * POST /v1/fetch and POST /api/fetch. Proxies the existing Quikgater worker.
 * The worker owns the $0.02 meter, the free 100, and the 402.
 */
import { quikgaterProxy } from "./lib/call-doors.mjs";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-PAYMENT, Payment-Signature");
}

function bodyOf(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body && typeof body === "object" && !Buffer.isBuffer(body) ? body : {};
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  let target = "";
  if (req.method === "GET") {
    target = String((req.query && req.query.url) || "");
  } else if (req.method === "POST") {
    target = String(bodyOf(req).url || "");
  } else {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ ok: false, error: "GET or POST" }));
  }
  const proxied = await quikgaterProxy(target, {
    "x-payment": req.headers["x-payment"] || "",
    "payment-signature": req.headers["payment-signature"] || "",
    authorization: req.headers.authorization || "",
  });
  res.statusCode = proxied.status;
  res.setHeader("Content-Type", proxied.contentType || "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  for (const [name, value] of Object.entries(proxied.paymentHeaders || {})) {
    if (value) res.setHeader(name, value);
  }
  res.end(proxied.body);
}
