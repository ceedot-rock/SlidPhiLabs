/**
 * TRU8 public demo — token paths only.
 * Production residual / Continuous-1088 / T_SPARSE internals stay licensed.
 */
export const T_ZERO = 0x00;
export const T_DICT = 0x01;
export const T_SPARSE = 0x03;
export const T_TRISUM_HOT = 0x10;

export const ALPHABET = " etaoinsrhldcumwfgypbvkjxqz.,!?\n";

const ACCESS = "https://www.slidphilabs.com/access?product=tru8-year";
const DEMOS = "https://www.slidphilabs.com/demos";
const INQUIRE = "mailto:corey@slidphilabs.com?subject=TRU8";
const CREDIT = "Powered by TRU8 · Slid Phi Labs";

export class LicensedPathError extends Error {
  constructor(token = "T_SPARSE") {
    super(
      `${token} is licensed residual. Public npm is the demo surface. Demos: ${DEMOS} · Year $1,900: ${ACCESS} · ${INQUIRE}`,
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

/** Public compress: all-zero buffers only. Anything else is licensed. */
export function compress(input) {
  const b = asBuf(input);
  if (b.length === 0) return packZeroRun(0);
  for (let i = 0; i < b.length; i++) {
    if (b[i] !== 0) throw new LicensedPathError("non-zero");
  }
  return packZeroRun(b.length);
}

/** Public decompress: T_ZERO frames only. */
export function decompress(frame, opts) {
  const b = asBuf(frame);
  if (b[0] === T_ZERO) return expandZeros(b, opts);
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
  compress,
  decompress,
  packZeroRun,
  unpackZeroRun,
  packDictPtr,
  unpackDictPtr,
  packTrisumHot,
  triToSum,
  demoZeros,
  demoTrigram,
  demoDictBlock,
  LicensedPathError,
  credit,
  licensed,
};
