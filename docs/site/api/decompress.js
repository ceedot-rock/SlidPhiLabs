/**
 * POST /api/decompress — inverse of /api/compress.
 * Accepts SPL1 frames or legacy bare ZRW.
 */
import { withProductBox } from "./lib/spl-box-gate.js";
import { decode as splDecode, MAGIC as SPL_MAGIC } from "./lib/spl-codec.mjs";
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
      how: "POST { packed_b64 } or raw packed bytes (SPL1 or legacy ZRW)",
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
    if (body.kind === "json" || (body.value && body.value[0] === 0x7b)) {
      let j = body.kind === "json" ? body.value : JSON.parse(body.value.toString("utf8"));
      if (j.packed_b64) packed = Buffer.from(j.packed_b64, "base64");
      else return json(res, 400, { ok: false, error: "packed_b64_required" });
    } else {
      packed = body.value;
    }
    if (!packed || !packed.length) {
      return json(res, 400, { ok: false, error: "empty" });
    }
    const raw = splDecode(packed);
    const framed = packed.length >= 4 && packed.subarray(0, 4).equals(SPL_MAGIC);
    return json(res, 200, {
      ok: true,
      path: framed ? "spl-codec" : "zrw",
      raw_bytes: raw.length,
      raw_b64: raw.toString("base64"),
      ...codexStamp({ half: "decompress", unlocked_pair: "/api/compress" }),
      at: new Date().toISOString(),
    });
  } catch (e) {
    return json(res, 400, { ok: false, error: String(e.message || e) });
  }
}

export default withProductBox(handler, "gate");
