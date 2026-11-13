/**
 * Local sales ledger: every verified-paid purchase appended as one JSON line.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * Amounts are validated with the shared fail-closed checker: a bad amount
 * fails closed ({ ok:false, error:"bad_amount" }) instead of coercing to $0.
 * Needs no third party, no secret, no user action — the server already sees
 * every paid verification (Stripe + x402), so it writes its own receipt book.
 * Totals: fly ssh console --app slidphilabs -C "cat /data/sales.jsonl".
 * No PII: sku, amounts, order id, rail, timestamp only — never email.
 *
 * The ledger path resolves at call time from SALES_LEDGER_PATH so tests and
 * failure-injection can repoint it without re-importing. See LAB50 step 19.
 */
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { checkAmountCents } from "./failclosed-store.mjs";

const ledgerPath = () => process.env.SALES_LEDGER_PATH || "/data/sales.jsonl";

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
  const path = ledgerPath();
  try {
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, saleLine(entry) + "\n", "utf8");
    return { ok: true, path };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

/**
 * True when orderId already has a line. A missing ledger means "not yet"
 * (false). Any other read failure THROWS ledger_unreadable — callers must
 * answer 5xx without writing, never assume "not recorded" (that path
 * double-records sales). See LAB50 step 19.
 */
export async function hasOrderId(orderId) {
  try {
    const text = await readFile(ledgerPath(), "utf8");
    return text.includes(`"order_id":${JSON.stringify(String(orderId))}`);
  } catch (e) {
    if (e && e.code === "ENOENT") return false;
    throw new Error("ledger_unreadable");
  }
}

/**
 * Best-effort audit line for webhook events we ack without recording
 * (ignored types, missing order id). Lives next to the ledger, never in
 * it — money totals stay pure sales. Never throws; the ack is contractual.
 */
export async function auditWebhookIgnored(entry) {
  try {
    const line = JSON.stringify({
      at: new Date().toISOString(),
      kind: "webhook_ignored",
      ...(entry && typeof entry === "object" ? entry : {}),
    });
    const dir = dirname(ledgerPath());
    await mkdir(dir, { recursive: true });
    await appendFile(join(dir, "webhook-audit.jsonl"), line + "\n", "utf8");
    return { ok: true };
  } catch {
    return { ok: false, error: "audit_write_failed" };
  }
}
