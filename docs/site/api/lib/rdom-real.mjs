/**
 * Real residual v2 — longer window, 3+4 byte hashes, priced DP parse.
 * Copies first. Order-2 leftover. Huffman.
 */
const MAGIC = Buffer.from("RDOM");
const KIND = 5;
const WIN = 1 << 18;
const HBITS = 18;
const HSIZE = 1 << HBITS;
const H3BITS = 16;
const H3SIZE = 1 << H3BITS;
const MINM = 3;
const MAXM = 4096;
const CHAIN = 160;
const HUFF_MAX = 15;
const EOB = 256;
const LEN0 = 257;
const LIT_N = 286;
const LAST_D = 3;
const DIST_N = 33 + LAST_D;

const LEN_BASE = new Uint16Array([
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258,
]);
const LEN_EXTRA = new Uint8Array([
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 12,
]);
const DIST_BASE = new Uint32Array([
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145,
  8193, 12289, 16385, 24577, 32769, 65537, 131073,
]);
const DIST_EXTRA = new Uint8Array([
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 15, 16, 17,
]);

function lenTok(len) {
  if (len >= 258) return [LEN0 + 28, 12, len - 258];
  let i = 27;
  while (i > 0 && LEN_BASE[i] > len) i--;
  return [LEN0 + i, LEN_EXTRA[i], len - LEN_BASE[i]];
}
function distTok(off) {
  let i = 32;
  while (i > 0 && DIST_BASE[i] > off) i--;
  return [i, DIST_EXTRA[i], off - DIST_BASE[i]];
}

class BW {
  constructor(hint) {
    this.b = Buffer.alloc(Math.max(256, hint | 0));
    this.o = 0;
    this.acc = 0;
    this.n = 0;
  }
  grow(need = 1024) {
    const n = Buffer.alloc(Math.max(this.b.length * 2, this.o + need));
    this.b.copy(n);
    this.b = n;
  }
  write(val, bits) {
    if (bits <= 0) return;
    if (bits > 16) {
      this.write((val >>> 16) & 0xffff, bits - 16);
      this.write(val & 0xffff, 16);
      return;
    }
    this.acc = (this.acc << bits) | (val & ((1 << bits) - 1));
    this.n += bits;
    while (this.n >= 8) {
      this.n -= 8;
      if (this.o >= this.b.length) this.grow();
      this.b[this.o++] = (this.acc >>> this.n) & 255;
      this.acc &= (1 << this.n) - 1;
    }
  }
  finish() {
    if (this.n) {
      if (this.o >= this.b.length) this.grow();
      this.b[this.o++] = (this.acc << (8 - this.n)) & 255;
    }
    return this.b.subarray(0, this.o);
  }
}

class BR {
  constructor(buf) {
    this.b = buf;
    this.o = 0;
    this.acc = 0;
    this.n = 0;
  }
  read(bits) {
    if (bits <= 0) return 0;
    if (bits > 16) {
      const hi = this.read(bits - 16);
      const lo = this.read(16);
      return ((hi << 16) | lo) >>> 0;
    }
    while (this.n < bits) {
      if (this.o >= this.b.length) throw new Error("truncated RDOM");
      this.acc = (this.acc << 8) | this.b[this.o++];
      this.n += 8;
    }
    this.n -= bits;
    const v = (this.acc >>> this.n) & ((1 << bits) - 1);
    this.acc &= (1 << this.n) - 1;
    return v;
  }
}

function heapPush(h, node) {
  h.push(node);
  let i = h.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (h[p].f < h[i].f || (h[p].f === h[i].f && h[p].s <= h[i].s)) break;
    const t = h[p];
    h[p] = h[i];
    h[i] = t;
    i = p;
  }
}
function heapPop(h) {
  const top = h[0];
  const last = h.pop();
  if (!h.length) return top;
  h[0] = last;
  let i = 0;
  for (;;) {
    let s = i;
    const l = i * 2 + 1;
    const r = l + 1;
    if (l < h.length && (h[l].f < h[s].f || (h[l].f === h[s].f && h[l].s < h[s].s))) s = l;
    if (r < h.length && (h[r].f < h[s].f || (h[r].f === h[s].f && h[r].s < h[s].s))) s = r;
    if (s === i) break;
    const t = h[i];
    h[i] = h[s];
    h[s] = t;
    i = s;
  }
  return top;
}

function huffmanLengthsUncapped(freq) {
  const n = freq.length;
  const lens = new Uint8Array(n);
  const used = [];
  for (let i = 0; i < n; i++) if (freq[i] > 0) used.push(i);
  if (!used.length) return lens;
  if (used.length === 1) {
    lens[used[0]] = 1;
    return lens;
  }
  const heap = [];
  for (const s of used) heapPush(heap, { f: freq[s], s, l: null, r: null });
  while (heap.length > 1) {
    const a = heapPop(heap);
    const b = heapPop(heap);
    heapPush(heap, { f: a.f + b.f, s: Math.min(a.s, b.s), l: a, r: b });
  }
  const walk = (node, d) => {
    if (!node.l && !node.r) {
      lens[node.s] = Math.max(1, d);
      return;
    }
    walk(node.l, d + 1);
    walk(node.r, d + 1);
  };
  walk(heap[0], 0);
  return lens;
}

function limitHuffman(lens, freq, maxLen) {
  const n = lens.length;
  const full = 1 << maxLen;
  for (let i = 0; i < n; i++) if (lens[i] > maxLen) lens[i] = maxLen;
  let kraft = 0;
  for (let i = 0; i < n; i++) if (lens[i]) kraft += 1 << (maxLen - lens[i]);
  while (kraft > full) {
    let best = -1;
    let bestF = -1;
    for (let i = 0; i < n; i++) {
      if (lens[i] && lens[i] < maxLen && freq[i] >= bestF) {
        bestF = freq[i];
        best = i;
      }
    }
    if (best < 0) break;
    kraft -= 1 << (maxLen - lens[best]);
    lens[best]++;
    kraft += 1 << (maxLen - lens[best]);
  }
  while (kraft < full) {
    let best = -1;
    let bestF = Infinity;
    for (let i = 0; i < n; i++) {
      if (lens[i] > 1 && freq[i] < bestF) {
        bestF = freq[i];
        best = i;
      }
    }
    if (best < 0) break;
    kraft -= 1 << (maxLen - lens[best]);
    lens[best]--;
    kraft += 1 << (maxLen - lens[best]);
  }
}

function huffmanLengths(freq, maxLen = HUFF_MAX) {
  let work = freq;
  let lens = huffmanLengthsUncapped(work);
  for (let round = 0; round < 8; round++) {
    let over = false;
    for (let i = 0; i < lens.length; i++) if (lens[i] > maxLen) over = true;
    if (!over) break;
    const scaled = new Uint32Array(freq.length);
    for (let i = 0; i < freq.length; i++) scaled[i] = freq[i] ? Math.max(1, freq[i] >>> 1) : 0;
    work = scaled;
    lens = huffmanLengthsUncapped(work);
  }
  limitHuffman(lens, freq, maxLen);
  return lens;
}

function canonicalCodes(lens) {
  const n = lens.length;
  const bl = new Uint16Array(HUFF_MAX + 1);
  for (let i = 0; i < n; i++) if (lens[i]) bl[lens[i]]++;
  const next = new Uint32Array(HUFF_MAX + 1);
  let code = 0;
  for (let len = 1; len <= HUFF_MAX; len++) {
    code = (code + bl[len - 1]) << 1;
    next[len] = code;
  }
  const codes = new Uint32Array(n);
  for (let i = 0; i < n; i++) if (lens[i]) codes[i] = next[lens[i]]++;
  return codes;
}

function decodeTable(lens) {
  let max = 0;
  for (let i = 0; i < lens.length; i++) if (lens[i] > max) max = lens[i];
  if (max === 0) return { sym: new Int32Array(1).fill(-1), slen: new Uint8Array(1), max: 0 };
  const size = 1 << max;
  const sym = new Int32Array(size).fill(-1);
  const slen = new Uint8Array(size);
  const codes = canonicalCodes(lens);
  for (let i = 0; i < lens.length; i++) {
    const len = lens[i];
    if (!len) continue;
    const pad = max - len;
    const base = codes[i] << pad;
    for (let k = 0; k < 1 << pad; k++) {
      sym[base + k] = i;
      slen[base + k] = len;
    }
  }
  return { sym, slen, max };
}

function writeLens(w, lens) {
  w.write(lens.length, 16);
  for (let i = 0; i < lens.length; i++) w.write(lens[i], 4);
}
function readLens(r) {
  const n = r.read(16);
  const lens = new Uint8Array(n);
  for (let i = 0; i < n; i++) lens[i] = r.read(4);
  return lens;
}
function writeSym(w, codes, lens, s) {
  w.write(codes[s], lens[s]);
}
function readSym(r, table) {
  if (table.max === 0) throw new Error("empty huffman");
  while (r.n < table.max) {
    if (r.o >= r.b.length) {
      r.acc <<= table.max - r.n;
      r.n = table.max;
      break;
    }
    r.acc = (r.acc << 8) | r.b[r.o++];
    r.n += 8;
  }
  const idx = (r.acc >>> (r.n - table.max)) & ((1 << table.max) - 1);
  const s = table.sym[idx];
  const len = table.slen[idx];
  if (s < 0 || !len) throw new Error("bad huffman");
  r.n -= len;
  r.acc &= (1 << r.n) - 1;
  return s;
}

function hash4(src, i) {
  const v = src[i] | (src[i + 1] << 8) | (src[i + 2] << 16) | (src[i + 3] << 24);
  return (Math.imul(v, 2654435761) >>> (32 - HBITS)) & (HSIZE - 1);
}
function hash3(src, i) {
  const v = src[i] | (src[i + 1] << 8) | (src[i + 2] << 16);
  return (Math.imul(v, 0x9e3779b1) >>> (32 - H3BITS)) & (H3SIZE - 1);
}

function walkChain(src, ip, ref, prev, lim, win, chain, best) {
  let hops = 0;
  while (ref >= 0 && hops++ < chain && ip - ref <= win) {
    if (ref < ip) {
      let n = 0;
      while (n < lim && src[ref + n] === src[ip + n]) n++;
      if (n > best.len) {
        best.len = n;
        best.off = ip - ref;
      }
    }
    ref = prev[ref];
  }
}

function findMatch(src, ip, h4, p4, h3, p3, chain) {
  if (ip + MINM > src.length) return { len: 0, off: 0 };
  const lim = Math.min(MAXM, src.length - ip);
  const best = { len: 0, off: 0 };
  const ch = chain || CHAIN;
  if (ip + 3 < src.length) walkChain(src, ip, h4[hash4(src, ip)], p4, lim, WIN, ch, best);
  walkChain(src, ip, h3[hash3(src, ip)], p3, lim, WIN, ch, best);
  return best;
}

function insert(src, ip, h4, p4, h3, p3) {
  if (ip + 2 < src.length) {
    const a = hash3(src, ip);
    p3[ip] = h3[a];
    h3[a] = ip;
  }
  if (ip + 3 < src.length) {
    const a = hash4(src, ip);
    p4[ip] = h4[a];
    h4[a] = ip;
  }
}

function makePred() {
  return {
    o1: new Uint8Array(256),
    o2: new Uint8Array(65536),
    c2: new Uint16Array(65536),
    b1: 0,
    b2: 0,
    pred() {
      const k = (this.b1 << 8) | this.b2;
      if (this.c2[k] > 2) return this.o2[k];
      return this.o1[this.b2];
    },
    see(b) {
      this.o1[this.b2] = b;
      const k = (this.b1 << 8) | this.b2;
      if (this.o2[k] === b) {
        if (this.c2[k] < 65535) this.c2[k]++;
      } else if (this.c2[k] === 0) {
        this.o2[k] = b;
        this.c2[k] = 1;
      } else this.c2[k]--;
      this.b1 = this.b2;
      this.b2 = b;
    },
  };
}

function collectMatches(src) {
  const n = src.length;
  const bestLen = new Uint16Array(n);
  const bestOff = new Uint32Array(n);
  const h4 = new Int32Array(HSIZE).fill(-1);
  const p4 = new Int32Array(n).fill(-1);
  const h3 = new Int32Array(H3SIZE).fill(-1);
  const p3 = new Int32Array(n).fill(-1);
  let ins = 0;
  const catchup = (to) => {
    while (ins < to && ins < n) {
      insert(src, ins, h4, p4, h3, p3);
      ins++;
    }
  };
  for (let ip = 0; ip < n; ip++) {
    catchup(ip + 1);
    const m = findMatch(src, ip, h4, p4, h3, p3, n > 400000 ? 72 : CHAIN);
    bestLen[ip] = m.len;
    bestOff[ip] = m.off;
  }
  return { bestLen, bestOff };
}

function distTokCached(off, last) {
  for (let i = 0; i < LAST_D; i++) if (last[i] === off) return [i, 0, 0];
  const [d, e, v] = distTok(off);
  return [d + LAST_D, e, v];
}
function pushLast(last, off) {
  if (last[0] === off) return;
  last[2] = last[1];
  last[1] = last[0];
  last[0] = off;
}

function matchBits(len, off, litLens, distLens, last) {
  const [ls, le] = lenTok(len);
  const [ds, de] = distTokCached(off, last || [0, 0, 0]);
  const a = litLens ? litLens[ls] || 15 : 10;
  const b = distLens ? distLens[ds] || 15 : 8;
  return a + le + b + de;
}

function dpParse(src, bestLen, bestOff, litLens, distLens) {
  const n = src.length;
  const cost = new Float64Array(n + 1);
  const take = new Int32Array(n);
  const litP = 8.5;
  cost[n] = 0;
  for (let i = n - 1; i >= 0; i--) {
    let best = litP + cost[i + 1];
    let choice = 0;
    const L = bestLen[i];
    if (L >= MINM) {
      const off = bestOff[i];
      const maxL = Math.min(L, n - i);
      const hi = Math.min(maxL, 64);
      for (let len = MINM; len <= hi; len++) {
        const c = matchBits(len, off, litLens, distLens) + cost[i + len];
        if (c < best) {
          best = c;
          choice = len;
        }
      }
      if (maxL > 64) {
        for (let len = 96; len < maxL; len += 32) {
          const c = matchBits(len, off, litLens, distLens) + cost[i + len];
          if (c < best) {
            best = c;
            choice = len;
          }
        }
        const c = matchBits(maxL, off, litLens, distLens) + cost[i + maxL];
        if (c < best) {
          best = c;
          choice = maxL;
        }
      }
    }
    cost[i] = best;
    take[i] = choice;
  }
  const toks = [];
  const pred = makePred();
  let ip = 0;
  while (ip < n) {
    const len = take[ip];
    if (len > 0) {
      toks.push({ t: "M", len, off: bestOff[ip] });
      for (let k = 0; k < len; k++) pred.see(src[ip + k]);
      ip += len;
    } else {
      toks.push({ t: "L", res: src[ip] ^ pred.pred() });
      pred.see(src[ip]);
      ip++;
    }
  }
  return toks;
}

function freqsOf(toks, lastIn) {
  const litF = new Uint32Array(LIT_N);
  const distF = new Uint32Array(DIST_N);
  const last = lastIn ? lastIn.slice() : [0, 0, 0];
  for (const t of toks) {
    if (t.t === "L") litF[t.res]++;
    else {
      litF[lenTok(t.len)[0]]++;
      distF[distTokCached(t.off, last)[0]]++;
      pushLast(last, t.off);
    }
  }
  litF[EOB]++;
  return { litF, distF };
}

function parse(src) {
  const { bestLen, bestOff } = collectMatches(src);
  let toks = dpParse(src, bestLen, bestOff, null, null);
  const { litF, distF } = freqsOf(toks);
  const litLens = huffmanLengths(litF);
  const distLens = huffmanLengths(distF);
  toks = dpParse(src, bestLen, bestOff, litLens, distLens);
  return toks;
}

export function encodeReal(buf) {
  const src = Buffer.from(buf);
  const toks = parse(src);
  const { litF, distF } = freqsOf(toks);
  const litLens = huffmanLengths(litF);
  const distLens = huffmanLengths(distF);
  const litCodes = canonicalCodes(litLens);
  const distCodes = canonicalCodes(distLens);
  const w = new BW(src.length + 2048);
  w.write(src.length >>> 0, 32);
  writeLens(w, litLens);
  writeLens(w, distLens);
  const lastW = [0, 0, 0];
  for (const t of toks) {
    if (t.t === "L") writeSym(w, litCodes, litLens, t.res);
    else {
      const [ls, le, lv] = lenTok(t.len);
      const [ds, de, dv] = distTokCached(t.off, lastW);
      writeSym(w, litCodes, litLens, ls);
      w.write(lv, le);
      writeSym(w, distCodes, distLens, ds);
      w.write(dv, de);
      pushLast(lastW, t.off);
    }
  }
  writeSym(w, litCodes, litLens, EOB);
  return Buffer.concat([MAGIC, Buffer.from([KIND]), w.finish()]);
}

export function decodeReal(frame) {
  if (frame.length < 6 || frame.subarray(0, 4).toString() !== "RDOM" || (frame[4] !== KIND && frame[4] !== 4)) {
    throw new Error("not RDOM/5");
  }
  const r = new BR(frame.subarray(5));
  const n = r.read(32);
  const litLens = readLens(r);
  const distLens = readLens(r);
  const litTab = decodeTable(litLens);
  const distTab = decodeTable(distLens);
  const out = Buffer.alloc(n);
  const pred = makePred();
  const last = [0, 0, 0];
  let op = 0;
  while (op < n) {
    const s = readSym(r, litTab);
    if (s === EOB) break;
    if (s < 256) {
      const b = s ^ pred.pred();
      out[op++] = b;
      pred.see(b);
    } else {
      const li = s - LEN0;
      const extra = li === 28 ? 12 : LEN_EXTRA[li];
      const base = li === 28 ? 258 : LEN_BASE[li];
      const len = base + r.read(extra);
      const ds = readSym(r, distTab);
      let off;
      if (ds < LAST_D) off = last[ds];
      else off = DIST_BASE[ds - LAST_D] + r.read(DIST_EXTRA[ds - LAST_D]);
      for (let k = 0; k < len; k++) {
        const b = out[op - off];
        out[op++] = b;
        pred.see(b);
      }
      pushLast(last, off);
    }
  }
  if (op !== n) throw new Error(`RDOM length ${op} != ${n}`);
  return out;
}

export function leftoverAfterParse(buf) {
  const src = Buffer.from(buf);
  const toks = parse(src);
  let lit = 0;
  let z = 0;
  let match = 0;
  for (const t of toks) {
    if (t.t === "L") {
      lit++;
      if (t.res === 0) z++;
    } else match += t.len;
  }
  return { literals: lit, leftover0: z, match_bytes: match, n: buf.length };
}
