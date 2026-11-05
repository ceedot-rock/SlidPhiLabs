/**
 * Local sales ledger: every verified-paid purchase appended as one JSON line.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * Amounts are validated with the shared fail-closed checker: a bad amount
 * fails closed ({ ok:false, error:"bad_amount" }) instead of coercing to $0.
 * Needs no third party, no secret, no user action — the server already sees
 * every paid verification (Stripe + x402), so it writes its own receipt book.
 * Totals: fly ssh console --app slidphilabs -C "cat /data/sales.jsonl".
 * No PII: sku, amounts, order id, rail, timestamp only — never email.
 */
import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { checkAmountCents } from "./failclosed-store.mjs";

const LEDGER = process.env.SALES_LEDGER_PATH || "/data/sales.jsonl";

export function saleLine({ sku, amountCents, currency, orderId, rail, at }) {
  const checked = checkAmountCents(amountCents);
  if (!checked.ok) throw new Error("bad_amount"); // fail closed: never emit a $0 line for a bad amount
  return JSON.stringify({
    at: at || new Date().toISOString(),
    sku: String(sku || "unknown"),
    amount_cents: checked.cents,
    currency: String(currency || "usd").toLowerCase(),
    order_id: String(orderId),
    rail: String(rail || "unknown"),
  });
}

export async function recordSale(entry) {
  if (!entry || !entry.orderId) return { skipped: true };
  if (!checkAmountCents(entry.amountCents).ok) return { ok: false, error: "bad_amount" };
  try {
    await mkdir(dirname(LEDGER), { recursive: true });
    await appendFile(LEDGER, saleLine(entry) + "\n", "utf8");
    return { ok: true, path: LEDGER };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}
