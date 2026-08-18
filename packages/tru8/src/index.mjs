/**
 * TRU8 public demo — token paths only.
 * Production residual / Continuous-1088 / T_SPARSE internals stay licensed.
 */
import { assertTru8Box } from "./box.mjs";

export const T_ZERO = 0x00;
export const T_DICT = 0x01;
export const T_SPARSE = 0x03;
export const T_TRISUM_HOT = 0x10;
export const T_STROKE = 0x11;

export const ALPHABET = " etaoinsrhldcumwfgypbvkjxqz.,!?\n";

const ACCESS = "https://www.slidphilabs.com/access?product=tru8-year";
const DEMOS = "https://www.slidphilabs.com/demos";
const INQUIRE = "mailto:corey@slidphilabs.com?subject=TRU8";
const CREDIT = "Powered by TRU8 · Slid Phi Labs";

export class LicensedPathError extends Error {
  constructor(token = "T_SPARSE") {
    super(
      `${token} is licensed residual. Public npm is the demo surface. Demos: ${DEMOS} · Year $990: ${ACCESS} · ${INQUIRE}`,
    );
    this.name = "LicensedPathError";
    this.token = token;
    this.access = ACCESS;
  }
}

function charTo5(c) {
  const i = ALPHABET.indexOf(String.fromCharCode(c));
  return i >= 0 ? i : 0;
}

export function triToSum(tri) {
  const b = Buffer.from(tri).subarray(0, 3);
  const pad = Buffer.concat([b, Buffer.from("   ")]).subarray(0, 3);
  return (charTo5(pad[0]) << 10) | (charTo5(pad[1]) << 5) | charTo5(pad[2]);
}

export function packZeroRun(length) {
  const n = Number(length) >>> 0;
  const out = Buffer.alloc(8);
  out[0] = T_ZERO;
  out.writeUInt32LE(n, 1);
  return out;
}

export function unpackZeroRun(buf) {
  const b = Buffer.from(buf);
  if (b.length < 8 || b[0] !== T_ZERO) throw new Error("not a T_ZERO frame");
  return { token: "T_ZERO", length: b.readUInt32LE(1) };
}

export function packDictPtr(dictId = 0, offset = 0) {
  const out = Buffer.alloc(8);
  out[0] = T_DICT;
  out.writeUInt16LE(dictId & 0xffff, 1);
  out.writeUInt32LE(offset >>> 0, 3);
  return out;
}

export function unpackDictPtr(buf) {
  const b = Buffer.from(buf);
  if (b.length < 8 || b[0] !== T_DICT) throw new Error("not a T_DICT frame");
  return { token: "T_DICT", dictId: b.readUInt16LE(1), offset: b.readUInt32LE(3) };
}

export function packTrisumHot(hotId) {
  return Buffer.from([T_TRISUM_HOT, hotId & 0xff]);
}

export { encodeStroke, decodeStroke, isLosslessStroke, looksText, probePath } from "./stroke-ls.mjs";
import { encodeStroke, decodeStroke, isLosslessStroke } from "./stroke-ls.mjs";

/**
 * T_STROKE — Gregg / Pitman residual (public demo, lossy).
 *
 * Gregg ≡ Major System: vowels dropped, consonants collapse to 16 classes.
 * First 10 classes are Major digits 0–9 (s t n m r l ʃ k f p).
 * Pitman thickness is the voiced bit (t/d, k/g, f/v, p/b, s/z, ʃ/ʒ, θ/ð).
 *
 * Not a licensed path. compress() stays zeros-only. expand is the skeleton,
 * never the original bytes.
 */
export const STROKE = Object.freeze({
  S: 0,
  T: 1,
  N: 2,
  M: 3,
  R: 4,
  L: 5,
  J: 6,
  K: 7,
  F: 8,
  P: 9,
  SEP: 10,
  TH: 11,
  NG: 12,
  H: 13,
  W: 14,
  Y: 15,
});

export const STROKE_NAME = Object.freeze([
  "s", "t", "n", "m", "r", "l", "ʃ", "k", "f", "p", "·", "θ", "ŋ", "h", "w", "y",
]);
export const STROKE_VOICED_NAME = Object.freeze([
  "z", "d", "n", "m", "r", "l", "ʒ", "g", "v", "b", "·", "ð", "ŋ", "h", "w", "y",
]);
export const STROKE_PITMAN_THIN = Object.freeze([
  ",", "|", ")", "]", "/", "\\", "~", "<", "(", "o", "·", "-", "^", "'", "u", "j",
]);
export const STROKE_PITMAN_THICK = Object.freeze([
  ";", "I", "}", "M", "7", "L", "$", ">", "{", "O", "·", "=", "+", "\"", "U", "J",
]);

const VOWEL = new Set("aeiou");
const MAJOR_DIGIT = Object.freeze([
  STROKE.S, STROKE.T, STROKE.N, STROKE.M, STROKE.R,
  STROKE.L, STROKE.J, STROKE.K, STROKE.F, STROKE.P,
]);
const VOICED_TH = /^(the|this|that|them|then|than|they|their|there|these|those|though|thy|thee)(?![a-z])/;
const WORD_BREAK = /[\s_\-./\\|:;,!?+'"]/;
const MAX_STROKE_TEXT = 4096;

export function textToStrokes(input = "", { why = false, max = MAX_STROKE_TEXT } = {}) {
  const raw = String(input).toLowerCase();
  const s = Number.isFinite(max) && max >= 0 ? raw.slice(0, max) : raw;
  const classes = [];
  const voiced = [];

  const push = (cls, v = false) => {
    if (cls === STROKE.SEP && classes[classes.length - 1] === STROKE.SEP) return;
    if ((cls === STROKE.H || cls === STROKE.W || cls === STROKE.Y) && !why) return;
    // Gregg: a doubled consonant is one stroke
    const last = classes.length - 1;
    if (last >= 0 && classes[last] === cls && voiced[last] === !!v && cls !== STROKE.SEP) return;
    classes.push(cls);
    voiced.push(!!v);
  };

  for (let i = 0; i < s.length; ) {
    const c = s[i];
    const two = s.slice(i, i + 2);
    const rest = s.slice(i);

    if (two === "sh" || two === "ch") {
      push(STROKE.J, false);
      i += 2;
      continue;
    }
    if (two === "zh") {
      push(STROKE.J, true);
      i += 2;
      continue;
    }
    if (two === "th") {
      push(STROKE.TH, VOICED_TH.test(rest));
      i += 2;
      continue;
    }
    if (two === "ng") {
      push(STROKE.NG);
      i += 2;
      continue;
    }
    if (two === "nk") {
      push(STROKE.NG);
      push(STROKE.K, false);
      i += 2;
      continue;
    }
    if (two === "ph") {
      push(STROKE.F, false);
      i += 2;
      continue;
    }
    if (two === "ck") {
      push(STROKE.K, false);
      i += 2;
      continue;
    }
    if (two === "qu") {
      push(STROKE.K, false);
      i += 2;
      continue;
    }
    if (two === "wh") {
      if (why) push(STROKE.W);
      i += 2;
      continue;
    }
    if (two === "kn") {
      push(STROKE.N);
      i += 2;
      continue;
    }
    if (two === "wr") {
      push(STROKE.R);
      i += 2;
      continue;
    }

    if (c >= "0" && c <= "9") {
      push(MAJOR_DIGIT[c.charCodeAt(0) - 48]);
      i += 1;
      continue;
    }
    if (VOWEL.has(c)) {
      i += 1;
      continue;
    }
    if (c === "t") {
      push(STROKE.T, false);
      i += 1;
      continue;
    }
    if (c === "d") {
      push(STROKE.T, true);
      i += 1;
      continue;
    }
    if (c === "n") {
      push(STROKE.N);
      i += 1;
      continue;
    }
    if (c === "m") {
      push(STROKE.M);
      i += 1;
      continue;
    }
    if (c === "r") {
      push(STROKE.R);
      i += 1;
      continue;
    }
    if (c === "l") {
      push(STROKE.L);
      i += 1;
      continue;
    }
    if (c === "j") {
      push(STROKE.J, true);
      i += 1;
      continue;
    }
    if (c === "k" || c === "q") {
      push(STROKE.K, false);
      i += 1;
      continue;
    }
    if (c === "g") {
      push(STROKE.K, true);
      i += 1;
      continue;
    }
    if (c === "f") {
      push(STROKE.F, false);
      i += 1;
      continue;
    }
    if (c === "v") {
      push(STROKE.F, true);
      i += 1;
      continue;
    }
    if (c === "p") {
      push(STROKE.P, false);
      i += 1;
      continue;
    }
    if (c === "b") {
      push(STROKE.P, true);
      i += 1;
      continue;
    }
    if (c === "s") {
      push(STROKE.S, false);
      i += 1;
      continue;
    }
    if (c === "z") {
      push(STROKE.S, true);
      i += 1;
      continue;
    }
    if (c === "x") {
      push(STROKE.K, false);
      push(STROKE.S, false);
      i += 1;
      continue;
    }
    if (c === "c") {
      const n = s[i + 1];
      push(n === "e" || n === "i" || n === "y" ? STROKE.S : STROKE.K, false);
      i += 1;
      continue;
    }
    if (c === "h") {
      push(STROKE.H);
      i += 1;
      continue;
    }
    if (c === "w") {
      push(STROKE.W);
      i += 1;
      continue;
    }
    if (c === "y") {
      push(STROKE.Y);
      i += 1;
      continue;
    }
    if (WORD_BREAK.test(c)) {
      push(STROKE.SEP);
      i += 1;
      continue;
    }
    i += 1;
  }

  while (classes[0] === STROKE.SEP) {
    classes.shift();
    voiced.shift();
  }
  while (classes[classes.length - 1] === STROKE.SEP) {
    classes.pop();
    voiced.pop();
  }

  return { classes, voiced, why: !!why };
}

export function strokesToSkeleton(strokes) {
  const { classes, voiced } = strokes;
  return classes.map((c, i) => (voiced[i] ? STROKE_VOICED_NAME : STROKE_NAME)[c]).join("");
}

export function strokesToPitman(strokes) {
  const { classes, voiced } = strokes;
  return classes
    .map((c, i) => (voiced[i] ? STROKE_PITMAN_THICK : STROKE_PITMAN_THIN)[c])
    .join(" ");
}

function asStrokeInput(input, opts) {
  if (input && Array.isArray(input.classes)) return input;
  return textToStrokes(input ?? "", opts);
}

export function packStrokes(input, opts) {
  const strokes = asStrokeInput(input, opts);
  const n = strokes.classes.length;
  if (n > 0xffff) throw new Error("T_STROKE count exceeds u16");
  const width = 5;
  const values = strokes.classes.map((c, i) => ((c & 0x0f) << 1) | (strokes.voiced[i] ? 1 : 0));
  const out = Buffer.alloc(4 + Math.ceil((n * width) / 8));
  out[0] = T_STROKE;
  out[1] = 0x01 | (strokes.why ? 0x02 : 0);
  out.writeUInt16LE(n, 2);
  let acc = 0;
  let have = 0;
  let o = 4;
  for (const v of values) {
    acc = (acc << width) | v;
    have += width;
    while (have >= 8) {
      have -= 8;
      out[o++] = (acc >>> have) & 0xff;
      acc &= (1 << have) - 1;
    }
  }
  if (have) out[o] = (acc << (8 - have)) & 0xff;
  return out;
}

export function unpackStrokes(buf) {
  const b = Buffer.from(buf);
  if (b.length < 4 || b[0] !== T_STROKE) throw new Error("not a T_STROKE frame");
  const flags = b[1];
  const width = flags & 1 ? 5 : 4;
  const why = !!(flags & 2);
  const n = b.readUInt16LE(2);
  const classes = [];
  const voiced = [];
  let acc = 0;
  let have = 0;
  let o = 4;
  const mask = (1 << width) - 1;
  for (let i = 0; i < n; i++) {
    while (have < width) {
      if (o >= b.length) throw new Error("truncated T_STROKE");
      acc = (acc << 8) | b[o++];
      have += 8;
    }
    have -= width;
    const v = (acc >>> have) & mask;
    acc &= have ? (1 << have) - 1 : 0;
    if (width === 5) {
      classes.push((v >>> 1) & 0x0f);
      voiced.push(!!(v & 1));
    } else {
      classes.push(v & 0x0f);
      voiced.push(false);
    }
  }
  return { token: "T_STROKE", classes, voiced, why, count: n };
}

export function expandZeros(frame, { max = 8_388_608 } = {}) {
  const { length } = unpackZeroRun(frame);
  if (length > max) {
    throw new Error(`public expand cap ${max} B — production residual expands licensed runs. ${ACCESS}`);
  }
  return Buffer.alloc(length);
}

function asBuf(input) {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input);
  if (typeof input === "string") return Buffer.from(input);
  throw new TypeError("expected Buffer, Uint8Array, or string");
}

/**
 * Public pack. Zeros → T_ZERO. Everything else → lossless T_STROKE
 * (piece / Δ+LZ / fast LZ via 64 KiB probe). T_SPARSE stays licensed.
 */
export function compress(input) {
  assertTru8Box();
  return encodeStroke(asBuf(input));
}

/** Public decompress: T_ZERO and lossless T_STROKE. */
export function decompress(frame, opts) {
  assertTru8Box();
  const b = asBuf(frame);
  if (b[0] === T_ZERO) return expandZeros(b, opts);
  if (b[0] === T_STROKE && isLosslessStroke(b)) return decodeStroke(b);
  if (b[0] === T_SPARSE) throw new LicensedPathError("T_SPARSE");
  throw new LicensedPathError(`token 0x${b[0].toString(16)}`);
}

export function demoZeros(n = 1_000_000) {
  const packed = packZeroRun(n);
  return {
    name: "zeros",
    token: "T_ZERO",
    raw_bytes: n,
    tru8_bytes: packed.length,
    ratio: n / packed.length,
    packed_hex: packed.toString("hex"),
    credit: CREDIT,
  };
}

export function demoTrigram(word = "the", count = 1000) {
  const raw = word.length * count;
  const s = triToSum(word);
  const tru8 = 2 + count;
  return {
    name: "trisum_hot",
    token: "T_TRISUM_HOT",
    raw_bytes: raw,
    tru8_bytes: tru8,
    sum: s,
    sum_hex: `0x${s.toString(16).padStart(4, "0")}`,
    ratio_saving_pct: (1 - tru8 / raw) * 100,
    credit: CREDIT,
  };
}

export function demoDictBlock(blockSize = 1024, hits = 100) {
  const raw = blockSize * hits;
  const one = packDictPtr(0, 0);
  const tru8 = one.length * hits;
  return {
    name: "dict_1kb",
    token: "T_DICT",
    raw_bytes: raw,
    tru8_bytes: tru8,
    ratio: raw / tru8,
    credit: CREDIT,
  };
}

export function demoStroke(text = "the residual file", opts) {
  const src = String(text);
  const strokes = textToStrokes(src, opts);
  const packed = encodeStroke(src);
  const back = decodeStroke(packed);
  const raw = Buffer.byteLength(src);
  return {
    name: "stroke",
    token: "T_STROKE",
    raw_bytes: raw,
    tru8_bytes: packed.length,
    ratio: packed.length ? raw / packed.length : 0,
    strokes: strokes.classes.length,
    skeleton: strokesToSkeleton(strokes),
    pitman: strokesToPitman(strokes),
    packed_hex: packed.length <= 64 ? packed.toString("hex") : packed.subarray(0, 32).toString("hex") + "…",
    lossy: false,
    roundtrip: Buffer.from(src).equals(back),
    note: "T_STROKE lossless — our piece dictionary + Huffman (text) / LZ + Huffman (binary). Skeleton is still the Gregg/Pitman view.",
    credit: CREDIT,
  };
}

export const credit = CREDIT;
export const licensed = {
  access: ACCESS,
  demos: DEMOS,
  inquire: INQUIRE,
  sku: "tru8-year",
  amount_usd: "1900.00",
};

export default {
  T_ZERO,
  T_DICT,
  T_SPARSE,
  T_TRISUM_HOT,
  T_STROKE,
  compress,
  decompress,
  packZeroRun,
  unpackZeroRun,
  packDictPtr,
  unpackDictPtr,
  packTrisumHot,
  packStrokes,
  unpackStrokes,
  encodeStroke,
  decodeStroke,
  textToStrokes,
  strokesToSkeleton,
  strokesToPitman,
  triToSum,
  demoZeros,
  demoTrigram,
  demoDictBlock,
  demoStroke,
  LicensedPathError,
  credit,
  licensed,
};
