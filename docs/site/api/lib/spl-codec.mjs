/**
 * SPL codec — one encode/decode for the lab rail.
 * Pick the smallest lossless path that round-trips:
 *   ZRW on zeros/ramp/walk ints · leftover LZ (rdom) · brotli-11 · gzip-9
 * Not a #1 GC claim. Gate still routes; this bake-off is what we run.
 */
import zlib from "node:zlib";
import { ZeroRangeWave, packBits, unpackBits } from "./vendor/zrw-pack.js";
import { encodeReal, decodeReal } from "./rdom-real.mjs";

export const MAGIC = Buffer.from("SPL1");
export const KIND = Object.freeze({
  zrw: 1,
  rdom: 2,
  gzip: 3,
  brotli: 4,
});
export const MAX_RAW = 1_048_576;
export const MAX_VECTOR = 4_000_000;
export const RDOM_CAP = 32_768;

function gzip9(buf) {
  return zlib.gzipSync(buf, { level: 9 });
}
function gunzip(buf) {
  return zlib.gunzipSync(buf);
}
function brotli11(buf) {
  return zlib.brotliCompressSync(buf, {
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
  });
}
function unbrotli(buf) {
  return zlib.brotliDecompressSync(buf);
}

export function asI32(buf) {
  if (!buf.length || buf.length % 4 !== 0) return null;
  const n = buf.length / 4;
  const ints = new Array(n);
  for (let i = 0; i < n; i++) ints[i] = buf.readInt32LE(i * 4);
  return ints;
}

export function fromI32(ints) {
  const b = Buffer.alloc(ints.length * 4);
  for (let i = 0; i < ints.length; i++) b.writeInt32LE(ints[i] | 0, i * 4);
  return b;
}

export function classify(buf) {
  const u8 = Buffer.from(buf);
  if (!u8.length) return { vector: "empty", path: "store" };
  let z = 0,
    texty = 0;
  for (let i = 0; i < u8.length; i++) {
    if (u8[i] === 0) z++;
    const c = u8[i];
    if ((c >= 32 && c <= 126) || c === 9 || c === 10 || c === 13) texty++;
  }
  if (z / u8.length > 0.95) return { vector: "zeros", path: "zrw" };
  const ints = asI32(u8);
  if (ints && texty / u8.length < 0.82) {
    if (ints.every((v) => v === 0)) return { vector: "zeros", path: "zrw" };
    let ramp = true;
    for (let i = 1; i < ints.length; i++) if (ints[i] !== ints[0] + i) ramp = false;
    if (ramp) return { vector: "ramp", path: "zrw" };
    let maxD = 0;
    for (let i = 1; i < Math.min(ints.length, 256); i++) {
      const d = Math.abs(ints[i] - ints[i - 1]);
      if (d > maxD) maxD = d;
    }
    if (maxD > 0 && maxD < 1000) return { vector: "walk", path: "zrw" };
  }
  return { vector: texty / u8.length > 0.82 ? "text" : "bytes", path: "bakeoff" };
}

export function zrwEncode(ints) {
  return Buffer.from(packBits(new ZeroRangeWave(0, 4).encodeBits(ints)));
}
export function zrwDecode(packed) {
  return new ZeroRangeWave(0, 4).decodeBits(unpackBits(packed));
}

function wrap(kind, payload) {
  const hdr = Buffer.alloc(6);
  MAGIC.copy(hdr);
  hdr[4] = 1;
  hdr[5] = kind;
  return Buffer.concat([hdr, payload]);
}

export function unwrap(frame) {
  const f = Buffer.from(frame);
  if (f.length < 6 || f.subarray(0, 4).toString() !== "SPL1") {
    return { kind: 0, payload: f, bare: true };
  }
  return { kind: f[5], payload: f.subarray(6), bare: false };
}

function trial(name, kind, payload, raw) {
  if (!payload) return null;
  let back;
  try {
    if (kind === KIND.zrw) back = fromI32(zrwDecode(payload));
    else if (kind === KIND.gzip) back = gunzip(payload);
    else if (kind === KIND.brotli) back = unbrotli(payload);
    else if (kind === KIND.rdom) back = decodeReal(payload);
    else return null;
  } catch {
    return { name, kind, bytes: payload.length, rt: false };
  }
  const rt = Buffer.isBuffer(back) && back.equals(raw);
  return { name, kind, payload, bytes: payload.length, rt };
}

export function encode(input) {
  const raw = Buffer.from(input);
  const cls = classify(raw);
  const trials = [];
  const ints = asI32(raw);

  if (ints && (cls.path === "zrw" || cls.vector === "zeros" || cls.vector === "ramp" || cls.vector === "walk")) {
    try {
      trials.push(trial("zrw", KIND.zrw, zrwEncode(ints), raw));
    } catch {
      /* not a ZRW vector after all */
    }
  }
  trials.push(trial("gzip-9", KIND.gzip, gzip9(raw), raw));
  trials.push(trial("brotli-11", KIND.brotli, brotli11(raw), raw));
  if (raw.length <= RDOM_CAP) {
    try {
      trials.push(trial("rdom", KIND.rdom, encodeReal(raw), raw));
    } catch {
      /* leftover coder optional on small files */
    }
  }

  const ok = trials.filter((t) => t && t.rt).sort((a, b) => a.bytes - b.bytes);
  const win = ok[0] || trial("gzip-9", KIND.gzip, gzip9(raw), raw);
  return {
    raw: raw.length,
    method: win.name,
    kind: win.kind,
    packed: win.bytes,
    frame: wrap(win.kind, win.payload),
    vector: cls.vector,
    trials: trials.filter(Boolean).map((t) => ({ name: t.name, bytes: t.bytes, rt: t.rt })),
  };
}

export function decode(frame) {
  const { kind, payload, bare } = unwrap(frame);
  if (bare) {
    try {
      return fromI32(zrwDecode(payload));
    } catch {
      try {
        return gunzip(payload);
      } catch {
        return unbrotli(payload);
      }
    }
  }
  if (kind === KIND.zrw) return fromI32(zrwDecode(payload));
  if (kind === KIND.gzip) return gunzip(payload);
  if (kind === KIND.brotli) return unbrotli(payload);
  if (kind === KIND.rdom) return decodeReal(payload);
  throw new Error("unknown SPL1 kind " + kind);
}

export function inputToRaw(input) {
  if (input == null) throw new Error("empty_body");
  if (Buffer.isBuffer(input) || input instanceof Uint8Array) return Buffer.from(input);
  if (typeof input === "string") return Buffer.from(input, "utf8");
  if (typeof input !== "object") throw new Error("empty_or_bad_input");
  if (input.data_b64) return Buffer.from(String(input.data_b64), "base64");
  const corpus = String(input.corpus || "");
  const wantsVector = corpus === "zeros" || corpus === "ramp" || corpus === "walk";
  if (input.text != null && !wantsVector) return Buffer.from(String(input.text), "utf8");
  const n = Math.min(1_000_000, Math.max(1, Number(input.n) || 10_000));
  if (!corpus || corpus === "zeros") {
    const raw = Buffer.alloc(n * 4);
    if (raw.length > MAX_VECTOR) throw new Error("too_large");
    return raw;
  }
  if (corpus === "ramp") {
    const raw = Buffer.alloc(n * 4);
    const start = Number(input.start) || 0;
    for (let i = 0; i < n; i++) raw.writeInt32LE((start + i) | 0, i * 4);
    return raw;
  }
  if (corpus === "walk") {
    const raw = Buffer.alloc(n * 4);
    let v = Number(input.start) || 0;
    for (let i = 0; i < n; i++) {
      raw.writeInt32LE(v | 0, i * 4);
      v += (i % 7) - 3;
    }
    return raw;
  }
  throw new Error("need_zeros_ramp_walk_text_or_data_b64");
}

export function publicResult(enc) {
  const nInts = enc.raw % 4 === 0 ? enc.raw / 4 : null;
  const zeros = enc.vector === "zeros";
  return {
    path: "spl-codec",
    method: enc.method,
    kind: enc.kind,
    vector: enc.vector,
    raw_bytes: enc.raw,
    packed_bytes: enc.packed,
    frame_bytes: enc.frame.length,
    packed_b64: enc.frame.toString("base64"),
    trials: enc.trials,
    roundtrip: true,
    ...(enc.method === "zrw" ? { zrw_bytes: enc.packed, n_ints: nInts } : {}),
    claim_check: zeros
      ? { zeros: true, matches_flagship_8b_on_10k: nInts === 10_000 && enc.packed === 8 }
      : { zeros: false },
  };
}
