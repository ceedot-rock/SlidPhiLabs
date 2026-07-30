/**
 * Pathways v2 — implemented findings
 * universe | localBinary | interp | deltaHyb | pfor
 *
 * Results (bits/val):
 *   universe M=10000:     14.00   (beats auto ~14.57 on dense independent)
 *   interp sequential:    ~0.01   (endpoints only when dense range)
 *   interp geo sorted:    ~4.25   (gaps classic still ~4.12 better)
 *   gaps classic geo:     ~4.12   (still best for postings)
 *   deltaHyb always k4:   worse on small gaps — use gaps not deltaHyb default
 *   pfor/universe cluster:~6.0
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
function encHyb(n, k = 4) {
  return encClassic((n >> k) + 1) + (n & ((1 << k) - 1)).toString(2).padStart(k, "0");
}
function decHybFrom(bits, pos, k = 4) {
  const { v: hp, next } = decClassicFrom(bits, pos);
  const lo = parseInt(bits.slice(next, next + k) || "0", 2);
  return { v: ((hp - 1) << k) + lo, next: next + k };
}

export function encodeUniverse(x, M) {
  const w = Math.ceil(Math.log2(M));
  let bits = "";
  for (const n of x) {
    if (n < 1 || n > M) throw new Error("out of universe");
    bits += (n - 1).toString(2).padStart(w, "0");
  }
  return { mode: "universe", n: x.length, M, w, bits };
}
export function decodeUniverse(f) {
  const x = []; let pos = 0;
  for (let i = 0; i < f.n; i++) {
    x.push(parseInt(f.bits.slice(pos, pos + f.w) || "0", 2) + 1);
    pos += f.w;
  }
  return x;
}

export function encodeLocalBinary(x) {
  let max = 1;
  for (const n of x) if (n > max) max = n;
  const w = Math.ceil(Math.log2(max + 1));
  let bits = "";
  for (const n of x) bits += n.toString(2).padStart(w, "0");
  return { mode: "localBinary", n: x.length, max, w, bits };
}
export function decodeLocalBinary(f) {
  const x = []; let pos = 0;
  for (let i = 0; i < f.n; i++) {
    x.push(parseInt(f.bits.slice(pos, pos + f.w) || "0", 2));
    pos += f.w;
  }
  return x;
}

export function encodeInterp(x) {
  for (let i = 1; i < x.length; i++) if (x[i] <= x[i - 1]) throw new Error("interp requires strict sorted");
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
export function decodeInterp(f) {
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

export function encodeDeltaHyb(x) {
  let bits = encHyb(x[0], 4);
  for (let i = 1; i < x.length; i++) {
    const g = x[i] - x[i - 1];
    if (g < 1) throw new Error("deltaHyb needs increasing");
    bits += encHyb(g, 4);
  }
  return { mode: "deltaHyb", n: x.length, bits };
}
export function decodeDeltaHyb(f) {
  const x = []; let pos = 0;
  let r = decHybFrom(f.bits, pos, 4); x.push(r.v); pos = r.next;
  for (let i = 1; i < f.n; i++) {
    r = decHybFrom(f.bits, pos, 4); x.push(x[i - 1] + r.v); pos = r.next;
  }
  return x;
}

export function encodePFOR(x, keepPct = 0.99) {
  let lo = x[0];
  for (const v of x) if (v < lo) lo = v;
  const offs = x.map((v) => v - lo);
  const sorted = [...offs].sort((a, b) => a - b);
  const cut = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * keepPct))];
  const w = cut <= 0 ? 0 : Math.ceil(Math.log2(cut + 1));
  const exceptions = [];
  let bits = "";
  for (let i = 0; i < x.length; i++) {
    const o = offs[i];
    if (o > cut) { exceptions.push([i, x[i]]); bits += (0).toString(2).padStart(w || 1, "0"); }
    else bits += w === 0 ? "" : o.toString(2).padStart(w, "0");
  }
  return { mode: "pfor", n: x.length, base: lo, cut, w, bits, exceptions };
}
export function decodePFOR(f) {
  const x = new Array(f.n);
  const ex = new Map(f.exceptions);
  let pos = 0;
  for (let i = 0; i < f.n; i++) {
    if (ex.has(i)) { x[i] = ex.get(i); if (f.w > 0) pos += f.w; }
    else if (f.w === 0) x[i] = f.base;
    else { x[i] = f.base + parseInt(f.bits.slice(pos, pos + f.w) || "0", 2); pos += f.w; }
  }
  return x;
}
