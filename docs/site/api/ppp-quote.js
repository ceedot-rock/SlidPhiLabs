/**
 * PPP quote — POST /api/ppp-quote
 * Freemium: free first 100 GB, then usage rates far under cloud egress.
 * See suite-pricing.js for the canonical model.
 */
import { computeQuote, FREE_BYTES, PRICING_EXAMPLES } from "./suite-pricing.js";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export { computeQuote, FREE_BYTES };

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return json(res, 400, { error: "Invalid JSON" });
    }
  }
  body = body || {};

  const quote = computeQuote({
    product: String(body.product || "auto"),
    dataClass: String(body.dataClass || body.data_class || "unknown"),
    op: String(body.op || "compress"),
    bytes: body.bytes,
  });

  return json(res, 200, {
    ...quote,
    pricing_model: "freemium_usage_v2",
    examples: PRICING_EXAMPLES,
  });
}
