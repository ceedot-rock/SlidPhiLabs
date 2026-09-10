/**
 * Hosted AWARE walk helpers — JS twin of lbr1 splb::poly walk_d1 / walk_lcg.
 *
 * Metadata / pricing / tests only. Kolmogorov seating (9 B aware_bytes crown)
 * rides rebuilt docs/site/bin/lb from ceedot-rock/lbr1 main via `lb aware`.
 * Do not claim the crown off this twin alone — see FLY_PUBLIC.md Ship refresh.
 *
 * Wire (LBHX KIND_POLY carries raw_len outside):
 *   walk_d1 (model_id=5): model_id | start:i64 | mag:i32 | flag | [zlib-9(bitpacked signs)]
 *   walk_lcg (model_id=6): model_id | step:i32 | seed:u32  // start fixed 0; makeWalk LCG
 *
 * LCG uses 32-bit mul (Math.imul) — plain JS `*` is NOT bit-exact on fixtures.
 */
import { deflateSync, inflateSync } from "node:zlib";

export const MODEL_WALK_D1 = 5;
export const MODEL_WALK_LCG = 6;
export const KIND_POLY = 4;
export const WALK_D1_HEADER = 14; // 1+8+4+1
export const WALK_LCG_HEADER = 9; // 1+4+4
export const LBHX_HDR = 13;

/** Published makeWalk (ZRW / Lab Science). Bit-exact with Rust make_walk_lcg. */
export function makeWalk(n, step, seed) {
  const a = new Int32Array(n);
  if (n === 0) return a;
  a[0] = 0;
  let s = seed >>> 0;
  for (let i = 1; i < n; i++) {
    s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff;
    const dir = s % 2 === 0 ? 1 : -1;
    a[i] = (a[i - 1] + dir * step) | 0;
  }
  return a;
}

export function parseI32le(buf) {
  const b = Buffer.from(buf);
  if (b.length < 4 || b.length % 4 !== 0) return null;
  const n = b.length / 4;
  const v = new Int32Array(n);
  for (let i = 0; i < n; i++) v[i] = b.readInt32LE(i * 4);
  return v;
}

export function emitI32le(vals) {
  const out = Buffer.allocUnsafe(vals.length * 4);
  for (let i = 0; i < vals.length; i++) out.writeInt32LE(vals[i] | 0, i * 4);
  return out;
}

function zlib9(bytes) {
  return deflateSync(Buffer.from(bytes), { level: 9 });
}

function unzlib(bytes) {
  return inflateSync(Buffer.from(bytes));
}

function bitpackSigns(signs) {
  const out = Buffer.allocUnsafe(Math.ceil(signs.length / 8) || 0);
  out.fill(0);
  for (let i = 0; i < signs.length; i++) {
    if (signs[i]) out[i >> 3] |= 1 << (i & 7);
  }
  return out;
}

function unpackSigns(packed, n) {
  const signs = new Uint8Array(n);
  for (let i = 0; i < n; i++) signs[i] = (packed[i >> 3] >> (i & 7)) & 1;
  return signs;
}

export function fitWalkConstMag(vals) {
  if (!vals || vals.length < 2) return null;
  const start = vals[0] | 0;
  const d0 = (vals[1] - vals[0]) | 0;
  const mag = Math.abs(d0) | 0;
  if (mag === 0) return null;
  const signs = new Uint8Array(vals.length - 1);
  for (let i = 1; i < vals.length; i++) {
    const d = (vals[i] - vals[i - 1]) | 0;
    if ((Math.abs(d) | 0) !== mag) return null;
    signs[i - 1] = d > 0 ? 1 : 0;
  }
  return { start: BigInt(start), mag, signs };
}

function walkLcgMatches(vals, step, seed) {
  if (!vals.length || vals[0] !== 0) return false;
  let s = seed >>> 0;
  let prev = 0;
  for (let i = 1; i < vals.length; i++) {
    s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff;
    const dir = s % 2 === 0 ? 1 : -1;
    const expect = (prev + dir * step) | 0;
    if (expect !== vals[i]) return false;
    prev = vals[i];
  }
  return true;
}

/** Recover {step, seed} when decoder shares makeWalk. */
export function tryWalkLcgParams(vals) {
  if (!vals || vals.length < 2 || vals[0] !== 0) return null;
  const fit = fitWalkConstMag(vals);
  if (!fit || fit.start !== 0n || fit.mag === 0) return null;
  const { mag, signs } = fit;
  let allSame = true;
  for (let i = 1; i < signs.length; i++) {
    if (signs[i] !== signs[0]) {
      allSame = false;
      break;
    }
  }
  if (allSame) return null;
  const seeds = [1, 2];
  for (let s = 0; s < 512; s++) seeds.push(s);
  for (const seed of seeds) {
    if (walkLcgMatches(vals, mag, seed)) return { step: mag, seed };
    if (walkLcgMatches(vals, -mag, seed)) return { step: -mag, seed };
  }
  return null;
}

export function packWalkLcg(step, seed) {
  const out = Buffer.allocUnsafe(WALK_LCG_HEADER);
  out[0] = MODEL_WALK_LCG;
  out.writeInt32LE(step | 0, 1);
  out.writeUInt32LE(seed >>> 0, 5);
  return out;
}

export function packWalkD1(start, mag, signs) {
  const packed = bitpackSigns(signs);
  const z = zlib9(packed);
  const out = Buffer.allocUnsafe(WALK_D1_HEADER + z.length);
  out[0] = MODEL_WALK_D1;
  const startI64 = typeof start === "bigint" ? start : BigInt(start | 0);
  out.writeBigInt64LE(startI64, 1);
  out.writeInt32LE(mag | 0, 9);
  out[13] = 0;
  z.copy(out, 14);
  return out;
}

export function wrapLbhxPoly(rawLen, inner) {
  const out = Buffer.allocUnsafe(LBHX_HDR + inner.length);
  out.write("LBHX", 0, 4, "latin1");
  out.writeUInt32LE(rawLen >>> 0, 4);
  out[8] = KIND_POLY;
  out.writeUInt32LE(inner.length >>> 0, 9);
  Buffer.from(inner).copy(out, 13);
  return out;
}

export function unwrapLbhx(buf) {
  const b = Buffer.from(buf);
  if (b.length < LBHX_HDR || b.subarray(0, 4).toString("latin1") !== "LBHX") return null;
  const rawLen = b.readUInt32LE(4);
  const kind = b[8];
  const innerLen = b.readUInt32LE(9);
  if (13 + innerLen !== b.length) return null;
  return { kind, rawLen, inner: b.subarray(13) };
}

export function unpackInner(inner, nVals) {
  const b = Buffer.from(inner);
  if (!b.length) throw new Error("poly short");
  const modelId = b[0];
  if (modelId === MODEL_WALK_LCG) {
    if (b.length !== WALK_LCG_HEADER) throw new Error("walk_lcg hdr");
    const step = b.readInt32LE(1);
    const seed = b.readUInt32LE(5);
    const gen = makeWalk(nVals, step, seed);
    if (gen.length !== nVals) throw new Error("walk_lcg n");
    return { vals: gen, modelId, model: "walk_lcg", step, seed };
  }
  if (modelId === MODEL_WALK_D1) {
    if (b.length < WALK_D1_HEADER) throw new Error("walk_d1 hdr");
    const start = b.readBigInt64LE(1);
    const mag = b.readInt32LE(9);
    if (b[13] !== 0) throw new Error("walk_d1 flag");
    const inflated = unzlib(b.subarray(14));
    const nSigns = Math.max(0, nVals - 1);
    const signs = unpackSigns(inflated, nSigns);
    const out = new Int32Array(nVals);
    out[0] = Number(start) | 0;
    if (BigInt(out[0]) !== start) throw new Error("walk_d1 start");
    for (let i = 0; i < nSigns; i++) {
      const dir = signs[i] === 1 ? 1 : -1;
      out[i + 1] = (out[i] + dir * mag) | 0;
    }
    return { vals: out, modelId, model: "walk_d1", start: Number(start), mag };
  }
  throw new Error("not_walk_model");
}

/** Inspect an LBHX aware blob for walk program pricing (model_id 5/6). */
export function inspectWalkProgram(blob) {
  const u = unwrapLbhx(blob);
  if (!u || u.kind !== KIND_POLY || !u.inner.length) return null;
  const mid = u.inner[0];
  if (mid === MODEL_WALK_LCG) {
    if (u.inner.length !== WALK_LCG_HEADER) return null;
    return {
      model: "walk_lcg",
      model_id: MODEL_WALK_LCG,
      step: u.inner.readInt32LE(1),
      seed: u.inner.readUInt32LE(5),
      aware_bytes: u.inner.length,
      frame_bytes: Buffer.from(blob).length,
      raw_bytes: u.rawLen,
    };
  }
  if (mid === MODEL_WALK_D1) {
    if (u.inner.length < WALK_D1_HEADER) return null;
    return {
      model: "walk_d1",
      model_id: MODEL_WALK_D1,
      start: Number(u.inner.readBigInt64LE(1)),
      mag: u.inner.readInt32LE(9),
      aware_bytes: u.inner.length,
      frame_bytes: Buffer.from(blob).length,
      raw_bytes: u.rawLen,
    };
  }
  return null;
}

/**
 * Price the walk program from raw i32-aligned bytes (SKU metadata).
 * Does not seat the hosted crown — that is `lb aware` after Ship refreshes bin/lb.
 */
export function priceWalkProgram(raw) {
  const vals = parseI32le(raw);
  if (!vals || vals.length < 2) return null;
  const lcg = tryWalkLcgParams(vals);
  if (lcg) {
    return {
      model: "walk_lcg",
      model_id: MODEL_WALK_LCG,
      step: lcg.step,
      seed: lcg.seed,
      aware_bytes: WALK_LCG_HEADER,
      raw_bytes: Buffer.from(raw).length,
      seating: "bin/lb aware (lbr1 main)",
    };
  }
  const d1 = fitWalkConstMag(vals);
  if (d1) {
    const inner = packWalkD1(d1.start, d1.mag, d1.signs);
    return {
      model: "walk_d1",
      model_id: MODEL_WALK_D1,
      start: Number(d1.start),
      mag: d1.mag,
      aware_bytes: inner.length,
      raw_bytes: Buffer.from(raw).length,
      seating: "bin/lb aware (lbr1 main)",
    };
  }
  return null;
}

/** JS decode of walk LBHX (tests / inspect). Hosted restore prefers lb decode. */
export function decodeLbhxWalk(buf) {
  const u = unwrapLbhx(buf);
  if (!u || u.kind !== KIND_POLY || !u.inner.length) return null;
  const mid = u.inner[0];
  if (mid !== MODEL_WALK_LCG && mid !== MODEL_WALK_D1) return null;
  if (u.rawLen % 4 !== 0) return null;
  const { vals, model, modelId, step, seed, mag, start } = unpackInner(u.inner, u.rawLen / 4);
  const out = emitI32le(vals);
  if (out.length !== u.rawLen) throw new Error("poly out len");
  return { raw: out, model, modelId, step, seed, mag, start, awareBytes: u.inner.length };
}
