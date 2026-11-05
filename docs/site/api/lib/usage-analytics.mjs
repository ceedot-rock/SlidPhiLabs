/**
 * Usage analytics 0.1.0 — per-tool / per-rider rollups from receipt streams.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * rollupUsage(receipts, { feeSchedule }) folds receipt streams into
 * { by_tool, by_rider } maps of { runs, revenue_cents, margin_cents }.
 * margin_cents = revenue_cents - fee_cents, where fee_cents comes from
 * the injectable feeSchedule(receipt) adapter. The offline default reads
 * platform_fee_cents ?? fee_cents off the receipt (0 when absent), so
 * unit tests need no pricing service. Fail-closed: a bad receipt list,
 * a bad adapter, or an adapter fault returns { ok:false, error } and
 * never a partial rollup.
 */

export const USAGE_ANALYTICS_VERSION = "0.1.0";

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function text(v) {
  return v == null ? "" : String(v);
}

function cents(v) {
  const n = Math.floor(Number(v));
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

/** Default fee schedule: platform_fee_cents ?? fee_cents, else 0. */
export function defaultFeeSchedule(receipt) {
  if (!isPlainObject(receipt)) return 0;
  return cents(receipt.platform_fee_cents ?? receipt.fee_cents);
}

function revenueOf(receipt) {
  const direct = cents(receipt.amount_cents);
  if (direct > 0) return direct;
  const usd = Number(receipt.usd);
  if (Number.isFinite(usd) && usd > 0) return cents(Math.round(usd * 100));
  return 0;
}

function toolOf(receipt) {
  return (
    text(receipt.tool || receipt.route || receipt.cmd || receipt.action || receipt.sku) ||
    "unknown"
  );
}

function riderOf(receipt) {
  return text(receipt.rider_id || receipt.rider || receipt.operator || receipt.operator_id) || "unknown";
}

function bump(map, key, revenue, fee) {
  const row = map[key] || { runs: 0, revenue_cents: 0, margin_cents: 0 };
  row.runs += 1;
  row.revenue_cents += revenue;
  row.margin_cents += revenue - fee;
  map[key] = row;
}

/**
 * Roll receipts up by tool and by rider.
 * @param {Array} receipts receipt objects (any shape; unknown -> "unknown").
 * @param {object} [opts] { feeSchedule } injectable (receipt) => fee_cents.
 */
export function rollupUsage(receipts, opts = {}) {
  if (!Array.isArray(receipts)) return { ok: false, error: "bad_receipts" };
  const o = isPlainObject(opts) ? opts : {};
  const feeSchedule = o.feeSchedule === undefined ? defaultFeeSchedule : o.feeSchedule;
  if (typeof feeSchedule !== "function") return { ok: false, error: "bad_fee_schedule" };

  const byTool = {};
  const byRider = {};
  let skipped = 0;
  for (const r of receipts) {
    if (!isPlainObject(r)) {
      skipped += 1;
      continue;
    }
    let fee;
    try {
      fee = feeSchedule(r);
    } catch {
      return { ok: false, error: "fee_failed" };
    }
    const feeCents = cents(fee);
    const revenue = revenueOf(r);
    bump(byTool, toolOf(r), revenue, feeCents);
    bump(byRider, riderOf(r), revenue, feeCents);
  }
  return { ok: true, by_tool: byTool, by_rider: byRider, receipts: receipts.length - skipped, skipped };
}
