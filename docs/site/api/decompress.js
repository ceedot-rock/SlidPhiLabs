/**
 * POST /api/decompress — inverse of /api/compress (ZRW only)
 * Body: { packed_b64 } or application/octet-stream packed bytes
 */
import { withProductBox } from "./lib/spl-box-gate.js";

import {
  ZeroRangeWave,
  packBits,
  unpackBits,
} from "./lib/vendor/zrw-pack.js";
import { codexStamp, codexHeaders } from "./lib/codex-key.js";
import { siosJob } from "./lib/sios-cell.mjs";

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

function zrwDecompress(packed) {
  return new ZeroRangeWave(0, 4).decodeBits(unpackBits(packed));
}

function intsToI32LE(ints) {
  const buf = Buffer.alloc(ints.length * 4);
  for (let i = 0; i < ints.length; i++) buf.writeInt32LE(ints[i] | 0, i * 4);
  return buf;
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
      how: 'POST { packed_b64 } or raw ZRW packed bytes',
      pair: "POST /api/compress",
      full_loop: "POST /api/process",
      ...codexStamp({ half: "decompress" }),
    });
  }
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "POST only" });
  }

  try {
    const body = await readBody(req);
    let packed;
    if (body.kind === "json" || (body.value[0] === 0x7b)) {
      let j = body.kind === "json" ? body.value : JSON.parse(body.value.toString("utf8"));
      if (j.packed_b64) packed = Buffer.from(j.packed_b64, "base64");
      else return json(res, 400, { ok: false, error: "packed_b64_required" });
    } else {
      packed = body.value;
    }
    if (!packed || !packed.length) {
      return json(res, 400, { ok: false, error: "empty" });
    }
    const ints = zrwDecompress(packed);
    const raw = intsToI32LE(ints);
    siosJob({ kind: "decode", bytes: raw.length, ok: true, path: "zrw" });
    return json(res, 200, {
      ok: true,
      path: "zrw",
      n_ints: ints.length,
      raw_bytes: raw.length,
      raw_b64: raw.toString("base64"),
      all_zeros: ints.every((v) => v === 0),
      ...codexStamp({ half: "decompress", unlocked_pair: "/api/compress" }),
      at: new Date().toISOString(),
    });
  } catch (e) {
    return json(res, 400, { ok: false, error: String(e.message || e) });
  }
}

export default withProductBox(handler, 'gate');
