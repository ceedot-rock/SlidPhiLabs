/**
 * slid-phi hybrid11 prototype
 * Codes with at most one consecutive "11", terminator "111", optional low-bits.
 * Classic Fib remains preferred for geometric postings deltas.
 */

function count11(s) {
  let c = 0;
  for (let i = 0; i < s.length - 1; i++) if (s[i] === "1" && s[i + 1] === "1") c++;
  return c;
}

/** Build encode/decode maps for 1..N using bitstrings with ≤ allow11 consecutive pairs */
export function buildCodeMaps(N, allow11 = 1) {
  const codes = [];
  for (let L = 1; L <= 28 && codes.length < N + 8; L++) {
    const limit = 1 << L;
    for (let v = 0; v < limit; v++) {
      const s = v.toString(2).padStart(L, "0");
      if (L > 1 && s[0] === "0") continue;
      if (count11(s) <= allow11) codes.push(s);
    }
  }
  codes.sort((a, b) => a.length - b.length || a.localeCompare(b));
  const enc = new Map();
  const dec = new Map();
  for (let n = 1; n <= N && n - 1 < codes.length; n++) {
    enc.set(n, codes[n - 1]);
    dec.set(codes[n - 1], n);
  }
  return { enc, dec, size: enc.size };
}

const TERM = "111";

/**
 * Encode n >= 1
 * @param {number} n
 * @param {{enc:Map}} maps from buildCodeMaps on high parts
 * @param {number} lowBits k
 */
export function encodeHybrid11(n, maps, lowBits = 4) {
  if (n < 1) throw new Error("n must be >= 1");
  const mask = (1 << lowBits) - 1;
  const lo = n & mask;
  const hi = n >> lowBits;
  const loStr = lo.toString(2).padStart(lowBits, "0");
  if (hi === 0) return "0" + TERM + loStr;
  const core = maps.enc.get(hi);
  if (!core) throw new Error("hi out of codebook range: " + hi);
  return core + TERM + loStr;
}

export function decodeHybrid11(bits, maps, lowBits = 4) {
  const idx = bits.lastIndexOf(TERM);
  if (idx < 0) throw new Error("missing terminator");
  const core = bits.slice(0, idx);
  const lo = parseInt(bits.slice(idx + TERM.length, idx + TERM.length + lowBits) || "0", 2);
  if (core === "0" || core === "") return lo;
  const hi = maps.dec.get(core);
  if (hi == null) throw new Error("unknown core code");
  return (hi << lowBits) + lo;
}

/** Quick self-test */
export function selfTest(N = 2000, lowBits = 4) {
  const maxHi = Math.ceil(N / (1 << lowBits)) + 2;
  const maps = buildCodeMaps(maxHi, 1);
  let ok = 0;
  for (let n = 1; n <= N; n++) {
    const b = encodeHybrid11(n, maps, lowBits);
    if (decodeHybrid11(b, maps, lowBits) === n) ok++;
  }
  return { ok, N, rate: ok / N };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("hybrid11.mjs")) {
  const r = selfTest(3000, 4);
  console.log("hybrid11 selfTest", r);
  const maps = buildCodeMaps(512, 1);
  let bits = 0;
  for (let n = 1; n <= 3000; n++) bits += encodeHybrid11(n, maps, 4).length;
  console.log("avg bits 1..3000", (bits / 3000).toFixed(4));
}
