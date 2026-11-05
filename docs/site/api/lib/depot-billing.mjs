/**
 * GitDepot monthly team invoicing — receipt log in, invoice out.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Pure: no disk, no network. The receipt log arrives either as an inline
 * array or through an injectable readReceipts({ team, month }) adapter
 * (sync or async via buildMonthlyInvoiceAsync). Fail-closed: malformed
 * input -> null, never a partial invoice.
 *
 * Math (offline, deterministic): pooled bytes sum over the month's receipts
 * for the team; pooled_gb = bytes / 1e9; overage_gb = max(0, pooled_gb - 10);
 * usage_cents = ceil(overage bytes / 1e9) * 10 ($0.10/GB). Free tier: teams
 * at <= 3 seats with zero overage owe 0. Otherwise a $15 (1500c) seat
 * minimum floors the invoice: amount_cents = max(usage_cents, 1500).
 */
import { verifyDepotReceipt } from "./depot-receipts.mjs";
import {
  DEPOT_FREE_BYTES,
  DEPOT_OVERAGE_CENTS_PER_GB,
  DEPOT_BYTES_PER_GB,
} from "./depot-receipts.mjs";

export const DEPOT_FREE_SEATS = 3;
export const DEPOT_SEAT_MINIMUM_CENTS = 1500;

function text(v) {
  return v == null ? "" : String(v);
}

function validMonth(v) {
  return /^\d{4}-\d{2}$/.test(text(v));
}

function validSeats(v) {
  return Number.isSafeInteger(v) && v >= 0;
}

function usageCents(overageBytes) {
  if (overageBytes <= 0) return 0;
  return (
    Math.ceil(overageBytes / DEPOT_BYTES_PER_GB) * DEPOT_OVERAGE_CENTS_PER_GB
  );
}

function invoiceFromBytes({ team, pooledBytes, seats }) {
  const pooled_gb = pooledBytes / DEPOT_BYTES_PER_GB;
  const overageBytes = Math.max(0, pooledBytes - DEPOT_FREE_BYTES);
  const overage_gb = overageBytes / DEPOT_BYTES_PER_GB;
  const use = usageCents(overageBytes);
  const amount_cents =
    seats <= DEPOT_FREE_SEATS && overageBytes === 0
      ? 0
      : Math.max(use, DEPOT_SEAT_MINIMUM_CENTS);
  return { team: text(team), pooled_gb, overage_gb, amount_cents };
}

function pickReceipts(input, opts) {
  if (Array.isArray(input.receipts)) return { receipts: input.receipts };
  if (typeof opts.readReceipts === "function") {
    let out;
    try {
      out = opts.readReceipts({ team: input.team, month: input.month });
    } catch {
      return { error: "reader-failed" };
    }
    if (out && typeof out.then === "function")
      return { error: "async-reader" };
    if (!Array.isArray(out)) return { error: "bad-log" };
    return { receipts: out };
  }
  return { error: "no-log" };
}

function sumPooledBytes(receipts, opts) {
  let total = 0;
  for (const r of receipts) {
    const v = verifyDepotReceipt(r, opts.verifyOpts || {});
    if (!v.ok) return { error: "bad-receipt" };
    total += r.bytes;
    if (!Number.isSafeInteger(total)) return { error: "overflow" };
  }
  return { total };
}

/**
 * Build a monthly team invoice (sync). Inputs: { team, month 'YYYY-MM',
 * receipts? } + opts { readReceipts?, seats?, verifyOpts? }.
 * Malformed input, missing log, or any invalid receipt -> null.
 */
export function buildMonthlyInvoice(input, opts = {}) {
  if (!input || typeof input !== "object") return null;
  if (!text(input.team)) return null;
  if (!validMonth(input.month)) return null;
  const seats =
    input.seats != null ? input.seats : opts.seats != null ? opts.seats : 0;
  if (!validSeats(seats)) return null;
  const picked = pickReceipts(input, opts);
  if (picked.error) return null;
  const summed = sumPooledBytes(picked.receipts, opts);
  if (summed.error) return null;
  return invoiceFromBytes({
    team: input.team,
    pooledBytes: summed.total,
    seats,
  });
}

/** Async variant: supports promise-returning readReceipts adapters. */
export async function buildMonthlyInvoiceAsync(input, opts = {}) {
  if (!input || typeof input !== "object") return null;
  if (!text(input.team)) return null;
  if (!validMonth(input.month)) return null;
  const seats =
    input.seats != null ? input.seats : opts.seats != null ? opts.seats : 0;
  if (!validSeats(seats)) return null;
  let receipts = input.receipts;
  if (receipts == null && typeof opts.readReceipts === "function") {
    try {
      receipts = await opts.readReceipts({ team: input.team, month: input.month });
    } catch {
      return null;
    }
  }
  if (!Array.isArray(receipts)) return null;
  const summed = sumPooledBytes(receipts, opts);
  if (summed.error) return null;
  return invoiceFromBytes({
    team: input.team,
    pooledBytes: summed.total,
    seats,
  });
}
