/**
 * POST /api/unarchive — restore files from a .pcc archive.
 * Body JSON: { packed_b64 } or raw PCCZ bytes.
 */
import { isPccz } from "./lib/pccz.mjs";
import { unpackMembers } from "./archive.js";
import { meterSnapshot } from "./lib/usage-meter.mjs";
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

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method === "GET") {
    return json(res, 200, {
      ok: true,
      path: "pcc-unarchive",
      plain: "POST a .pcc archive. Get the files back, byte for byte.",
      pair: "POST /api/archive",
      usage: meterSnapshot(req),
      ...codexStamp({ half: "unarchive" }),
    });
  }
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "POST only" });
  try {
    let packed;
    if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body) && req.body.packed_b64) {
      packed = Buffer.from(req.body.packed_b64, "base64");
    } else if (Buffer.isBuffer(req.body)) {
      packed = req.body;
    } else {
      return json(res, 400, { ok: false, error: "packed_b64 required" });
    }
    if (!isPccz(packed)) return json(res, 400, { ok: false, error: "not_pcc_archive" });
    const files = await unpackMembers(packed);
    return json(res, 200, {
      ok: true,
      plain: `Restored ${files.length} files from a .pcc archive.`,
      ext: ".pcc",
      members: files.length,
      files,
      ...codexStamp({ half: "unarchive" }),
    });
  } catch (e) {
    return json(res, 400, { ok: false, error: String(e.message || e) });
  }
}
