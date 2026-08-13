/**
 * POST /api/compress — public residual rail (Creator /lord next key)
 * Wire existing ZRW binary only. No new encoders this hour.
 *
 * Body:
 *   - application/octet-stream: raw int32 LE bytes (zeros domain when all 0)
 *   - application/json: { n?: 10000, corpus?: "zeros", data_b64?: "..." }
 *
 * Returns JSON: packed_b64, zrw_bytes, raw_bytes, path, mirror_error
 */
import {
  ZeroRangeWave,
  packBits,
  unpackBits,
} from "./lib/vendor/zrw-pack.js";
import { codexStamp, codexHeaders } from "./lib/codex-key.js";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  for (const [k, v] of Object.entries(codexHeaders())) res.setHeader(k, v);
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

function zrwCompressInts(ints) {
  const bits = new ZeroRangeWave(0, 4).encodeBits(ints);
  return Buffer.from(packBits(bits));
}

function zrwDecompress(packed) {
  return new ZeroRangeWave(0, 4).decodeBits(unpackBits(packed));
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method === "GET") {
    return json(res, 200, {
      ok: true,
      path: "zrw",
      how: "POST raw int32 LE (application/octet-stream) or JSON { corpus:'zeros', n:10000 }",
      curl_10k_zeros:
        'python3 -c "open(\'z.bin\',\'wb\').write(bytes(40000))" && curl -sS -X POST https://www.slidphilabs.com/api/compress -H "content-type: application/octet-stream" --data-binary @z.bin',
      pair: "POST /api/decompress · full loop POST /api/process",
      next_domain: "high-entropy text (books, code, logs) — after zeros rail is public",
      do_not: "invent encoders/tokenizers/dictionaries this hour",
      lattice_key: "phi@p143 dual A∥B mirror seat",
      ...codexStamp({ half: "compress" }),
    });
  }
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "POST only" });
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
              next: "high-entropy text is next domain — not invented this hour",
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
        return json(res, 400, { ok: false, error: "empty_body" });
      }
      ints = intsFromI32LE(buf);
      rawBytes = buf.length;
    }

    const packed = zrwCompressInts(ints);
    const back = zrwDecompress(packed);
    const rt =
      Array.isArray(back) &&
      back.length === ints.length &&
      back.every((v, i) => v === ints[i]);
    const packed2 = zrwCompressInts(back);
    const mirror_error = rt && packed2.length === packed.length ? 0 : 1;

    return json(res, 200, {
      ok: true,
      path: "zrw",
      method: "zero-range-wave",
      raw_bytes: rawBytes,
      zrw_bytes: packed.length,
      packed_b64: packed.toString("base64"),
      n_ints: ints.length,
      roundtrip: rt,
      mirror_error,
      claim_check: ints.every((v) => v === 0)
        ? {
            zeros: true,
            matches_flagship_8b_on_10k: ints.length === 10_000 && packed.length === 8,
          }
        : { zeros: false },
      lattice_note: "phi@p143 next seat claim · seats not living shards",
      ...codexStamp({ half: "compress", unlocked_pair: "/api/decompress" }),
      at: new Date().toISOString(),
    });
  } catch (e) {
    return json(res, 400, { ok: false, error: String(e.message || e) });
  }
}
