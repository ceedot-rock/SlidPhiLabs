/**
 * Chamber fixture seal for OFA CI.
 * Stitch-integrity path (no device AES) — keys optional; fixture mode always works.
 * Pattern mirrors packages/sim-arl/src/chamber.ts (CHMB1).
 */
import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { deflateSync, inflateSync } from "node:zlib";

export const MAGIC = "CHMB1";
const APP_SALT = "ofa-chamber-splabs-v1";
const FIXTURE_KEY_HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function te() {
  return new TextEncoder();
}
function td() {
  return new TextDecoder();
}

function b64enc(buf) {
  return Buffer.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).toString("base64");
}
function b64dec(s) {
  return new Uint8Array(Buffer.from(s, "base64"));
}

function sha256(data) {
  return new Uint8Array(createHash("sha256").update(Buffer.from(data)).digest());
}

function policyRelease(meta, bytes) {
  if (meta.magic !== MAGIC) return { ok: false, reason: "bad magic" };
  if (meta.v !== 1) return { ok: false, reason: "unsupported version" };
  if (meta.policy !== "local-career" && meta.policy !== "ofa-fixture") {
    return { ok: false, reason: "policy deny" };
  }
  if (bytes > 12_000_000) return { ok: false, reason: "payload too large" };
  if (bytes < 8) return { ok: false, reason: "payload too small" };
  return { ok: true };
}

/**
 * @param {unknown} obj
 * @param {{ mode?: "fixture" | "encrypt"; keyHex?: string }} [opts]
 */
export function chamberSeal(obj, opts = {}) {
  const mode = opts.mode || (opts.keyHex || process.env.OFA_CHAMBER_KEY ? "encrypt" : "fixture");
  const raw = te().encode(JSON.stringify(obj));
  const packed = deflateSync(raw, { level: 9 });
  const compressed = packed.byteLength < raw.byteLength;
  const bodyPlain = compressed ? packed : raw;

  if (mode === "encrypt") {
    const keyHex = opts.keyHex || process.env.OFA_CHAMBER_KEY || FIXTURE_KEY_HEX;
    const key = Buffer.from(keyHex, "hex");
    if (key.length !== 32) throw new Error("CHAMBER: key must be 32 bytes hex");
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ct = Buffer.concat([cipher.update(Buffer.from(bodyPlain)), cipher.final()]);
    const tag = cipher.getAuthTag();
    const body = new Uint8Array(Buffer.concat([ct, tag]));
    const stitch = sha256(te().encode(MAGIC + APP_SALT + b64enc(iv) + b64enc(body) + String(compressed) + "true"));
    return {
      magic: MAGIC,
      v: 1,
      meta: {
        magic: MAGIC,
        v: 1,
        createdAt: "1970-01-01T00:00:00.000Z",
        bytesIn: raw.byteLength,
        bytesOut: body.byteLength,
        compressed,
        encrypted: true,
        mirrorOk: stitch.length === 32,
        policy: "ofa-fixture",
      },
      body: b64enc(body),
      iv: b64enc(iv),
      stitch: b64enc(stitch),
    };
  }

  const stitch = sha256(te().encode(MAGIC + APP_SALT + b64enc(bodyPlain) + String(compressed) + "false"));
  return {
    magic: MAGIC,
    v: 1,
    meta: {
      magic: MAGIC,
      v: 1,
      createdAt: "1970-01-01T00:00:00.000Z",
      bytesIn: raw.byteLength,
      bytesOut: bodyPlain.byteLength,
      compressed,
      encrypted: false,
      mirrorOk: stitch.length === 32,
      policy: "ofa-fixture",
    },
    body: b64enc(bodyPlain),
    stitch: b64enc(stitch),
  };
}

/**
 * @param {ReturnType<typeof chamberSeal>} seal
 * @param {{ keyHex?: string }} [opts]
 */
export function chamberUnseal(seal, opts = {}) {
  if (!seal || seal.magic !== MAGIC) throw new Error("CHAMBER HALT: bad magic");
  const bodyBytes = b64dec(seal.body);
  const pol = policyRelease(seal.meta, bodyBytes.byteLength);
  if (!pol.ok) throw new Error(`CHAMBER HALT: ${pol.reason}`);

  if (seal.meta.encrypted) {
    const keyHex = opts.keyHex || process.env.OFA_CHAMBER_KEY || FIXTURE_KEY_HEX;
    const key = Buffer.from(keyHex, "hex");
    const iv = Buffer.from(b64dec(seal.iv));
    const expect = sha256(
      te().encode(MAGIC + APP_SALT + seal.iv + seal.body + String(seal.meta.compressed) + "true"),
    );
    const got = b64dec(seal.stitch);
    if (expect.length !== got.length || !expect.every((b, i) => b === got[i])) {
      throw new Error("CHAMBER HALT: stitch integrity fail");
    }
    const tag = Buffer.from(bodyBytes.subarray(bodyBytes.length - 16));
    const ct = Buffer.from(bodyBytes.subarray(0, bodyBytes.length - 16));
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    let packed = new Uint8Array(Buffer.concat([decipher.update(ct), decipher.final()]));
    if (seal.meta.compressed) packed = inflateSync(packed);
    return JSON.parse(td().decode(packed));
  }

  const expect = sha256(
    te().encode(MAGIC + APP_SALT + seal.body + String(seal.meta.compressed) + String(seal.meta.encrypted)),
  );
  const got = b64dec(seal.stitch);
  if (expect.length !== got.length || !expect.every((b, i) => b === got[i])) {
    throw new Error("CHAMBER HALT: stitch integrity fail");
  }
  let packed = bodyBytes;
  if (seal.meta.compressed) packed = inflateSync(packed);
  return JSON.parse(td().decode(packed));
}
