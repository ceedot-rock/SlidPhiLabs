/**
 * Agent license bridge: an x402 claim token doubles as the API credential.
 *
 * Agents buy a seat machine-to-machine via POST /api/x402-products and receive
 * a claim_token (spl1.…). The npm clients send it as `apiKey`, which arrives
 * here as `Authorization: Bearer spl1.…`. This helper verifies the claim
 * (same HMAC + expiry check /api/access-verify uses) and stamps the paid-seat
 * headers the usage meter already understands, so the request meters against
 * the seat's included bytes instead of the anonymous free tier.
 *
 * Behavior:
 * - No Bearer spl1 token  -> { ok:false, reason:"no_claim" }; caller proceeds
 *   exactly as before (free tier / box cookie / IP identity).
 * - Valid spl1 token      -> headers stamped, { ok:true, sku, seatId }.
 * - spl1 token present but invalid/expired -> { ok:false, tokenPresent:true };
 *   caller should 401 with a plain message, not silently downgrade the agent
 *   to the free tier (that would look like a paid seat and meter wrong).
 * - Any other Bearer value -> ignored, exactly as today (forward-compat).
 *
 * No new secrets, no database: verification is stateless HMAC.
 */
import { verifyClaim } from "./x402-claim.mjs";

const CLAIM_RE = /^Bearer\s+(spl1\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)\s*$/;

export function seatFromClaimHeader(req) {
  const h = (req && req.headers) || {};
  const auth = String(h.authorization || h.Authorization || "");
  if (!auth) return { ok: false, reason: "no_claim" };
  const m = CLAIM_RE.exec(auth);
  if (!m) {
    // Present but not one of ours (or not a claim at all): not our business.
    const looksClaim = /^Bearer\s+spl1\./i.test(auth);
    return looksClaim
      ? { ok: false, reason: "claim_malformed", tokenPresent: true }
      : { ok: false, reason: "no_claim" };
  }
  const v = verifyClaim(m[1]);
  if (!v.ok) return { ok: false, reason: v.error, tokenPresent: true };
  const sku = String((v.payload && v.payload.sku) || "").toLowerCase();
  const seatId = String(
    (v.payload && (v.payload.order_id || v.payload.tx)) || "claim"
  );
  return { ok: true, sku, seatId, payload: v.payload };
}

export function applyClaimSeat(req) {
  const r = seatFromClaimHeader(req);
  if (!r.ok || !req.headers) return r;
  try {
    req.headers["x-spl-seat"] = r.sku;
    req.headers["x-spl-seat-id"] = r.seatId;
  } catch {
    return { ok: false, reason: "header_stamp_failed", tokenPresent: true };
  }
  return r;
}

/** Plain-English 401 body for a bad/expired claim. */
export function claimAuthError(reason) {
  const hints = {
    claim_malformed: "That claim token is malformed.",
    claim_bad_sig: "That claim token failed signature check.",
    claim_bad_payload: "That claim token has an unreadable payload.",
    claim_bad_version: "That claim token is the wrong version.",
    claim_expired: "That claim token expired (claims live 45 days).",
    claim_secret_missing: "Claim verification is not configured on this host.",
    header_stamp_failed: "Could not attach your seat to this request.",
  };
  return {
    ok: false,
    error: "invalid_claim",
    reason,
    message:
      (hints[reason] || "That claim token is not valid.") +
      " Buy a fresh seat: POST /api/x402-products {\"sku\":\"gc-day\"} -> 402 -> pay USDC -> claim_token.",
  };
}
