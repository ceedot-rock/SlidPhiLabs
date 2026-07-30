/**
 * Omni-Dormant v2 — updated pathways
 *
 * ACTIVE routing:
 *   gaps      — strictly increasing postings/gaps → classic gap codes
 *   dense     — M unknown → hybrid k4/auto with guard
 *   universe  — M known → fixed ceil(log2 M) bits
 *   interp    — sorted unique → interpolative
 *   smooth    — double-delta + classic
 *   for       — narrow range FOR
 *   classic   — safe scalar list
 *
 * DORMANT: mirror, rans, deltaHyb-as-default
 */

const FIB = (() => {
  const a = [1, 2];
  while (a.at(-1) < 1e8) a.push(a.at(-1) + a.at(-2));
  return a;
})();

function encClassic(n) {
  if (!Number.isInteger(n) || n < 1) throw new Error("classic n>=1");
  let t = n, bit = [];
  for (let i = FIB.length - 1; i >= 0; i--) {
    if (FIB[i] <= t) { bit[i] = 1; t -= FIB[i]; i--; }
  }
  let hi = 0;
  for (let i = 0; i < bit.length; i++) if (bit[i]) hi = i;
  let s = "";
  for (let i = 0; i <= hi; i++) s += bit[i] ? "1" : "0";
  return s.endsWith("1") ? s + "1" : s + "11";
}
function decClassicFrom(bits, pos) {
  let n = 0, i = pos, p = false, idx = 0;
  while (i < bits.length) {
    if (bits[i] === "1") {
      if (p) return { v: n, next: i + 1 };
      n += FIB[idx] || 0; p = true;
    } else p = false;
    i++; idx++;
  }
  throw new Error("classic trunc");
}
function encHyb(n, k) {
  return encClassic((n >> k) + 1) + (n & ((1 << k) - 1)).toString(2).padStart(k, "0");
}
function decHybFrom(bits, pos, k) {
  const { v: hp, next } = decClassicFrom(bits, pos);
  const lo = parseInt(bits.slice(next, next + k) || "0", 2);
  return { v: ((hp - 1) << k) + lo, next: next + k };
}
function autoK(n) {
  if (n < 16) return 0;
  if (n < 32) return 2;
  if (n < 64) return 3;
  if (n < 128) return 4;
  if (n < 256) return 5;
  if (n < 512) return 6;
  if (n < 1024) return 7;
  if (n < 2048) return 8;
  if (n < 4096) return 9;
  return 10;
}
function zig(n) { return n >= 0 ? 2 * n : 2 * (-n) - 1; }
function unzig(u) { return u & 1 ? -((u + 1) >> 1) : u >> 1; }
function encSigned(n) { return encClassic(zig(n) + 1); }
function decSignedFrom(bits, pos) {
  const { v, next } = decClassicFrom(bits, pos);
  return { v: unzig(v - 1), next };
}

function encodeGaps(x) {
  let bits = encClassic(x[0]);
  for (let i = 1; i < x.length; i++) {
    const g = x[i] - x[i - 1];
    if (g < 1) throw new Error("gaps: need strictly increasing");
    bits += encClassic(g);
  }
  return { mode: "gaps", n: x.length, bits };
}
function decodeGaps(f) {
  const x = []; let pos = 0;
  let r = decClassicFrom(f.bits, pos); x.push(r.v); pos = r.next;
  for (let i = 1; i < f.n; i++) {
    r = decClassicFrom(f.bits, pos); x.push(x[i - 1] + r.v); pos = r.next;
  }
  return x;
}

function encodeDense(x, profile = "k4") {
  let bits = ""; const ks = [];
  for (const n of x) {
    let k = profile === "auto" ? autoK(n) : profile === "k2" ? (n < 16 ? 0 : 2) : (n < 16 ? 0 : 4);
    ks.push(k);
    bits += k === 0 ? encClassic(n) : encHyb(n, k);
  }
  return { mode: "dense", profile, n: x.length, ks, bits };
}
function decodeDense(f) {
  const x = []; let pos = 0;
  for (let i = 0; i < f.n; i++) {
    const k = f.ks[i];
    if (k === 0) { const r = decClassicFrom(f.bits, pos); x.push(r.v); pos = r.next; }
    else { const r = decHybFrom(f.bits, pos, k); x.push(r.v); pos = r.next; }
  }
  return x;
}

function encodeUniverse(x, M) {
  if (!M || M < 1) throw new Error("universe requires M");
  const w = Math.ceil(Math.log2(M));
  let bits = "";
  for (const n of x) {
    if (n < 1 || n > M) throw new Error("value out of universe 1..M");
    bits += (n - 1).toString(2).padStart(w, "0");
  }
  return { mode: "universe", n: x.length, M, w, bits };
}
function decodeUniverse(f) {
  const x = []; let pos = 0;
  for (let i = 0; i < f.n; i++) {
    x.push(parseInt(f.bits.slice(pos, pos + f.w) || "0", 2) + 1);
    pos += f.w;
  }
  return x;
}

function encodeInterp(x) {
  for (let i = 1; i < x.length; i++) if (x[i] <= x[i - 1]) throw new Error("interp requires strictly sorted unique");
  if (x.length === 0) return { mode: "interp", n: 0, bits: "", x0: 0, xlast: 0 };
  const codes = [];
  function rec(lo, hi, xmin, xmax) {
    if (lo > hi) return;
    if (lo === hi) {
      const options = xmax - xmin + 1;
      if (options > 1) {
        const w = Math.ceil(Math.log2(options));
        codes.push((x[lo] - xmin).toString(2).padStart(w, "0"));
      }
      return;
    }
    const mid = (lo + hi) >> 1;
    const lowBound = xmin + (mid - lo);
    const highBound = xmax - (hi - mid);
    const options = highBound - lowBound + 1;
    if (options > 1) {
      const w = Math.ceil(Math.log2(options));
      codes.push((x[mid] - lowBound).toString(2).padStart(w, "0"));
    }
    rec(lo, mid - 1, xmin, x[mid] - 1);
    rec(mid + 1, hi, x[mid] + 1, xmax);
  }
  const x0 = x[0], xlast = x[x.length - 1];
  if (x.length > 2) rec(1, x.length - 2, x0 + 1, xlast - 1);
  return { mode: "interp", n: x.length, x0, xlast, bits: codes.join("") };
}
function decodeInterp(f) {
  if (f.n === 0) return [];
  if (f.n === 1) return [f.x0];
  const x = new Array(f.n);
  x[0] = f.x0; x[f.n - 1] = f.xlast;
  let pos = 0;
  function read(options) {
    if (options <= 1) return 0;
    const w = Math.ceil(Math.log2(options));
    const v = parseInt(f.bits.slice(pos, pos + w) || "0", 2);
    pos += w; return v;
  }
  function rec(lo, hi, xmin, xmax) {
    if (lo > hi) return;
    if (lo === hi) { x[lo] = xmin + read(xmax - xmin + 1); return; }
    const mid = (lo + hi) >> 1;
    const lowBound = xmin + (mid - lo);
    const highBound = xmax - (hi - mid);
    x[mid] = lowBound + read(highBound - lowBound + 1);
    rec(lo, mid - 1, xmin, x[mid] - 1);
    rec(mid + 1, hi, x[mid] + 1, xmax);
  }
  if (f.n > 2) rec(1, f.n - 2, f.x0 + 1, f.xlast - 1);
  return x;
}

function encodeSmooth(x) {
  const d = [x[0]]; for (let i = 1; i < x.length; i++) d.push(x[i] - x[i - 1]);
  const dd = [d[0]]; for (let i = 1; i < d.length; i++) dd.push(d[i] - d[i - 1]);
  let bits = ""; for (const v of dd) bits += encSigned(v);
  return { mode: "smooth", n: x.length, bits };
}
function decodeSmooth(f) {
  const dd = []; let pos = 0;
  for (let i = 0; i < f.n; i++) { const r = decSignedFrom(f.bits, pos); dd.push(r.v); pos = r.next; }
  const d = [dd[0]]; for (let i = 1; i < dd.length; i++) d.push(d[i - 1] + dd[i]);
  const x = [d[0]]; for (let i = 1; i < d.length; i++) x.push(x[i - 1] + d[i]);
  return x;
}

function encodeFor(x) {
  let lo = x[0], hi = x[0];
  for (const v of x) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const width = hi <= lo ? 0 : Math.ceil(Math.log2(hi - lo + 1));
  let bits = "";
  for (const v of x) bits += width === 0 ? "" : (v - lo).toString(2).padStart(width, "0");
  return { mode: "for", n: x.length, base: lo, width, bits };
}
function decodeFor(f) {
  const x = []; let pos = 0;
  for (let i = 0; i < f.n; i++) {
    if (f.width === 0) x.push(f.base);
    else { x.push(f.base + parseInt(f.bits.slice(pos, pos + f.width) || "0", 2)); pos += f.width; }
  }
  return x;
}

function encodeClassicList(x) {
  let bits = ""; for (const n of x) bits += encClassic(Math.max(1, n));
  return { mode: "classic", n: x.length, bits };
}
function decodeClassicList(f) {
  const x = []; let pos = 0;
  for (let i = 0; i < f.n; i++) { const r = decClassicFrom(f.bits, pos); x.push(r.v); pos = r.next; }
  return x;
}

export function encode(mode, data, opts = {}) {
  switch (mode) {
    case "gaps": return encodeGaps(data);
    case "dense": return encodeDense(data, opts.profile || "k4");
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

export const OMNI_META = {
  version: 2,
  pathways: ["gaps", "dense", "universe", "interp", "smooth", "for", "classic"],
  routing: {
    postings_gaps: "gaps",
    dense_M_known: "universe",
    dense_M_unknown: "dense",
    sorted_unique: "interp",
    smooth_series: "smooth",
    narrow_band: "for",
    safe: "classic",
  },
  dormant: ["mirror", "rans", "deltaHyb"],
};
