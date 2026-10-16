// Rider credential verification seam.
//
// The library authenticates Rider credentials through the existing Rider
// verify path. By default that is a network call to the live verifier
// (same path docs/site/api/lib/warrant.mjs uses); callers MUST inject a
// mock/stub `verify` for tests or offline use. Verification is fail-closed:
// anything unparseable or unreachable -> not authenticated.
//
// verifyRiderCredential(credential, opts) -> { ok, claims?, code?, detail? }
//   credential: the rider JWT string (or an already-parsed claims object
//     when opts.claims is provided — test seam).
//   opts.verify: async (credential) -> { ok, agent_id, operator_id, expired?, revoked?, ... }
//   opts.now: epoch ms.

import { CODES } from './errors.mjs';

const DEFAULT_VERIFY_URL = 'https://agentrider.fly.dev/api/rider/verify';

async function defaultVerify(credential) {
  let res;
  try {
    res = await fetch(DEFAULT_VERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ credential }),
    });
  } catch (e) {
    return { ok: false, code: CODES.RIDER_INVALID, detail: `verifier unreachable: ${e.message}` };
  }
  let body;
  try {
    body = await res.json();
  } catch {
    return { ok: false, code: CODES.RIDER_INVALID, detail: 'verifier returned non-JSON' };
  }
  // Normalize the live verifier's shape defensively; unknown shapes fail closed.
  if (!body || typeof body !== 'object') return { ok: false, code: CODES.RIDER_INVALID, detail: 'bad verifier response' };
  if (body.ok === true || body.valid === true || body.verified === true) {
    const agent_id = body.agent_id ?? body.claims?.agent_id;
    const operator_id = body.operator_id ?? body.claims?.operator_id;
    if (!agent_id || !operator_id) return { ok: false, code: CODES.RIDER_INVALID, detail: 'verifier omitted identity claims' };
    return { ok: true, agent_id, operator_id, raw: body };
  }
  if (body.expired === true || body.code === 'RIDER_EXPIRED') {
    return { ok: false, code: CODES.RIDER_EXPIRED, detail: 'rider credential expired' };
  }
  if (body.revoked === true || body.code === 'RIDER_REVOKED') {
    return { ok: false, code: CODES.RIDER_REVOKED, detail: 'rider credential revoked' };
  }
  return { ok: false, code: CODES.RIDER_INVALID, detail: body.error || body.message || 'rider credential rejected' };
}

export async function verifyRiderCredential(credential, opts = {}) {
  const now = opts.now ?? Date.now();
  if (credential && typeof credential === 'object' && opts.claims === true) {
    // Test seam: caller vouches for already-parsed claims.
    const { agent_id, operator_id, exp, revoked } = credential;
    if (!agent_id || !operator_id) return { ok: false, code: CODES.RIDER_INVALID, detail: 'claims lack agent_id/operator_id' };
    if (revoked === true) return { ok: false, code: CODES.RIDER_REVOKED, detail: 'rider credential revoked' };
    if (typeof exp === 'number' && exp * 1000 <= now) return { ok: false, code: CODES.RIDER_EXPIRED, detail: 'rider credential expired' };
    return { ok: true, agent_id, operator_id };
  }
  if (typeof credential !== 'string' || !credential) {
    return { ok: false, code: CODES.RIDER_INVALID, detail: 'missing rider credential' };
  }
  const verify = opts.verify ?? defaultVerify;
  try {
    const r = await verify(credential);
    if (!r || typeof r !== 'object' || typeof r.ok !== 'boolean') {
      return { ok: false, code: CODES.RIDER_INVALID, detail: 'verifier returned malformed result' };
    }
    if (!r.ok) return { ok: false, code: r.code || CODES.RIDER_INVALID, detail: r.detail || 'rider credential rejected' };
    if (!r.agent_id || !r.operator_id) return { ok: false, code: CODES.RIDER_INVALID, detail: 'verifier omitted identity claims' };
    return { ok: true, agent_id: r.agent_id, operator_id: r.operator_id, raw: r.raw };
  } catch (e) {
    return { ok: false, code: CODES.RIDER_INVALID, detail: `verifier threw: ${e.message}` };
  }
}

/** True when the verified claims identify exactly the given subject. */
export function claimsMatchSubject(claims, subject) {
  return (
    claims && subject &&
    claims.agent_id === subject.agent_id &&
    claims.operator_id === subject.operator_id
  );
}
