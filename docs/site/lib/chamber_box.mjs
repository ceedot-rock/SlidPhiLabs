/**
 * Chamber black box — φ-split + AES-256-GCM.
 * Shares alone are useless. Open once. Serve the open bytes.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const PHI = (1 + Math.sqrt(5)) / 2;

function mixIndex(i, n) {
  return Math.floor(i * PHI) % n;
}

export function phiSplit(key) {
  const a = randomBytes(key.length);
  const b = Buffer.alloc(key.length);
  for (let i = 0; i < key.length; i++) b[i] = key[i] ^ a[mixIndex(i, key.length)];
  return { a, b };
}

export function phiJoin(a, b) {
  const key = Buffer.alloc(a.length);
  for (let i = 0; i < a.length; i++) key[i] = b[i] ^ a[mixIndex(i, a.length)];
  return key;
}

export function cloak(plain) {
  const key = randomBytes(32);
  const shares = phiSplit(key);
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(plain), c.final()]);
  const tag = c.getAuthTag();
  return { iv, tag, ct, shares };
}

export function open(sealed) {
  const key = phiJoin(sealed.shares.a, sealed.shares.b);
  const d = createDecipheriv("aes-256-gcm", key, sealed.iv);
  d.setAuthTag(sealed.tag);
  return Buffer.concat([d.update(sealed.ct), d.final()]);
}
