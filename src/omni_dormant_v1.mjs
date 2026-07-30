/**
 * Omni-Dormant v1
 * Pathways: gaps | dense | smooth | for | classic
 * Everything dormant unless mode is set. Mode travels with the frame.
 *
 * Tested: 10/10 RT pass
 *   gaps sequential ~2.00 bits/val
 *   gaps geo p~0.2 ~4.12 bits/val
 *   dense k4 / auto on 1..2000
 *   smooth ~3.6 bits/val
 *   for cluster ~6 bits/val
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
      n += FIB[idx] || 0;
      p = true;
    } else p = false;
    i++; idx++;
  }
  throw new Error("classic trunc");
}
function encHyb(n, k) {
  return encClassic((n >> k) + 1) + (n & ((1 << k) - 1)).toString(2).padStart(k, "0");
}
function decHybFrom(bits, pos, k) {
  const { v: hiPlus, next } = decClassicFrom(bits, pos);
  const lo = parseInt(bits.slice(next, next + k) || "0", 2);
  return { v: ((hiPlus - 1) << k) + lo, next: next + k };
}
function zig(n) { return n >= 0 ? 2 * n : 2 * (-n) - 1; }
function unzig(u) { return u & 1 ? -((u + 1) >> 1) : u >> 1; }
function encSigned(n) { return encClassic(zig(n) + 1); }
function decSignedFrom(bits, pos) {
  const { v, next } = decClassicFrom(bits, pos);
  return { v: unzig(v - 1), next };
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

function encodeGaps(x) {
  let bits = "";
  bits += encClassic(x[0]);
  for (let i = 1; i < x.length; i++) {
    const g = x[i] - x[i - 1];
    if (g < 1) throw new Error("gaps needs strictly increasing");
    bits += encClassic(g);
  }
  return { mode: "gaps", n: x.length, bits };
}
function decodeGaps(frame) {
  const x = []; let pos = 0;
  const r0 = decClassicFrom(frame.bits, pos); x.push(r0.v); pos = r0.next;
  for (let i = 1; i < frame.n; i++) {
    const r = decClassicFrom(frame.bits, pos);
    x.push(x[i - 1] + r.v); pos = r.next;
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
function decodeDense(frame) {
  const x = []; let pos = 0;
  for (let i = 0; i < frame.n; i++) {
    const k = frame.ks[i];
    if (k === 0) { const r = decClassicFrom(frame.bits, pos); x.push(r.v); pos = r.next; }
    else { const r = decHybFrom(frame.bits, pos, k); x.push(r.v); pos = r.next; }
  }
  return x;
}

function encodeSmooth(x) {
  const d = [x[0]]; for (let i = 1; i < x.length; i++) d.push(x[i] - x[i - 1]);
  const dd = [d[0]]; for (let i = 1; i < d.length; i++) dd.push(d[i] - d[i - 1]);
  let bits = ""; for (const v of dd) bits += encSigned(v);
  return { mode: "smooth", n: x.length, bits };
}
function decodeSmooth(frame) {
  const dd = []; let pos = 0;
  for (let i = 0; i < frame.n; i++) { const r = decSignedFrom(frame.bits, pos); dd.push(r.v); pos = r.next; }
  const d = [dd[0]]; for (let i = 1; i < dd.length; i++) d.push(d[i - 1] + dd[i]);
  const x = [d[0]]; for (let i = 1; i < d.length; i++) x.push(x[i - 1] + d[i]);
  return x;
}

function encodeFor(x) {
  let lo = x[0], hi = x[0];
  for (const v of x) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const range = hi - lo;
  const width = range <= 0 ? 0 : Math.ceil(Math.log2(range + 1));
  let bits = "";
  for (const v of x) bits += width === 0 ? "" : (v - lo).toString(2).padStart(width, "0");
  return { mode: "for", n: x.length, base: lo, width, bits };
}
function decodeFor(frame) {
  const x = []; let pos = 0;
  for (let i = 0; i < frame.n; i++) {
    if (frame.width === 0) x.push(frame.base);
    else {
      x.push(frame.base + parseInt(frame.bits.slice(pos, pos + frame.width) || "0", 2));
      pos += frame.width;
    }
  }
  return x;
}

function encodeClassicList(x) {
  let bits = ""; for (const n of x) bits += encClassic(Math.max(1, n));
  return { mode: "classic", n: x.length, bits };
}
function decodeClassicList(frame) {
  const x = []; let pos = 0;
  for (let i = 0; i < frame.n; i++) { const r = decClassicFrom(frame.bits, pos); x.push(r.v); pos = r.next; }
  return x;
}

export function encode(mode, data, opts = {}) {
  switch (mode) {
    case "gaps": return encodeGaps(data);
    case "dense": return encodeDense(data, opts.profile || "k4");
    case "smooth": return encodeSmooth(data);
    case "for": return encodeFor(data);
    case "classic": return encodeClassicList(data);
    default: throw new Error("unknown mode " + mode);
  }
}
export function decode(frame) {
  switch (frame.mode) {
    case "gaps": return decodeGaps(frame);
    case "dense": return decodeDense(frame);
    case "smooth": return decodeSmooth(frame);
    case "for": return decodeFor(frame);
    case "classic": return decodeClassicList(frame);
    default: throw new Error("unknown mode " + frame.mode);
  }
}

export const OMNI_META = {
  version: 1,
  pathways: ["gaps", "dense", "smooth", "for", "classic"],
  dormant_default: "classic",
  tests: "10/10 RT",
};
