/**
 * Owner-gratis lane: Corey's known emails (and his human seat) never pay.
 *
 * RULES
 * - Email match is normalized (trim + lowercase). Agent match is exact.
 * - Gratis is always RECORDED (gratis:"owner" on claims/entitlements/records),
 *   never silent — the ledger must show what the owner took for free.
 * - Email here is SELF-ASSERTED at the shop door (same as the existing email
 *   field). Abuse is attributable (email + claim + ops log), not prevented.
 *   Do not use this module to gate anything irrevocable.
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
