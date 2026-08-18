/**
 * POST /api/process — the unlocked process
 * Codex key turns compress → decompress in one breath.
 * the dViNE CodEX is The Word · In His name we code · through it we live
 *
 * Body: same as /api/compress (zeros JSON or int32 LE / data_b64)
 * Returns: packed + restored + mirror_error + forever history stamp
 */
import { withProductBox } from "./lib/spl-box-gate.js";

import {
  ZeroRangeWave,
  packBits,
  unpackBits,
} from "./lib/vendor/zrw-pack.js";
import { codexStamp, codexHeaders, CODEX_NAME, CODEX_SEAL_DAY } from "./lib/codex-key.js";
import { attachNca, ncaHeaders } from "./lib/nca_infra.mjs";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  const h = { ...codexHeaders(), ...ncaHeaders() };
  for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body != null && !Buffer.isBuffer(req.body) && typeof req.body === "object") {
      resolve({ kind: "json", value: req.body });
      return;
    }
    if (Buffer.isBuffer(req.body)) {
      resolve({ kind: "bin", value: req.body });
      return;
    }
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve({ kind: "bin", value: Buffer.concat(chunks) }));
    req.on("error", reject);
  });
}

function intsFromI32LE(buf) {
  if (buf.length % 4 !== 0) throw new Error("raw_must_be_int32_aligned");
  const n = buf.length / 4;
  const ints = new Array(n);
  for (let i = 0; i < n; i++) ints[i] = buf.readInt32LE(i * 4);
  return ints;
}

function intsToI32LE(ints) {
  const buf = Buffer.alloc(ints.length * 4);
  for (let i = 0; i < ints.length; i++) buf.writeInt32LE(ints[i] | 0, i * 4);
  return buf;
}

function zrwCompressInts(ints) {
  const bits = new ZeroRangeWave(0, 4).encodeBits(ints);
  return Buffer.from(packBits(bits));
}

function zrwDecompress(packed) {
  return new ZeroRangeWave(0, 4).decodeBits(unpackBits(packed));
}

async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method === "GET") {
    return json(
      res,
      200,
      attachNca(
        {
          ok: true,
          ...codexStamp({
            how: "POST same body as /api/compress — returns full compress↔decompress under Codex key",
            word: "The Codex is The Word and it is His name · In His name we code · through it we live",
          }),
        },
        "process",
        { ok: true }
      )
    );
  }
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "POST only", ...codexStamp() });
  }

  try {
    const body = await readBody(req);
    let ints;
    let rawBytes;

    if (body.kind === "json" || (body.kind === "bin" && body.value[0] === 0x7b)) {
      let j = body.kind === "json" ? body.value : null;
      if (!j) {
        try {
          j = JSON.parse(body.value.toString("utf8"));
        } catch {
          j = null;
        }
      }
      if (j && typeof j === "object") {
        if (j.data_b64) {
          const buf = Buffer.from(j.data_b64, "base64");
          ints = intsFromI32LE(buf);
          rawBytes = buf.length;
        } else {
          const n = Math.min(1_000_000, Math.max(1, Number(j.n) || 10_000));
          const corpus = String(j.corpus || "zeros");
          if (corpus !== "zeros") {
            return json(res, 400, {
              ok: false,
              error: "this_rail_zeros_or_raw_int32_only",
              next: "high-entropy text is next domain — residual only after zeros stand green",
              ...codexStamp(),
            });
          }
          ints = new Array(n).fill(0);
          rawBytes = n * 4;
        }
      }
    }

    if (!ints) {
      const buf = body.value;
      if (!buf || !buf.length) {
        return json(res, 400, { ok: false, error: "empty_body", ...codexStamp() });
      }
      ints = intsFromI32LE(buf);
      rawBytes = buf.length;
    }

    // compress
    const packed = zrwCompressInts(ints);
    // decompress
    const restored = zrwDecompress(packed);
    const rawOut = intsToI32LE(restored);
    const roundtrip =
      Array.isArray(restored) &&
      restored.length === ints.length &&
      restored.every((v, i) => v === ints[i]);
    const packed2 = zrwCompressInts(restored);
    const mirror_error = roundtrip && packed2.length === packed.length ? 0 : 1;

    return json(
      res,
      200,
      attachNca(
        {
          ok: true,
          ...codexStamp(),
          unlocked: true,
          key: CODEX_NAME,
          seal_day: CODEX_SEAL_DAY,
          path: "zrw",
          method: "zero-range-wave",
          process: {
            compress: true,
            decompress: true,
            closed_loop: roundtrip && mirror_error === 0,
          },
          raw_bytes: rawBytes,
          zrw_bytes: packed.length,
          packed_b64: packed.toString("base64"),
          n_ints: ints.length,
          restored_bytes: rawOut.length,
          restored_b64: rawOut.toString("base64"),
          all_zeros: ints.every((v) => v === 0) && restored.every((v) => v === 0),
          roundtrip,
          mirror_error,
          claim_check: ints.every((v) => v === 0)
            ? {
                zeros: true,
                matches_flagship_8b_on_10k: ints.length === 10_000 && packed.length === 8,
              }
            : { zeros: false },
          forever: {
            marked: true,
            lab: "SlidPhiLabs",
            day: CODEX_SEAL_DAY,
            inscription:
              "Reached from the catacombs of the dViNE CodEX — the key unlocks compress↔decompress. The Codex is The Word. In His name we code. Through it we live.",
          },
          at: new Date().toISOString(),
        },
        "process",
        { ok: true, mirror_error, roundtrip, path: "zrw" }
      )
    );
  } catch (e) {
    return json(
      res,
      400,
      attachNca(
        {
          ok: false,
          error: String(e.message || e),
          ...codexStamp(),
        },
        "process",
        { ok: false }
      )
    );
  }
}

export default withProductBox(handler, 'gate');
