/**
 * GA4 Measurement Protocol purchase reporting — server-side, ad-blocker-proof.
 * Fires on verified-paid only (Stripe payment_status paid, x402 claim accepted).
 * Skips silently when GA4_API_SECRET is unset. Never throws into the request.
 * Identity is SHA-256 of the order/session id (no PII, never email).
 * transaction_id is the order/session id, so repeated verifies share one id.
 */
import { createHash } from "node:crypto";

const MEASUREMENT_ID = process.env.GA4_MEASUREMENT_ID || "G-R1T6T582B6";

export function clientIdFor(orderId) {
  return createHash("sha256").update(String(orderId)).digest("hex");
}

export function purchasePayload({ sku, amountCents, currency, transactionId, clientId }) {
  const value = Math.round(Number(amountCents) || 0) / 100;
  return {
    client_id: clientId,
    events: [
      {
        name: "purchase",
        params: {
          transaction_id: String(transactionId),
          currency: String(currency || "usd").toLowerCase(),
          value,
          items: [{ item_id: String(sku || "unknown"), price: value, quantity: 1 }],
        },
      },
    ],
  };
}

export async function reportPurchase({ sku, amountCents, currency, orderId }) {
  const secret = process.env.GA4_API_SECRET || "";
  if (!secret || !orderId) return { skipped: true };
  const client_id = clientIdFor(orderId);
  const body = purchasePayload({ sku, amountCents, currency, transactionId: orderId, clientId: client_id });
  try {
    const r = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${MEASUREMENT_ID}&api_secret=${encodeURIComponent(secret)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(3500),
      }
    );
    return { ok: r.ok, status: r.status };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}
