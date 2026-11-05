/**
 * GitDepot receipts — per-op storage receipts with deterministic offline quotes.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Pure: no disk, no network. All I/O (pricing) goes through an injectable
 * priceFn adapter. Fail-closed: malformed input returns null / ok:false,
 * never a half-filled receipt.
 *
 * Default pricing (offline, deterministic): free tier covers 1 team, 3 seats,
 * 10 GB pooled. Overage is $0.10/GB (10 cents per 1e9 bytes), rounded up per
 * receipt on bytes above FREE_BYTES. quoted_cents is the marginal overage
 * quote for this receipt's bytes treated standalone.
 */
import { createHash } from "node:crypto";

export const DEPOT_SURFACE = "gitdepot";
export const DEPOT_OPS = ["publish", "evict", "join"];
export const DEPOT_FREE_BYTES = 10_000_000_000;
export const DEPOT_OVERAGE_CENTS_PER_GB = 10;
export const DEPOT_BYTES_PER_GB = 1_000_000_000;

function text(v) {
  return v == null ? "" : String(v);
}

function validSha(v) {
  return /^[0-9a-f]{64}$/.test(text(v));
}

function validBytes(v) {
  return Number.isSafeInteger(v) && v >= 0;
}

/** Default offline price: marginal overage quote for one receipt's bytes. */
export function defaultDepotPrice(bytes) {
  if (!validBytes(bytes)) return 0;
  const over = bytes - DEPOT_FREE_BYTES;
  if (over <= 0) return 0;
  return Math.ceil(over / DEPOT_BYTES_PER_GB) * DEPOT_OVERAGE_CENTS_PER_GB;
}

function teamSha(team) {
  return createHash("sha256").update(text(team), "utf8").digest("hex");
}

/**
 * Build one depot receipt. Unknown op / bad team / bad sha / bad bytes
 * -> null (fail-closed). priceFn(bytes) => integer cents; defaults offline.
 */
export function buildDepotReceipt(input, opts = {}) {
  if (!input || typeof input !== "object") return null;
  const { op, team, sha256, bytes } = input;
  if (!DEPOT_OPS.includes(op)) return null;
  if (!text(team)) return null;
  if (!validSha(sha256)) return null;
  if (!validBytes(bytes)) return null;
  const priceFn =
    typeof opts.priceFn === "function" ? opts.priceFn : defaultDepotPrice;
  let quoted_cents;
  try {
    quoted_cents = priceFn(bytes);
  } catch {
    return null;
  }
  if (!Number.isSafeInteger(quoted_cents) || quoted_cents < 0) return null;
  return {
    surface: DEPOT_SURFACE,
    op,
    team_sha: teamSha(team),
    blob_sha256: text(sha256),
    bytes,
    quoted_cents,
  };
}

/**
 * Recompute a receipt. With opts.team, also rebinds team_sha; always
 * revalidates shape and recomputes quoted_cents via priceFn (default offline).
 * Returns { ok:true } or { ok:false, reason } — never throws on data.
 */
export function verifyDepotReceipt(receipt, opts = {}) {
  if (!receipt || typeof receipt !== "object")
    return { ok: false, reason: "not-an-object" };
  const { surface, op, team_sha, blob_sha256, bytes, quoted_cents } = receipt;
  if (surface !== DEPOT_SURFACE) return { ok: false, reason: "bad-surface" };
  if (!DEPOT_OPS.includes(op)) return { ok: false, reason: "bad-op" };
  if (!validSha(blob_sha256)) return { ok: false, reason: "bad-sha" };
  if (!validSha(team_sha)) return { ok: false, reason: "bad-team-sha" };
  if (!validBytes(bytes)) return { ok: false, reason: "bad-bytes" };
  if (!Number.isSafeInteger(quoted_cents) || quoted_cents < 0)
    return { ok: false, reason: "bad-quote" };
  if (opts.team != null) {
    if (!text(opts.team)) return { ok: false, reason: "bad-team" };
    if (teamSha(opts.team) !== team_sha)
      return { ok: false, reason: "team-mismatch" };
  }
  const priceFn =
    typeof opts.priceFn === "function" ? opts.priceFn : defaultDepotPrice;
  let expected;
  try {
    expected = priceFn(bytes);
  } catch {
    return { ok: false, reason: "price-failed" };
  }
  if (expected !== quoted_cents) return { ok: false, reason: "quote-mismatch" };
  return { ok: true };
}
