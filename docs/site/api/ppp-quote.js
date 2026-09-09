/**
 * Quote a compress job against this month's meter.
 * First 2 GB free, then 8¢/GB, $1 card minimum.
 */
import { computeQuote, FREE_BYTES, PRICING_EXAMPLES } from "./suite-pricing.js";
import { meterSnapshot, identityFromReq, readUsage } from "./lib/usage-meter.mjs";

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

  const id = identityFromReq(req);
  const used = readUsage(id.key);
  const quote = computeQuote({
    product: String(body.product || "auto"),
    dataClass: String(body.dataClass || body.data_class || "unknown"),
    op: String(body.op || "compress"),
    bytes: body.bytes,
    used_bytes: body.used_bytes != null ? body.used_bytes : used.bytes,
    sku: body.sku || id.sku,
  });

  return json(res, 200, {
    ...quote,
    pricing_model: "free_2gb_then_8c",
    usage: meterSnapshot(req, Number(body.bytes) || 0),
    examples: PRICING_EXAMPLES,
  });
}
