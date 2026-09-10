/**
 * Hosted AWARE affine_i32 helpers — JS twin of lbr1 splb::poly affine_i32.
 *
 * Metadata / pricing / tests only. Kolmogorov seating (18 B aware_bytes crown)
 * rides rebuilt docs/site/bin/lb from ceedot-rock/lbr1 main via `lb aware`.
 * Do not claim the crown off this twin alone — see FLY_PUBLIC.md Ship refresh.
 *
 * Wire (LBHX KIND_POLY carries raw_len outside):
 *   affine_i32 (model_id=3): model_id | start:i64 | step:i64 | flag
 *     | [zlib-9(i32 LE residuals) if flag==0]
 */
import { inflateSync } from "node:zlib";

export const MODEL_AFFINE_I32 = 3;
export const KIND_POLY = 4;
export const AFFINE_I32_ZERO_HEADER = 18; // 1+8+8+1
export const LBHX_HDR = 13;

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

function unzlib(bytes) {
  return inflateSync(Buffer.from(bytes));
}

/** Exact affine: start + i*step (wrapping i64→i32). Returns null if any residual. */
export function fitAffineExact(vals) {
  if (!vals || vals.length < 1) return null;
  const start = BigInt(vals[0] | 0);
  const step =
    vals.length >= 2
      ? BigInt(vals[1] | 0) - start
      : 0n;
  for (let i = 0; i < vals.length; i++) {
    // Match Rust: (start.wrapping_add(step.wrapping_mul(i))) as i32
    const pred = Number(BigInt.asIntN(32, start + step * BigInt(i)));
    if ((vals[i] | 0) !== pred) return null;
  }
  return { start, step };
}

export function packAffineInner(start, step, residualBytesOrNull) {
  const out = Buffer.allocUnsafe(
    residualBytesOrNull
      ? AFFINE_I32_ZERO_HEADER + residualBytesOrNull.length
      : AFFINE_I32_ZERO_HEADER
  );
  out[0] = MODEL_AFFINE_I32;
  out.writeBigInt64LE(start, 1);
  out.writeBigInt64LE(step, 9);
  if (!residualBytesOrNull) {
    out[17] = 1;
    return out;
  }
  out[17] = 0;
  Buffer.from(residualBytesOrNull).copy(out, 18);
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
  if (b.length < LBHX_HDR || b.subarray(0, 4).toString("latin1") !== "LBHX")
    return null;
  const rawLen = b.readUInt32LE(4);
  const kind = b[8];
  const innerLen = b.readUInt32LE(9);
  if (13 + innerLen !== b.length) return null;
  return { kind, rawLen, inner: b.subarray(13) };
}

export function unpackAffineInner(inner, nVals) {
  const b = Buffer.from(inner);
  if (b.length < AFFINE_I32_ZERO_HEADER) throw new Error("affine hdr");
  if (b[0] !== MODEL_AFFINE_I32) throw new Error("not_affine");
  const start = b.readBigInt64LE(1);
  const step = b.readBigInt64LE(9);
  const flag = b[17];
  let res;
  if (flag === 1) {
    if (b.length !== AFFINE_I32_ZERO_HEADER) throw new Error("affine flag1 trailing");
    res = new Int32Array(nVals);
  } else if (flag === 0) {
    const inflated = unzlib(b.subarray(18));
    if (inflated.length !== nVals * 4) throw new Error("affine res len");
    res = parseI32le(inflated);
    if (!res || res.length !== nVals) throw new Error("affine res parse");
  } else {
    throw new Error("affine flag");
  }
  const out = new Int32Array(nVals);
  for (let i = 0; i < nVals; i++) {
    const pred = Number(BigInt.asIntN(32, start + step * BigInt(i)));
    out[i] = (pred + (res[i] | 0)) | 0;
  }
  return {
    vals: out,
    modelId: MODEL_AFFINE_I32,
    model: "affine_i32",
    start: Number(start),
    step: Number(step),
  };
}

/** Inspect an LBHX aware blob for affine_i32 (model_id 3). */
export function inspectAffineProgram(blob) {
  const u = unwrapLbhx(blob);
  if (!u || u.kind !== KIND_POLY || !u.inner.length) return null;
  if (u.inner[0] !== MODEL_AFFINE_I32) return null;
  if (u.inner.length < AFFINE_I32_ZERO_HEADER) return null;
  return {
    model: "affine_i32",
    model_id: MODEL_AFFINE_I32,
    start: Number(u.inner.readBigInt64LE(1)),
    step: Number(u.inner.readBigInt64LE(9)),
    aware_bytes: u.inner.length,
    frame_bytes: Buffer.from(blob).length,
    raw_bytes: u.rawLen,
  };
}

/**
 * Price exact affine_i32 from raw i32-aligned bytes (SKU metadata).
 * Only when residuals are identically zero → 18 B crown.
 */
export function priceAffineProgram(raw) {
  const vals = parseI32le(raw);
  if (!vals || vals.length < 2) return null;
  const fit = fitAffineExact(vals);
  if (!fit) return null;
  return {
    model: "affine_i32",
    model_id: MODEL_AFFINE_I32,
    start: Number(fit.start),
    step: Number(fit.step),
    aware_bytes: AFFINE_I32_ZERO_HEADER,
    raw_bytes: Buffer.from(raw).length,
    seating: "bin/lb aware (lbr1 main)",
  };
}

export function decodeLbhxAffine(buf) {
  const u = unwrapLbhx(buf);
  if (!u || u.kind !== KIND_POLY || !u.inner.length) return null;
  if (u.inner[0] !== MODEL_AFFINE_I32) return null;
  if (u.rawLen % 4 !== 0) return null;
  const { vals, model, modelId, start, step } = unpackAffineInner(
    u.inner,
    u.rawLen / 4
  );
  const out = emitI32le(vals);
  if (out.length !== u.rawLen) throw new Error("poly out len");
  return {
    raw: out,
    model,
    modelId,
    start,
    step,
    awareBytes: u.inner.length,
  };
}

