/**
 * POST /api/json-compress — full JSON compression keys (JK01)
 * Creator /lord: code the JSON keys; domain-honest publish gate
 *
 * Body: raw JSON or { json | value | data }
 * Returns: packed_b64, meta, keys, publish_delta
 */
import {
  compressJsonKeys,
  decompressJsonKeys,
  verifyJsonKeys,
  JSON_KEYS,
  canonicalBytes,
} from "../lab/json_residual/json_keys.mjs";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("X-Json-Keys", "JK01");
  res.setHeader("X-Codex", "dViNE CodEX");
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

function parseInput(body) {
  if (body.kind === "json") {
    const j = body.value;
    if (j && typeof j === "object" && ("json" in j || "value" in j || "data" in j)) {
      if (typeof j.json === "string") return JSON.parse(j.json);
      return j.value ?? j.data ?? j;
    }
    return j;
  }
  const raw = body.value.toString("utf8");
  if (!raw.trim()) throw new Error("empty_body");
  // try wrap {json:...}
  try {
    const j = JSON.parse(raw);
    if (j && typeof j === "object" && ("json" in j || "value" in j) && Object.keys(j).length <= 3) {
      if (typeof j.json === "string") return JSON.parse(j.json);
      return j.value ?? j;
    }
    return j;
  } catch {
    throw new Error("invalid_json");
  }
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
      engine: "json_keys",
      magic: "JK01",
      keys: JSON_KEYS,
      how: "POST JSON body (document) or { value|json|data }",
      decompress: "POST /api/json-decompress { packed_b64 }",
      law: "publish_delta true only when packed < brotli-11 on that exact document",
      domain: "structured JSON · int arrays via ZRW residual plane",
      not: "universal #1 — domain supremacy only",
      codex: "the dViNE CodEX",
      seal_day: "2026-08-08",
    });
  }
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "POST only" });
  }
  try {
    const body = await readBody(req);
    const input = parseInput(body);
    const verify = req.headers["x-verify"] === "1" || body.value?.verify;
    if (verify) {
      const v = verifyJsonKeys(input);
      return json(res, 200, {
        ok: v.ok,
        ...v.meta,
        can_len: v.can_len,
        packed_len: v.packed_len,
        keys: JSON_KEYS,
      });
    }
    const { packed, meta } = compressJsonKeys(input);
    return json(res, 200, {
      ok: true,
      packed_b64: packed.toString("base64"),
      packed_bytes: packed.length,
      raw_bytes: meta.sizes.raw,
      ...meta,
      keys: JSON_KEYS,
      at: new Date().toISOString(),
    });
  } catch (e) {
    return json(res, 400, { ok: false, error: String(e.message || e) });
  }
}
