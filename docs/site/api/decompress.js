/**
 * POST /api/decompress — inverse of /api/compress (SPLS / pulsar / zeros / legacy SPL1).
 */
import { decode as splDecode, MAGIC as SPL_MAGIC } from "./lib/spl-codec.mjs";
import { decodeFrame, MAGIC as SPLS } from "./lib/specialist.mjs";
import { looksPulsar } from "./lib/pulsar-host.mjs";
import { isPccz } from "./lib/pccz.mjs";
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

async function decodeAny(packed) {
  const p = Buffer.from(packed);
  if (isPccz(p)) {
    const e = new Error("pcc_archive");
    e.hint = "POST /api/unarchive";
    throw e;
  }
  if (p.length >= 4 && p.subarray(0, 4).equals(SPLS)) return { raw: await decodeFrame(p), path: "hosted" };
  if (looksPulsar(p) || (p.length >= 8 && p[0] === 0x00)) {
    return { raw: await decodeFrame(p), path: "hosted" };
  }
  if (p.length >= 4 && p.subarray(0, 4).equals(SPL_MAGIC)) {
    return { raw: splDecode(p), path: "legacy-spl1" };
  }
  try {
    return { raw: await decodeFrame(p), path: "hosted" };
  } catch {
    return { raw: splDecode(p), path: "legacy" };
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
      how: "POST { packed_b64 } or raw packed bytes from /api/compress",
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
      const j = body.kind === "json" ? body.value : JSON.parse(body.value.toString("utf8"));
      if (j.packed_b64) packed = Buffer.from(j.packed_b64, "base64");
      else return json(res, 400, { ok: false, error: "packed_b64_required" });
    } else {
      packed = body.value;
    }
    if (!packed || !packed.length) {
      return json(res, 400, { ok: false, error: "empty" });
    }
    const { raw, path } = await decodeAny(packed);
    return json(res, 200, {
      ok: true,
      path,
      raw_bytes: raw.length,
      raw_b64: raw.toString("base64"),
      host_fallback: false,
      ...codexStamp({ half: "decompress", unlocked_pair: "/api/compress" }),
      at: new Date().toISOString(),
    });
  } catch (e) {
    const error = String(e.message || e);
    if (error === "pcc_archive") {
      return json(res, 400, { ok: false, error, hint: "POST /api/unarchive", ext: ".pcc" });
    }
    return json(res, 400, { ok: false, error });
  }
}
