/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * POST /api/stripe-webhook — Stripe event receiver (0.1.0).
 *
 * Verifies the Stripe-Signature over the EXACT request bytes (server attaches
 * req.rawBody), then on checkout.session.completed records the sale to the
 * local ledger. Dedupe: /api/access-verify also records paid sessions on
 * redirect-back, so an order id already in the ledger is skipped, never
 * double-counted. Unknown events are acked (200, ignored) so Stripe stops
 * retrying. Missing signing secret fails closed with 503.
 */
import { readFile } from "node:fs/promises";
import {
  verifyStripeSignature,
  extractStripeSale,
  STRIPE_WEBHOOK_VERSION,
} from "./lib/stripe-webhook-verify.mjs";
import { recordSale } from "./lib/sales-ledger.mjs";

const LEDGER = () => process.env.SALES_LEDGER_PATH || "/data/sales.jsonl";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function alreadyRecorded(orderId) {
  try {
    const text = await readFile(LEDGER(), "utf8");
    return text.includes(`"order_id":${JSON.stringify(String(orderId))}`);
  } catch {
    return false; // no ledger yet (or unreadable): record, don't drop revenue
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "post_only" });
  const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
  if (!secret) return json(res, 503, { ok: false, error: "webhook_not_configured" });
  const raw = req.rawBody !== undefined ? req.rawBody : req.body;
  const v = verifyStripeSignature(raw, req.headers["stripe-signature"], secret);
  if (!v.ok) return json(res, 400, { ok: false, error: "bad_signature", reason: v.reason });
  let event;
  try {
    const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw ?? "{}");
    event = JSON.parse(text || "{}");
  } catch {
    return json(res, 400, { ok: false, error: "bad_json" });
  }
  const out = extractStripeSale(event);
  if (out.ignored) {
    return json(res, 200, { ok: true, version: STRIPE_WEBHOOK_VERSION, ignored: true, reason: out.reason });
  }
  const { sale } = out;
  if (!sale.orderId) return json(res, 200, { ok: true, ignored: true, reason: "no_order_id" });
  if (await alreadyRecorded(sale.orderId)) {
    return json(res, 200, { ok: true, duplicate: true, order_id: sale.orderId });
  }
  const r = await recordSale(sale);
  if (!r.ok) return json(res, 500, { ok: false, error: "ledger_write_failed" });
  return json(res, 200, { ok: true, recorded: true, order_id: sale.orderId, sku: sale.sku });
}
