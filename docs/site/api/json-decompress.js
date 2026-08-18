/**
 * POST /api/json-decompress — inverse of /api/json-compress (JK01)
 */
import { withProductBox } from "./lib/spl-box-gate.js";

import { decompressJsonKeys, JSON_KEYS } from "../lab/json_residual/json_keys.mjs";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
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
      how: "POST { packed_b64 } or raw JK01 bytes",
      pair: "POST /api/json-compress",
      keys: JSON_KEYS,
    });
  }
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "POST only" });
  }
  try {
    const body = await readBody(req);
    let packed;
    if (body.kind === "json" || (body.value[0] === 0x7b)) {
      const j =
        body.kind === "json"
          ? body.value
          : JSON.parse(body.value.toString("utf8"));
      if (!j.packed_b64) return json(res, 400, { ok: false, error: "packed_b64_required" });
      packed = Buffer.from(j.packed_b64, "base64");
    } else {
      packed = body.value;
    }
    const out = decompressJsonKeys(packed);
    return json(res, 200, {
      ok: true,
      value: out.value,
      json: out.json,
      raw_bytes: out.bytes.length,
      header: out.header,
      keys: JSON_KEYS,
      at: new Date().toISOString(),
    });
  } catch (e) {
    return json(res, 400, { ok: false, error: String(e.message || e) });
  }
}

export default withProductBox(handler, 'tru8');
