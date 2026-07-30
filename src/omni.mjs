/** Omni-Dormant v2.1 — dense default=auto, Uint8Array bitstream */
import { BitWriter, BitReader, packBits, unpackBits } from "./bitstream.mjs";

const FIB = (() => { const a = [1, 2]; while (a.at(-1) < 1e8) a.push(a.at(-1) + a.at(-2)); return a; })();

function encClassic(n) {
  if (!Number.isInteger(n) || n < 1) throw new Error("classic n>=1");
  let t = n, bit = [];
  for (let i = FIB.length - 1; i >= 0; i--) if (FIB[i] <= t) { bit[i] = 1; t -= FIB[i]; i--; }
  let hi = 0; for (let i = 0; i < bit.length; i++) if (bit[i]) hi = i;
  let s = ""; for (let i = 0; i <= hi; i++) s += bit[i] ? "1" : "0";
  return s.endsWith("1") ? s + "1" : s + "11";
}
function decClassicFrom(bits, pos) {
  let n = 0, i = pos, p = false, idx = 0;
  while (i < bits.length) {
    if (bits[i] === "1") { if (p) return { v: n, next: i + 1 }; n += FIB[idx] || 0; p = true; }
    else p = false; i++; idx++;
  }
  throw new Error("classic trunc");
}
function encHyb(n, k) {
  return encClassic((n >> k) + 1) + (n & ((1 << k) - 1)).toString(2).padStart(k, "0");
}
function decHybFrom(bits, pos, k) {
  const { v: hp, next } = decClassicFrom(bits, pos);
  return { v: ((hp - 1) << k) + parseInt(bits.slice(next, next + k) || "0", 2), next: next + k };
}
function autoK(n) {
  if (n < 16) return 0; if (n < 32) return 2; if (n < 64) return 3; if (n < 128) return 4;
  if (n < 256) return 5; if (n < 512) return 6; if (n < 1024) return 7; if (n < 2048) return 8;
  if (n < 4096) return 9; return 10;
}
function zig(n) { return n >= 0 ? 2 * n : 2 * (-n) - 1; }
function unzig(u) { return u & 1 ? -((u + 1) >> 1) : u >> 1; }
function encSigned(n) { return encClassic(zig(n) + 1); }
function decSignedFrom(bits, pos) { const { v, next } = decClassicFrom(bits, pos); return { v: unzig(v - 1), next }; }

function encodeGaps(x) {
  let bits = encClassic(x[0]);
  for (let i = 1; i < x.length; i++) { const g = x[i] - x[i - 1]; if (g < 1) throw new Error("gaps: increasing"); bits += encClassic(g); }
  return { mode: "gaps", n: x.length, bitLen: bits.length, bytes: packBits(bits), bits };
}
function decodeGaps(f) {
  const bits = f.bits ?? unpackBits(f.bytes, f.bitLen);
  const x = []; let pos = 0; let r = decClassicFrom(bits, pos); x.push(r.v); pos = r.next;
  for (let i = 1; i < f.n; i++) { r = decClassicFrom(bits, pos); x.push(x[i - 1] + r.v); pos = r.next; }
  return x;
}

function encodeDense(x, profile = "auto") {
  let bits = ""; const ks = [];
  for (const n of x) {
    const k = profile === "k4" ? (n < 16 ? 0 : 4) : profile === "k2" ? (n < 16 ? 0 : 2) : autoK(n);
    ks.push(k); bits += k === 0 ? encClassic(n) : encHyb(n, k);
  }
  return { mode: "dense", profile, n: x.length, ks, bitLen: bits.length, bytes: packBits(bits), bits };
}
function decodeDense(f) {
  const bits = f.bits ?? unpackBits(f.bytes, f.bitLen);
  const x = []; let pos = 0;
  for (let i = 0; i < f.n; i++) {
    const k = f.ks[i];
    if (k === 0) { const r = decClassicFrom(bits, pos); x.push(r.v); pos = r.next; }
    else { const r = decHybFrom(bits, pos, k); x.push(r.v); pos = r.next; }
  }
  return x;
}

function encodeUniverse(x, M) {
  if (!M || M < 1) throw new Error("universe requires M");
  const w = Math.ceil(Math.log2(M));
  const writer = new BitWriter();
  for (const n of x) { if (n < 1 || n > M) throw new Error("out of universe"); writer.writeBits(n - 1, w); }
  return { mode: "universe", n: x.length, M, w, bitLen: x.length * w, bytes: writer.finish() };
}
function decodeUniverse(f) {
  const r = new BitReader(f.bytes); const x = [];
  for (let i = 0; i < f.n; i++) x.push(r.readBits(f.w) + 1);
  return x;
}

function encodeInterp(x) {
  for (let i = 1; i < x.length; i++) if (x[i] <= x[i - 1]) throw new Error("interp: sorted unique");
  if (!x.length) return { mode: "interp", n: 0, bytes: new Uint8Array(), bitLen: 0, x0: 0, xlast: 0 };
  const codes = [];
  function rec(lo, hi, xmin, xmax) {
    if (lo > hi) return;
    if (lo === hi) {
      const o = xmax - xmin + 1; if (o > 1) { const ww = Math.ceil(Math.log2(o)); codes.push((x[lo] - xmin).toString(2).padStart(ww, "0")); }
      return;
    }
    const mid = (lo + hi) >> 1, lb = xmin + (mid - lo), hb = xmax - (hi - mid), o = hb - lb + 1;
    if (o > 1) { const ww = Math.ceil(Math.log2(o)); codes.push((x[mid] - lb).toString(2).padStart(ww, "0")); }
    rec(lo, mid - 1, xmin, x[mid] - 1); rec(mid + 1, hi, x[mid] + 1, xmax);
  }
  const x0 = x[0], xlast = x[x.length - 1];
  if (x.length > 2) rec(1, x.length - 2, x0 + 1, xlast - 1);
  const bitStr = codes.join("");
  return { mode: "interp", n: x.length, x0, xlast, bitLen: bitStr.length, bytes: packBits(bitStr), bits: bitStr };
}
function decodeInterp(f) {
  if (f.n === 0) return []; if (f.n === 1) return [f.x0];
  const bits = f.bits ?? unpackBits(f.bytes, f.bitLen);
  const x = new Array(f.n); x[0] = f.x0; x[f.n - 1] = f.xlast; let pos = 0;
  function read(o) { if (o <= 1) return 0; const ww = Math.ceil(Math.log2(o)); const v = parseInt(bits.slice(pos, pos + ww) || "0", 2); pos += ww; return v; }
  function rec(lo, hi, xmin, xmax) {
    if (lo > hi) return;
    if (lo === hi) { x[lo] = xmin + read(xmax - xmin + 1); return; }
    const mid = (lo + hi) >> 1, lb = xmin + (mid - lo), hb = xmax - (hi - mid);
    x[mid] = lb + read(hb - lb + 1); rec(lo, mid - 1, xmin, x[mid] - 1); rec(mid + 1, hi, x[mid] + 1, xmax);
  }
  if (f.n > 2) rec(1, f.n - 2, f.x0 + 1, f.xlast - 1);
  return x;
}

function encodeSmooth(x) {
  const d = [x[0]]; for (let i = 1; i < x.length; i++) d.push(x[i] - x[i - 1]);
  const dd = [d[0]]; for (let i = 1; i < d.length; i++) dd.push(d[i] - d[i - 1]);
  let bits = ""; for (const v of dd) bits += encSigned(v);
  return { mode: "smooth", n: x.length, bitLen: bits.length, bytes: packBits(bits), bits };
}
function decodeSmooth(f) {
  const bits = f.bits ?? unpackBits(f.bytes, f.bitLen);
  const dd = []; let pos = 0;
  for (let i = 0; i < f.n; i++) { const r = decSignedFrom(bits, pos); dd.push(r.v); pos = r.next; }
  const d = [dd[0]]; for (let i = 1; i < dd.length; i++) d.push(d[i - 1] + dd[i]);
  const x = [d[0]]; for (let i = 1; i < d.length; i++) x.push(x[i - 1] + d[i]);
  return x;
}

function encodeFor(x) {
  let lo = x[0], hi = x[0]; for (const v of x) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const width = hi <= lo ? 0 : Math.ceil(Math.log2(hi - lo + 1));
  const writer = new BitWriter();
  for (const v of x) if (width > 0) writer.writeBits(v - lo, width);
  return { mode: "for", n: x.length, base: lo, width, bitLen: x.length * width, bytes: writer.finish() };
}
function decodeFor(f) {
  const r = new BitReader(f.bytes); const x = [];
  for (let i = 0; i < f.n; i++) x.push(f.width === 0 ? f.base : f.base + r.readBits(f.width));
  return x;
}

function encodeClassicList(x) {
  let bits = ""; for (const n of x) bits += encClassic(Math.max(1, n));
  return { mode: "classic", n: x.length, bitLen: bits.length, bytes: packBits(bits), bits };
}
function decodeClassicList(f) {
  const bits = f.bits ?? unpackBits(f.bytes, f.bitLen);
  const x = []; let pos = 0;
  for (let i = 0; i < f.n; i++) { const r = decClassicFrom(bits, pos); x.push(r.v); pos = r.next; }
  return x;
}

export function encode(mode, data, opts = {}) {
  switch (mode) {
    case "gaps": return encodeGaps(data);
    case "dense": return encodeDense(data, opts.profile || "auto");
    case "universe": return encodeUniverse(data, opts.M);
    case "interp": return encodeInterp(data);
    case "smooth": return encodeSmooth(data);
    case "for": return encodeFor(data);
    case "classic": return encodeClassicList(data);
    default: throw new Error("unknown mode: " + mode);
  }
}
export function decode(frame) {
  switch (frame.mode) {
    case "gaps": return decodeGaps(frame);
    case "dense": return decodeDense(frame);
    case "universe": return decodeUniverse(frame);
    case "interp": return decodeInterp(frame);
    case "smooth": return decodeSmooth(frame);
    case "for": return decodeFor(frame);
    case "classic": return decodeClassicList(frame);
    default: throw new Error("unknown mode: " + frame.mode);
  }
}

/** Wire-friendly: same as encode (frames already include Uint8Array bytes). */
export function encodeBytes(mode, data, opts = {}) {
  return encode(mode, data, opts);
}
/** Decode frame object from encode/encodeBytes. */
export function decodeBytes(frame) {
  if (frame && frame.mode) return decode(frame);
  throw new Error("decodeBytes: pass encode() frame object");
}

export const OMNI_META = {
  version: "2.1",
  pathways: ["gaps", "dense", "universe", "interp", "smooth", "for", "classic"],
  dense_default: "auto",
  dense_default_profile: "auto",
  bitstream: "Uint8Array bytes + bitLen",
  rans: {
    dormant_default: true,
    min_block: 2048,
    header_tax: "histogram header amortizes for B>=2048",
  },
  dormant: ["mirror", "rans", "deltaHyb", "wasm_simd"],
};

export { packBits, unpackBits, BitWriter, BitReader };
