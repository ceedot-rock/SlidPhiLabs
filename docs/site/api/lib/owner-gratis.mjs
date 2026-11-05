/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * Owner-gratis lane: Corey's known emails (and his human seat) never pay.
 *
 * RULES
 * - Email match is normalized (trim + lowercase). Agent match is exact.
 * - Gratis is always RECORDED (gratis:"owner" on claims/entitlements/records),
 *   never silent — the ledger must show what the owner took for free.
 * - Two lanes: SIGNED-CLAIM (verified) and SELF-ASSERTED (operator-only).
 *   Routes that move value or mint entitlements MUST use the signed-claim
 *   lane: the owner email must come from an HMAC-verified claim token
 *   (see resolveOwnerLane + lib/claim-seat.mjs seatFromClaimHeader, the
 *   same check lib/usage-meter.mjs ownerFromReq uses). A raw email string
 *   from a request body is SELF-ASSERTED: anyone can type an address, so
 *   it authenticates nothing. The self-asserted lane is operator-only —
 *   kept for the existing shop-door flow where abuse is attributable
 *   (email + claim + ops log), not prevented. Do not use the self-asserted
 *   lane to gate anything irrevocable.
 */
export const OWNER_EMAILS = [
  "corey@slidphilabs.com",
  "ceedotrock@gmail.com",
  "ptasz13@hotmail.com",
];

/** Corey's human Rider seat (type human, operator corey). Lab worker seats
 *  are deliberately NOT here — workers stay metered so PSI keeps score. */
export const OWNER_AGENT_IDS = ["2742251400a7dfcd"];

export function normEmail(e) {
  return String(e || "").trim().toLowerCase();
}

export function isOwnerEmail(email) {
  return OWNER_EMAILS.includes(normEmail(email));
}

export function isOwnerAgent(agentId) {
  return !!agentId && OWNER_AGENT_IDS.includes(String(agentId));
}

/**
 * Resolve the owner lane for one request. Fail-closed envelopes throughout.
 * @param {object} [input] { email?, verifiedEmail? } — email is a raw
 *   self-asserted string; verifiedEmail must come from an HMAC-verified
 *   claim (e.g. seatFromClaimHeader(req).payload.email), never from the
 *   request body. The verifier is injectable: pass { verifyEmail } only
 *   to ADD checks, never to skip them.
 */
export function resolveOwnerLane(input = {}, opts = {}) {
  const o = input && typeof input === "object" ? input : {};
  if (opts && typeof opts === "object" && typeof opts.verifyEmail === "function") {
    let extra;
    try {
      extra = opts.verifyEmail(o.verifiedEmail);
    } catch {
      return { ok: false, error: "owner_verify_failed" };
    }
    if (!extra) return { ok: false, error: "owner_verify_failed" };
  }
  if (isOwnerEmail(o.verifiedEmail)) {
    return { ok: true, gratis: true, via: "signed-claim", email: normEmail(o.verifiedEmail) };
  }
  if (isOwnerEmail(o.email)) {
    return {
      ok: true,
      gratis: true,
      via: "self-asserted",
      email: normEmail(o.email),
      warning: "operator-only-attributable",
    };
  }
  return { ok: true, gratis: false, via: "none" };
}
