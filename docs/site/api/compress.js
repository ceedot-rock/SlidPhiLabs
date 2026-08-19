/**
 * POST /api/compress — lab codec.
 * Picks smallest lossless of ZRW / leftover / brotli-11 / gzip-9 that round-trips.
 * Zeros×10k still 8 B. Not a #1 general-compressor claim.
 */
import { withProductBox } from "./lib/spl-box-gate.js";
import {
  encode as splEncode,
  inputToRaw,
  publicResult,
  MAX_RAW,
  MAX_VECTOR,
} from "./lib/spl-codec.mjs";
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

async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method === "GET") {
    return json(res, 200, {
      ok: true,
      path: "spl-codec",
      how: "POST raw bytes or JSON { corpus:'zeros', n:10000 } or { text } or { data_b64 }. Picks ZRW / leftover / brotli-11 / gzip-9, smallest that round-trips.",
      pair: "POST /api/decompress · full loop POST /api/process",
      max_raw: MAX_RAW,
      max_vector: MAX_VECTOR,
      curl_10k_zeros:
        'python3 -c "open(\'z.bin\',\'wb\').write(bytes(40000))" && curl -sS -X POST https://www.slidphilabs.com/api/compress -H "content-type: application/octet-stream" --data-binary @z.bin',
      do_not: "claim this beats brotli as a general compressor",
      ...codexStamp({ half: "compress" }),
    });
  }
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "POST only" });
  }

  try {
    const body = await readBody(req);
    let raw;
    if (body.kind === "json" || (body.kind === "bin" && body.value[0] === 0x7b)) {
      let j = body.kind === "json" ? body.value : null;
      if (!j) {
        try {
          j = JSON.parse(body.value.toString("utf8"));
        } catch {
          j = null;
        }
      }
      if (j && typeof j === "object") raw = inputToRaw(j);
    }
    if (!raw) {
      if (!body.value || !body.value.length) {
        return json(res, 400, { ok: false, error: "empty_body" });
      }
      raw = Buffer.from(body.value);
    }
    const cap = raw.length % 4 === 0 && raw.length <= MAX_VECTOR ? MAX_VECTOR : MAX_RAW;
    if (raw.length > cap) {
      return json(res, 413, { ok: false, error: "too_large", max_raw: MAX_RAW, max_vector: MAX_VECTOR });
    }
    const enc = splEncode(raw);
    return json(res, 200, {
      ok: true,
      ...publicResult(enc),
      ...codexStamp({ half: "compress", unlocked_pair: "/api/decompress" }),
      at: new Date().toISOString(),
    });
  } catch (e) {
    return json(res, 400, { ok: false, error: String(e.message || e) });
  }
}

export default withProductBox(handler, "gate");
