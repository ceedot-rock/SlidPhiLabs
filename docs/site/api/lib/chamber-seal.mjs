/**
 * Chamber seal — two-key JSON seal stage for ACN runs.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Seal run artifacts so only both-key holders open them; opening is free
 * forever once both keys meet. AES-256-GCM over deflated JSON, own envelope
 * magic, digest-bound. Pure: no disk, no network. Fail-closed: bad input
 * seals to null and opens to { ok:false, reason }, never a half envelope.
 * Keys arrive via opts only and are never echoed back in envelopes.
 */
import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { deflateSync, inflateSync } from "node:zlib";

export const CHAMBER_MAGIC = "ACNCH1";
export const CHAMBER_SEAL_VERSION = "0.1.0";
export const CHAMBER_MIN_BYTES = 8;
export const CHAMBER_MAX_BYTES = 12_000_000;

function validKeyHex(v) {
  return typeof v === "string" && /^[0-9a-fA-F]{64}$/.test(v);
}

function b64enc(buf) {
  return Buffer.from(buf).toString("base64");
}

function b64decStrict(s) {
  if (typeof s !== "string" || s.length % 4 !== 0) return null;
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) return null;
  try {
    return Buffer.from(s, "base64");
  } catch {
    return null;
  }
}

function sha256hex(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Seal any JSON-serializable value. Returns the envelope, or null when the
 * key is bad, the value is not serializable, or the payload is out of range.
 */
export function sealEnvelope(obj, opts = {}) {
  const keyHex = opts ? opts.keyHex : null;
  if (!validKeyHex(keyHex)) return null;
  let raw;
  try {
    const text = JSON.stringify(obj);
    if (text === undefined) return null;
    raw = Buffer.from(text, "utf8");
  } catch {
    return null;
  }
  if (raw.byteLength < CHAMBER_MIN_BYTES || raw.byteLength > CHAMBER_MAX_BYTES) {
    return null;
  }
  const packed = deflateSync(raw, { level: 9 });
  const compressed = packed.byteLength < raw.byteLength;
  const body = compressed ? packed : raw;
  const key = Buffer.from(keyHex, "hex");
  const iv = randomBytes(12);
  let ct;
  let tag;
  try {
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    ct = Buffer.concat([cipher.update(body), cipher.final()]);
    tag = cipher.getAuthTag();
  } catch {
    return null;
  }
  return {
    magic: CHAMBER_MAGIC,
    v: 1,
    compressed,
    iv: b64enc(iv),
    ct: b64enc(ct),
    tag: b64enc(tag),
    sha256: sha256hex(raw),
  };
}

/**
 * Open a sealed envelope. Returns { ok:true, obj } or
 * { ok:false, reason } — wrong keys, tampering, and bad shapes all refuse.
 */
export function openEnvelope(env, opts = {}) {
  if (!env || typeof env !== "object") return { ok: false, reason: "not-an-object" };
  if (env.magic !== CHAMBER_MAGIC) return { ok: false, reason: "bad-magic" };
  if (env.v !== 1) return { ok: false, reason: "bad-version" };
  const keyHex = opts ? opts.keyHex : null;
  if (!validKeyHex(keyHex)) return { ok: false, reason: "bad-key" };
  const iv = b64decStrict(env.iv);
  const ct = b64decStrict(env.ct);
  const tag = b64decStrict(env.tag);
  if (!iv || iv.byteLength !== 12) return { ok: false, reason: "bad-iv" };
  if (!tag || tag.byteLength !== 16) return { ok: false, reason: "bad-tag" };
  if (!ct || ct.byteLength < 1) return { ok: false, reason: "bad-body" };
  const key = Buffer.from(keyHex, "hex");
  let body;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    body = Buffer.concat([decipher.update(ct), decipher.final()]);
  } catch {
    return { ok: false, reason: "auth-failed" };
  }
  let raw;
  try {
    raw = env.compressed === true ? Buffer.from(inflateSync(body)) : body;
  } catch {
    return { ok: false, reason: "decompress-failed" };
  }
  if (typeof env.sha256 === "string" && env.sha256 !== sha256hex(raw)) {
    return { ok: false, reason: "digest-mismatch" };
  }
  let obj;
  try {
    obj = JSON.parse(raw.toString("utf8"));
  } catch {
    return { ok: false, reason: "bad-payload" };
  }
  return { ok: true, obj };
}
