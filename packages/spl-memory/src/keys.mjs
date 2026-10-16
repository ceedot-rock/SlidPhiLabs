// ES256 (ECDSA P-256 + SHA-256) via node:crypto. Signatures are the raw
// 64-byte r||s (IEEE P1363) encoding, transported as base64url — the same
// shape the Rider ecosystem uses. Zero dependencies.

import { generateKeyPairSync, createSign, createVerify, createPublicKey, createPrivateKey } from 'node:crypto';

/** Generate a fresh P-256 keypair. Returns { privateKey, publicKey, privateJwk, publicJwk }. */
export function generateKeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return {
    privateKey,
    publicKey,
    privateJwk: privateKey.export({ format: 'jwk' }),
    publicJwk: publicKey.export({ format: 'jwk' }),
  };
}

/** Normalize a private key given as KeyObject, JWK object, or PEM string. */
export function privateKeyFrom(v) {
  if (v && typeof v === 'object' && v.asymmetricKeyType) return v; // KeyObject
  if (typeof v === 'string' && v.includes('PRIVATE KEY')) return createPrivateKey(v);
  if (v && typeof v === 'object' && v.kty) return createPrivateKey({ key: v, format: 'jwk' });
  throw new TypeError('keys: unrecognized private key material');
}

/** Normalize a public key given as KeyObject, JWK object, JWK JSON string, or PEM string. */
export function publicKeyFrom(v) {
  if (v && typeof v === 'object' && v.asymmetricKeyType) return v; // KeyObject
  if (typeof v === 'string') {
    const t = v.trim();
    if (t.startsWith('-----BEGIN')) return createPublicKey(t);
    try {
      const j = JSON.parse(t);
      if (j && j.kty) return createPublicKey({ key: j, format: 'jwk' });
    } catch { /* fall through */ }
  }
  if (v && typeof v === 'object' && v.kty) return createPublicKey({ key: v, format: 'jwk' });
  throw new TypeError('keys: unrecognized public key material (want JWK or PEM)');
}

/**
 * Sign bytes with ES256. `privateKey` may be a KeyObject, JWK, or PEM.
 * Returns base64url of the raw 64-byte r||s signature.
 */
export function sign(privateKey, bytes) {
  const key = privateKeyFrom(privateKey);
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const sig = createSign('sha256').update(buf).sign({ key, dsaEncoding: 'ieee-p1363' });
  return sig.toString('base64url');
}

/**
 * Verify an ES256 signature. `publicKey` may be a KeyObject, JWK, or PEM.
 * `sigB64u` is base64url of raw r||s. Returns boolean (never throws on
 * bad signature input — returns false).
 */
export function verify(publicKey, bytes, sigB64u) {
  let key;
  try {
    key = publicKeyFrom(publicKey);
  } catch {
    return false;
  }
  let sig;
  try {
    sig = Buffer.from(String(sigB64u), 'base64url');
  } catch {
    return false;
  }
  if (sig.length !== 64) return false;
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  try {
    return createVerify('sha256').update(buf).verify({ key, dsaEncoding: 'ieee-p1363' }, sig);
  } catch {
    return false;
  }
}
