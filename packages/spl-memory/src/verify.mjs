// verifyMemoryExport(envelope, trustPolicy) -> { authentic, reason?, payload?, key_id, alg, ageMs }
//
// Verifies the ES256 signature over the JCS signing input. Structural checks
// only — signature validity is independent of schema/kind support, so an
// envelope with an unsupported item kind can still verify (import decides
// per-item acceptance). Authenticity is reported separately from freshness:
// ageMs = now - signed_at; an archival export never "expires" because a
// transport credential did.
//
// The verifier NEVER fetches a key URL. Unknown key_id -> UNKNOWN_KEY.
// Removed-from-policy keys -> KEY_NOT_TRUSTED (explicit, not silent).

import { CODES } from './errors.mjs';
import { canonicalize } from './canonical.mjs';
import { FORMAT, VERSION } from './schema.mjs';
import { verify } from './keys.mjs';
import { SIGNING_DOMAIN, PROOF_FORMAT } from './export.mjs';

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Normalize the caller-supplied trust policy to a list of { key_id, publicKey }. */
export function normalizeTrustPolicy(policy) {
  if (Array.isArray(policy)) return policy;
  if (isPlainObject(policy)) {
    if (Array.isArray(policy[SIGNING_DOMAIN])) return policy[SIGNING_DOMAIN];
    if (typeof policy.key_id === 'string' && policy.publicKey !== undefined) return [policy];
  }
  return null;
}

/**
 * @param {object} envelope { payload, proof }
 * @param {object|array} trustPolicy caller-supplied; see SPEC section 2.
 * @param {object} opts { now?: epoch ms }
 */
export function verifyMemoryExport(envelope, trustPolicy, opts = {}) {
  const now = opts.now ?? Date.now();
  const no = (reason) => ({ authentic: false, reason, payload: undefined, key_id: undefined, alg: undefined, ageMs: undefined });

  if (!isPlainObject(envelope) || !isPlainObject(envelope.payload) || !isPlainObject(envelope.proof)) {
    return no(CODES.MALFORMED);
  }
  const { payload, proof } = envelope;

  if (payload.format !== FORMAT) return no(CODES.UNKNOWN_FORMAT);
  if (payload.version !== VERSION) return no(CODES.UNKNOWN_VERSION);
  if (proof.format !== PROOF_FORMAT || proof.version !== VERSION) return no(CODES.INVALID_PROOF);
  if (proof.alg !== 'ES256') return no(CODES.UNSUPPORTED_ALG); // no algorithm agility in v1
  if (typeof proof.key_id !== 'string' || !proof.key_id) return no(CODES.INVALID_PROOF);
  if (typeof proof.signature !== 'string' || !proof.signature) return no(CODES.INVALID_PROOF);

  const entries = normalizeTrustPolicy(trustPolicy);
  if (!entries) return no(CODES.INVALID_TRUST_POLICY);
  const entry = entries.find((e) => e && e.key_id === proof.key_id);
  if (!entry || entry.publicKey === undefined) {
    // Explicit compromise signal: callers may list removed keys in
    // policy.revoked_key_ids so history verifies as KEY_NOT_TRUSTED
    // (explicit) rather than UNKNOWN_KEY (ambiguous).
    const revoked = isPlainObject(trustPolicy) && Array.isArray(trustPolicy.revoked_key_ids)
      ? trustPolicy.revoked_key_ids
      : [];
    return no(revoked.includes(proof.key_id) ? CODES.KEY_NOT_TRUSTED : CODES.UNKNOWN_KEY);
  }

  // Recompute the exact signed bytes from the payload (proof metadata is
  // descriptive only — the signature binds key_id/alg/domain/payload).
  let signingInput;
  try {
    signingInput = canonicalize({ domain: SIGNING_DOMAIN, alg: 'ES256', key_id: proof.key_id, payload });
  } catch {
    return no(CODES.MALFORMED);
  }
  let okSig = false;
  try {
    okSig = verify(entry.publicKey, Buffer.from(signingInput, 'utf8'), proof.signature);
  } catch {
    okSig = false;
  }
  if (!okSig) {
    // Distinguish "key listed but unusable / removed" from bad signature:
    // a listed-but-unparseable key is a policy configuration problem, but
    // for verification purposes the export is simply not trusted.
    return no(CODES.INVALID_SIGNATURE);
  }

  let ageMs;
  const signedMs = Date.parse(proof.signed_at);
  ageMs = Number.isFinite(signedMs) ? now - signedMs : undefined;

  return { authentic: true, reason: undefined, payload, key_id: proof.key_id, alg: 'ES256', ageMs };
}

/**
 * Compromise response: remove a key from a trust policy and record it in
 * `revoked_key_ids`. Returns a new policy object; exports previously signed
 * under that key then verify as KEY_NOT_TRUSTED — explicit, not silent.
 * (Helper; policies are caller-owned.)
 */
export function revokeKeyFromPolicy(policy, keyId) {
  const entries = normalizeTrustPolicy(policy);
  if (!entries) throw new TypeError('revokeKeyFromPolicy: invalid trust policy');
  const rest = entries.filter((e) => e.key_id !== keyId);
  if (Array.isArray(policy)) {
    return { [SIGNING_DOMAIN]: rest, revoked_key_ids: [keyId] };
  }
  const revoked = Array.isArray(policy.revoked_key_ids) ? policy.revoked_key_ids : [];
  return { ...policy, [SIGNING_DOMAIN]: rest, revoked_key_ids: [...new Set([...revoked, keyId])] };
}
