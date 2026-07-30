/**
 * slid-phi rANS — optional gap-block entropy mode
 *
 * DORMANT unless called (mode='rans').
 * For postings / delta BLOCKS only — not single integers.
 *
 * Data (packed histogram header, alphabet 1..64):
 *   B < 1024  → classic usually better (header tax)
 *   B ≥ 2048  → rANS wins ~3–20% vs classic on geo gaps
 *   B = 4096  → ~7–21% smaller than classic
 *
 * Single ints / dense IDs: use classic or hybrid_locked instead.
 */

export const RANS_META = {
  mode: "rans",
  dormant: true,
  min_block_recommend: 2048,
  alphabet_default: 64,
  note: "Approaches ideal minimum on large gap blocks after header amortizes",
};

const R = 12;
const RMASK = (1 << R) - 1;

function buildTable(counts) {
  const L = counts.reduce((a, b) => a + b, 0);
  const cumul = new Array(counts.length + 1);
  cumul[0] = 0;
  for (let i = 0; i < counts.length; i++) cumul[i + 1] = cumul[i] + counts[i];
  return { counts, cumul, L };
}

/** Build histogram; floor zero-bins to 1 for stable table */
export function histogram(block, maxVal = 64) {
  const counts = new Array(maxVal + 1).fill(0);
  for (const x of block) {
    if (x < 1 || x > maxVal) throw new Error("symbol out of range: " + x);
    counts[x]++;
  }
  for (let i = 1; i <= maxVal; i++) if (counts[i] === 0) counts[i] = 1;
  return counts;
}

/** Packed header size estimate: maxVal * ceil(log2(B+1)) */
export function headerBitsEstimate(maxVal, blockLen) {
  return maxVal * Math.ceil(Math.log2(blockLen + 1));
}

/**
 * Encode a gap block with rANS (bit-cost + artifacts).
 * Does not yet emit a portable bitstream container — use for sizing / research.
 */
export function encodeRansBlock(block, maxVal = 64) {
  if (!block.length) throw new Error("empty block");
  const counts = histogram(block, maxVal);
  const { L, cumul } = buildTable(counts);
  let s = 1 << R;
  const stream = [];

  for (let i = block.length - 1; i >= 0; i--) {
    const x = block[i];
    const freq = counts[x];
    const maxState = freq * (1 << R);
    while (s >= maxState) {
      stream.push(s & RMASK);
      s >>>= R;
    }
    s = Math.floor(s / freq) * L + cumul[x] + (s % freq);
  }

  const stateBits = Math.ceil(Math.log2(s + 1));
  const payloadBits = stateBits + stream.length * R;
  const headerBits = headerBitsEstimate(maxVal, block.length);

  return {
    payloadBits,
    headerBits,
    totalBits: payloadBits + headerBits,
    bitsPerSym: (payloadBits + headerBits) / block.length,
    payloadPerSym: payloadBits / block.length,
    state: s,
    stream,
    counts,
    n: block.length,
  };
}
