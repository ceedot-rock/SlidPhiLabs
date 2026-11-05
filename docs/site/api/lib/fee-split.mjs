/**
 * Fee split 0.1.0 — exact-integer lab/operator revenue split schedule.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * splitSchedule({ amount_cents, lab_bps }) computes the lab share in
 * basis points with floor division and gives the REMAINDER to the
 * operator, so lab_cents + operator_cents === amount_cents exactly —
 * no dust is ever lost or created. lab_bps defaults to 250 (2.5%).
 *
 * Pure: no disk, no network, no models. Fail-closed envelopes.
 */

export const FEE_SPLIT_VERSION = "0.1.0";
export const DEFAULT_LAB_BPS = 250;
export const BPS_DENOM = 10000;
export const MAX_SPLITS = 8;

function fail(error, extra = {}) {
  return { ok: false, error, ...extra };
}

function checkBps(lab_bps) {
  const bps = Math.floor(Number(lab_bps));
  if (!Number.isSafeInteger(bps) || bps < 0 || bps > BPS_DENOM) return null;
  return bps;
}

/**
 * Split amount_cents into { lab_cents, operator_cents }.
 * lab_cents = floor(amount * lab_bps / 10000); the floor remainder goes
 * to the operator, so the parts always sum to the input exactly.
 */
export function splitSchedule({ amount_cents, lab_bps = DEFAULT_LAB_BPS } = {}) {
  const cents = Math.floor(Number(amount_cents));
  if (!Number.isSafeInteger(cents) || cents <= 0) return fail("bad_amount");
  const bps = checkBps(lab_bps);
  if (bps === null) return fail("bad_bps", { bps_denominator: BPS_DENOM });
  const lab_cents = Math.floor((cents * bps) / BPS_DENOM);
  const operator_cents = cents - lab_cents;
  return { ok: true, amount_cents: cents, lab_bps: bps, lab_cents, operator_cents };
}

/**
 * Multi-party extension: split amount_cents across [{ id, bps }] shares
 * plus the operator residual. Shares take floor divisions in order; the
 * operator receives amount minus every share, absorbing all dust.
 * Total share bps must not exceed 10000.
 */
export function splitScheduleMany({ amount_cents, splits = [] } = {}) {
  const cents = Math.floor(Number(amount_cents));
  if (!Number.isSafeInteger(cents) || cents <= 0) return fail("bad_amount");
  if (!Array.isArray(splits) || splits.length === 0) return fail("bad_splits");
  if (splits.length > MAX_SPLITS) return fail("too_many_splits", { max: MAX_SPLITS });
  let totalBps = 0;
  const parts = [];
  for (const s of splits) {
    if (!s || typeof s !== "object") return fail("bad_split");
    if (typeof s.id !== "string" || !s.id.trim()) return fail("bad_split_id");
    const bps = checkBps(s.bps);
    if (bps === null) return fail("bad_split_bps", { id: s.id });
    totalBps += bps;
    parts.push({ id: s.id, bps, cents: Math.floor((cents * bps) / BPS_DENOM) });
  }
  if (totalBps > BPS_DENOM) return fail("bps_overflow", { bps_denominator: BPS_DENOM });
  const paid = parts.reduce((n, p) => n + p.cents, 0);
  return { ok: true, amount_cents: cents, parts, operator_cents: cents - paid };
}
