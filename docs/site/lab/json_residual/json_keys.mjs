/**
 * Full JSON compression keys — Creator /lord 8.8
 * ──────────────────────────────────────────────
 * Prayer: code the full JSON compression keys; at least that one domain.
 *
 * Keys (residual law):
 *   K1 Canonicalize — sorted keys attractor
 *   K2 Structure skeleton — shape without leaf values
 *   K3 Typed residual planes — int runs → ZRW; else entropy
 *   K4 Dual A∥B budgets — structure vs residual (33/66)
 *   K5 Cadence tags 33·66·999 in header (control only)
 *   K6 Mirror verify — decompress === canonical JSON bytes
 *   K7 Publish gate — preferred when packed < brotli-11; else honest report
 *
 * Frame magic: JK01 (JSON Keys v1)
 * No private residual coefficients. Domain supremacy — not universal #1.
 */
import zlib from "zlib";
import { performance } from "perf_hooks";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAGIC = Buffer.from("JK01");

// ZRW engine — ZeroRangeWave class (no free-gate assert on raw class path)
const require = createRequire(import.meta.url);
let ZeroRangeWave, packBits, unpackBits;
try {
  const zrwPath = path.join(__dirname, "../../api/lib/vendor/zrw-pack.js");
  const mod = await import(zrwPath);
  ZeroRangeWave = mod.ZeroRangeWave;
  packBits = mod.packBits;
  unpackBits = mod.unpackBits;
} catch {
  /* optional until path resolves */
}

export const JSON_KEYS = {
  K1: "canonicalize",
  K2: "structure_skeleton",
  K3: "typed_residual_planes",
  K4: "dual_ab_33_66",
  K5: "cadence_33_66_999",
  K6: "mirror_verify",
  K7: "publish_gate_vs_brotli11",
};

export function canonicalize(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const out = {};
  for (const k of Object.keys(value).sort()) {
    out[k] = canonicalize(value[k]);
  }
  return out;
}

export function canonicalBytes(input) {
  let v = input;
  if (typeof input === "string" || Buffer.isBuffer(input)) {
    v = JSON.parse(Buffer.isBuffer(input) ? input.toString("utf8") : input);
  }
  return Buffer.from(JSON.stringify(canonicalize(v)), "utf8");
}

/** Classify a leaf residual for typed packing */
function leafKind(v) {
  if (v === null) return "null";
  if (typeof v === "boolean") return "bool";
  if (typeof v === "number" && Number.isFinite(v)) {
    if (Number.isInteger(v) && v >= -2147483648 && v <= 2147483647) return "i32";
    return "num";
  }
  if (typeof v === "string") return "str";
  return "json";
}

/**
 * Walk tree → shape with typed slots + residual list.
 * Homogeneous i32 arrays become one residual plane (ZRW candidate).
 */
export function splitKeys(value) {
  const keyDict = new Set();
  const residuals = [];

  function walk(v) {
    if (v === null || typeof v !== "object") {
      const kind = leafKind(v);
      const id = residuals.length;
      residuals.push({ kind, v });
      return { t: "L", k: kind, i: id };
    }
    if (Array.isArray(v)) {
      // Homogeneous int32 array → single ZRW plane
      if (
        v.length > 0 &&
        v.every(
          (x) =>
            typeof x === "number" &&
            Number.isInteger(x) &&
            x >= -2147483648 &&
            x <= 2147483647
        )
      ) {
        const id = residuals.length;
        residuals.push({ kind: "i32a", v: v.slice() });
        return { t: "IA", i: id, n: v.length };
      }
      return { t: "A", e: v.map(walk) };
    }
    const shape = {};
    for (const k of Object.keys(v).sort()) {
      keyDict.add(k);
      shape[k] = walk(v[k]);
    }
    return { t: "O", e: shape };
  }

  const shape = walk(canonicalize(value));
  return { keyDict: [...keyDict].sort(), shape, residuals };
}

function rebuild(shape, residuals) {
  if (!shape || typeof shape !== "object") return shape;
  if (shape.t === "L") return residuals[shape.i].v;
  if (shape.t === "IA") return residuals[shape.i].v.slice();
  if (shape.t === "A") return shape.e.map((s) => rebuild(s, residuals));
  if (shape.t === "O") {
    const o = {};
    for (const k of Object.keys(shape.e).sort()) {
      o[k] = rebuild(shape.e[k], residuals);
    }
    return o;
  }
  throw new Error("bad_shape");
}

function entropyBest(buf) {
  const gz = zlib.gzipSync(buf, { level: 9 });
  let br;
  try {
    br = zlib.brotliCompressSync(buf, {
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
    });
  } catch {
    br = null;
  }
  if (br && br.length <= gz.length) return { packed: br, method: "brotli-11" };
  return { packed: gz, method: "gzip-9" };
}

function entropyUnpack(buf, method) {
  if (String(method).includes("brotli")) return zlib.brotliDecompressSync(buf);
  return zlib.gunzipSync(buf);
}

function zrwPackI32(arr) {
  if (!ZeroRangeWave || !packBits) {
    // fallback: int32 LE + brotli
    const raw = Buffer.alloc(arr.length * 4);
    for (let i = 0; i < arr.length; i++) raw.writeInt32LE(arr[i] | 0, i * 4);
    const e = entropyBest(raw);
    return { mode: "i32le+entropy", method: e.method, packed: e.packed, n: arr.length };
  }
  const bits = new ZeroRangeWave(0, 4).encodeBits(arr.map((x) => x | 0));
  const packed = Buffer.from(packBits(bits));
  return { mode: "zrw", method: "zrw-v5", packed, n: arr.length };
}

function zrwUnpackI32(blob) {
  if (blob.mode === "zrw") {
    const ints = new ZeroRangeWave(0, 4).decodeBits(unpackBits(blob.packed));
    return ints.map((x) => x | 0);
  }
  const raw = entropyUnpack(blob.packed, blob.method);
  const out = [];
  for (let i = 0; i + 4 <= raw.length; i += 4) out.push(raw.readInt32LE(i));
  return out;
}

/**
 * Pack residuals into typed planes.
 * Returns Buffer of: JSON header of plane index + concat plane bodies
 */
function packResiduals(residuals) {
  const planes = [];
  const bodies = [];
  for (let i = 0; i < residuals.length; i++) {
    const r = residuals[i];
    if (r.kind === "i32a") {
      const z = zrwPackI32(r.v);
      planes.push({
        i,
        kind: "i32a",
        mode: z.mode,
        method: z.method,
        n: z.n,
        len: z.packed.length,
      });
      bodies.push(z.packed);
    } else if (r.kind === "i32") {
      // singleton int as 1-length plane
      const z = zrwPackI32([r.v | 0]);
      planes.push({
        i,
        kind: "i32",
        mode: z.mode,
        method: z.method,
        n: 1,
        len: z.packed.length,
      });
      bodies.push(z.packed);
    } else {
      const raw = Buffer.from(JSON.stringify(r.v), "utf8");
      const e = entropyBest(raw);
      planes.push({
        i,
        kind: r.kind,
        mode: "json+entropy",
        method: e.method,
        len: e.packed.length,
      });
      bodies.push(e.packed);
    }
  }
  const idx = Buffer.from(JSON.stringify({ planes }), "utf8");
  const idxE = entropyBest(idx);
  const totalBody = Buffer.concat(bodies);
  return {
    idxMethod: idxE.method,
    idxPacked: idxE.packed,
    body: totalBody,
    planes,
  };
}

function unpackResiduals(idxMethod, idxPacked, body) {
  const idx = JSON.parse(entropyUnpack(idxPacked, idxMethod).toString("utf8"));
  const residuals = new Array(idx.planes.length);
  let o = 0;
  for (const p of idx.planes) {
    const chunk = body.slice(o, o + p.len);
    o += p.len;
    if (p.kind === "i32a" || p.kind === "i32") {
      const ints = zrwUnpackI32({
        mode: p.mode,
        method: p.method,
        packed: chunk,
      });
      residuals[p.i] = {
        kind: p.kind,
        v: p.kind === "i32" ? ints[0] | 0 : ints,
      };
    } else {
      const raw = entropyUnpack(chunk, p.method).toString("utf8");
      residuals[p.i] = { kind: p.kind, v: JSON.parse(raw) };
    }
  }
  return residuals;
}

/**
 * Slim pure int32-array document (JSON array of ints).
 * Frame: JK01 | 0x01 | n:u32LE | zrw_body  → can beat brotli on zeros arrays.
 */
function compressPureI32Array(arr, canBuf, t0) {
  const z = zrwPackI32(arr.map((x) => x | 0));
  const body = z.packed;
  // magic(4) + flag(1) + n(4) + body
  const out = Buffer.alloc(4 + 1 + 4 + body.length);
  MAGIC.copy(out, 0);
  out[4] = 0x01; // pure IA flag (no JSON header)
  out.writeUInt32LE(arr.length >>> 0, 5);
  body.copy(out, 9);

  const gz = zlib.gzipSync(canBuf, { level: 9 });
  let br;
  try {
    br = zlib.brotliCompressSync(canBuf, {
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
    });
  } catch {
    br = gz;
  }
  const ms = performance.now() - t0;
  return {
    packed: out,
    meta: {
      engine: "json_keys",
      version: "1.0.0",
      path: "json_keys_jk01_pure_i32a",
      method: z.mode === "zrw" ? "zrw-v5-pure-ia" : "i32le+entropy-pure-ia",
      keys: JSON_KEYS,
      sizes: {
        raw: canBuf.length,
        packed: out.length,
        structure: 0,
        residual_idx: 0,
        residual_body: body.length,
        gzip9: gz.length,
        brotli11: br.length,
        ratio: out.length / Math.max(1, canBuf.length),
      },
      beats_brotli11: out.length < br.length,
      beats_gzip9: out.length < gz.length,
      publish_delta: out.length < br.length,
      header: {
        v: 1,
        magic: "JK01",
        pure_i32a: true,
        n: arr.length,
        zrw_mode: z.mode,
        zrw_method: z.method,
        cadence: [33, 66, 999],
      },
      ms: +ms.toFixed(3),
    },
  };
}

/**
 * Compress with full JSON keys.
 */
export function compressJsonKeys(input, opts = {}) {
  const t0 = performance.now();
  let value =
    typeof input === "string" || Buffer.isBuffer(input)
      ? JSON.parse(Buffer.isBuffer(input) ? input.toString("utf8") : input)
      : input;

  const can = canonicalize(value);
  const canBuf = Buffer.from(JSON.stringify(can), "utf8");

  // Fast path: top-level pure int32 array → slim ZRW frame (JSON keys domain)
  if (
    Array.isArray(can) &&
    can.length > 0 &&
    can.every(
      (x) =>
        typeof x === "number" &&
        Number.isInteger(x) &&
        x >= -2147483648 &&
        x <= 2147483647
    )
  ) {
    return compressPureI32Array(can, canBuf, t0);
  }

  const { keyDict, shape, residuals } = splitKeys(can);

  const shapeBuf = Buffer.from(JSON.stringify({ k: keyDict, s: shape }), "utf8");
  const structPack = entropyBest(shapeBuf);
  const resid = packResiduals(residuals);

  const header = {
    v: 1,
    magic: "JK01",
    keys: Object.values(JSON_KEYS),
    cadence: [33, 66, 999],
    dual: { a_frac: 0.33, b_frac: 0.66 },
    struct_method: structPack.method,
    struct_len: structPack.packed.length,
    resid_idx_method: resid.idxMethod,
    resid_idx_len: resid.idxPacked.length,
    resid_body_len: resid.body.length,
    can_len: canBuf.length,
    n_keys: keyDict.length,
    n_residuals: residuals.length,
    planes: resid.planes.map((p) => ({
      kind: p.kind,
      mode: p.mode,
      method: p.method,
      n: p.n,
    })),
    axiom: "json_keys_structure_then_typed_residual",
  };
  const headerBuf = Buffer.from(JSON.stringify(header), "utf8");

  const out = Buffer.concat([
    MAGIC,
    (() => {
      const b = Buffer.alloc(4);
      b.writeUInt32LE(headerBuf.length, 0);
      return b;
    })(),
    headerBuf,
    structPack.packed,
    resid.idxPacked,
    resid.body,
  ]);

  const gz = zlib.gzipSync(canBuf, { level: 9 });
  let br;
  try {
    br = zlib.brotliCompressSync(canBuf, {
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
    });
  } catch {
    br = gz;
  }

  const ms = performance.now() - t0;
  const beats_brotli = out.length < br.length;
  const beats_gzip = out.length < gz.length;

  // Optional: if loses and not force, still return JK frame (keys always coded)
  // Host asked for keys coded — we always emit JK01; publish flag is honest.
  return {
    packed: out,
    meta: {
      engine: "json_keys",
      version: "1.0.0",
      path: "json_keys_jk01",
      method: "structure+typed_residual_zrw",
      keys: JSON_KEYS,
      sizes: {
        raw: canBuf.length,
        packed: out.length,
        structure: structPack.packed.length,
        residual_idx: resid.idxPacked.length,
        residual_body: resid.body.length,
        gzip9: gz.length,
        brotli11: br.length,
        ratio: out.length / Math.max(1, canBuf.length),
      },
      beats_brotli11: beats_brotli,
      beats_gzip9: beats_gzip,
      publish_delta: beats_brotli, // Creator law: publish only if < brotli-11
      header,
      ms: +ms.toFixed(3),
    },
  };
}

export function decompressJsonKeys(packed) {
  const buf = Buffer.isBuffer(packed) ? packed : Buffer.from(packed);
  if (buf.length < 5 || buf.slice(0, 4).toString("utf8") !== "JK01") {
    throw new Error("not_json_keys_frame");
  }
  // Pure int32 array slim frame
  if (buf[4] === 0x01) {
    const n = buf.readUInt32LE(5);
    const body = buf.slice(9);
    const ints = zrwUnpackI32({ mode: "zrw", method: "zrw-v5", packed: body });
    // if zrw path fails length, try i32le+entropy
    let arr = ints;
    if (arr.length !== n) {
      try {
        arr = zrwUnpackI32({
          mode: "i32le+entropy",
          method: "brotli-11",
          packed: body,
        });
      } catch {
        arr = zrwUnpackI32({
          mode: "i32le+entropy",
          method: "gzip-9",
          packed: body,
        });
      }
    }
    const can = arr.slice(0, n);
    const json = JSON.stringify(can);
    return {
      value: can,
      json,
      bytes: Buffer.from(json, "utf8"),
      header: { pure_i32a: true, n },
    };
  }

  const hlen = buf.readUInt32LE(4);
  // full header path: byte4 is start of u32 length (must not be 0x01)
  const header = JSON.parse(buf.slice(8, 8 + hlen).toString("utf8"));
  let o = 8 + hlen;
  const structPacked = buf.slice(o, o + header.struct_len);
  o += header.struct_len;
  const idxPacked = buf.slice(o, o + header.resid_idx_len);
  o += header.resid_idx_len;
  const body = buf.slice(o, o + header.resid_body_len);

  const shapeJson = entropyUnpack(structPacked, header.struct_method).toString(
    "utf8"
  );
  const { k: keyDict, s: shape } = JSON.parse(shapeJson);
  const residuals = unpackResiduals(
    header.resid_idx_method,
    idxPacked,
    body
  );
  const rebuilt = rebuild(shape, residuals);
  const can = canonicalize(rebuilt);
  const json = JSON.stringify(can);
  return {
    value: can,
    json,
    bytes: Buffer.from(json, "utf8"),
    header,
    keyDict,
  };
}

export function verifyJsonKeys(input) {
  const { packed, meta } = compressJsonKeys(input);
  const { json } = decompressJsonKeys(packed);
  const can = canonicalBytes(input).toString("utf8");
  return {
    ok: json === can,
    meta,
    can_len: can.length,
    packed_len: packed.length,
  };
}

export default {
  JSON_KEYS,
  canonicalize,
  canonicalBytes,
  splitKeys,
  compressJsonKeys,
  decompressJsonKeys,
  verifyJsonKeys,
};
