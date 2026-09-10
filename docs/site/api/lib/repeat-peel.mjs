/**
 * Hosted AWARE byte-repeat helpers — JS twin of lbr1 splb::poly MODEL_REPEAT.
 *
 * Metadata / pricing / tests only. Kolmogorov seating (33 B / 61 B aware crowns
 * on published periodic fixtures) rides rebuilt docs/site/bin/lb from
 * ceedot-rock/lbr1 main via `lb aware`. Do not claim the crown off this twin
 * alone — see FLY_PUBLIC.md Ship refresh.
 *
 * Wire (LBHX KIND_POLY carries raw_len outside):
 *   repeat (model_id=7): model_id | unit_len:u32 | unit_bytes | n:u32
 *   decoder: repeat(unit)[:n]  (byte-wise wrap; rem mandatory)
 *
 * Crowns: text_repeat_256k → 33 B aware (period 24); json_128k → 61 B (period 52).
 */
import { wrapLbhxPoly, unwrapLbhx, KIND_POLY, LBHX_HDR } from "./walk-peel.mjs";

export const MODEL_REPEAT = 7;
export const REPEAT_MAX_UNIT = 4096;
/** Fixed header overhead excluding unit: model_id(1) + unit_len(4) + n(4). */
export const REPEAT_HDR_OVERHEAD = 9;

export { wrapLbhxPoly, unwrapLbhx, KIND_POLY, LBHX_HDR };

/** Expand `repeat(unit)[:n]` — byte-wise wrap (Theory wire). */
export function expandRepeat(unit, n) {
  const u = Buffer.from(unit);
  const out = Buffer.allocUnsafe(n >>> 0);
  if (!u.length || n === 0) {
    out.fill(0);
    return out;
  }
  for (let i = 0; i < n; i++) out[i] = u[i % u.length];
  return out;
}

/**
 * Smallest period p such that data[i] == data[i % p] for all i.
 * None if no unit shorter than half the payload (within REPEAT_MAX_UNIT).
 */
export function fitByteRepeat(data) {
  const b = Buffer.from(data);
  const n = b.length;
  if (n < 2) return null;
  const maxP = Math.min(Math.floor(n / 2), REPEAT_MAX_UNIT);
  for (let p = 1; p <= maxP; p++) {
    let ok = true;
    for (let i = p; i < n; i++) {
      if (b[i] !== b[i % p]) {
        ok = false;
        break;
      }
    }
    if (ok) return b.subarray(0, p);
  }
  return null;
}

export function packRepeat(unit, n) {
  const u = Buffer.from(unit);
  const out = Buffer.allocUnsafe(REPEAT_HDR_OVERHEAD + u.length);
  out[0] = MODEL_REPEAT;
  out.writeUInt32LE(u.length >>> 0, 1);
  u.copy(out, 5);
  out.writeUInt32LE(n >>> 0, 5 + u.length);
  return out;
}

export function unpackRepeat(inner, rawLen) {
  const b = Buffer.from(inner);
  if (b.length < REPEAT_HDR_OVERHEAD) throw new Error("repeat hdr");
  if (b[0] !== MODEL_REPEAT) throw new Error("not_repeat_model");
  const unitLen = b.readUInt32LE(1);
  if (unitLen === 0 || unitLen > REPEAT_MAX_UNIT) throw new Error("repeat unit_len");
  const need = 5 + unitLen + 4;
  if (b.length !== need) throw new Error("repeat len");
  const unit = b.subarray(5, 5 + unitLen);
  const n = b.readUInt32LE(5 + unitLen);
  if (rawLen != null && n !== rawLen) throw new Error("repeat n");
  const out = expandRepeat(unit, n);
  if (out.length !== n) throw new Error("repeat out");
  return { raw: out, modelId: MODEL_REPEAT, model: "repeat", unit, unit_len: unitLen, n };
}

/** Inspect an LBHX aware blob for repeat program pricing (model_id 7). */
export function inspectRepeatProgram(blob) {
  const u = unwrapLbhx(blob);
  if (!u || u.kind !== KIND_POLY || !u.inner.length) return null;
  if (u.inner[0] !== MODEL_REPEAT) return null;
  if (u.inner.length < REPEAT_HDR_OVERHEAD) return null;
  const unitLen = u.inner.readUInt32LE(1);
  if (unitLen === 0 || unitLen > REPEAT_MAX_UNIT) return null;
  const need = 5 + unitLen + 4;
  if (u.inner.length !== need) return null;
  const n = u.inner.readUInt32LE(5 + unitLen);
  return {
    model: "repeat",
    model_id: MODEL_REPEAT,
    unit_len: unitLen,
    n,
    aware_bytes: u.inner.length,
    frame_bytes: Buffer.from(blob).length,
    raw_bytes: u.rawLen,
  };
}

/**
 * Price the repeat program from raw bytes (SKU metadata).
 * Does not seat the hosted crown — that is `lb aware` after Ship refreshes bin/lb.
 */
export function priceRepeatProgram(raw) {
  const b = Buffer.from(raw);
  const unit = fitByteRepeat(b);
  if (!unit) return null;
  const inner = packRepeat(unit, b.length);
  return {
    model: "repeat",
    model_id: MODEL_REPEAT,
    unit_len: unit.length,
    n: b.length,
    aware_bytes: inner.length,
    raw_bytes: b.length,
    seating: "bin/lb aware (lbr1 main)",
  };
}

/** JS decode of repeat LBHX (tests / inspect). Hosted restore prefers lb decode. */
export function decodeLbhxRepeat(buf) {
  const u = unwrapLbhx(buf);
  if (!u || u.kind !== KIND_POLY || !u.inner.length) return null;
  if (u.inner[0] !== MODEL_REPEAT) return null;
  const { raw, model, modelId, unit, unit_len, n } = unpackRepeat(u.inner, u.rawLen);
  if (raw.length !== u.rawLen) throw new Error("repeat out len");
  return { raw, model, modelId, unit, unit_len, n, awareBytes: u.inner.length };
}
