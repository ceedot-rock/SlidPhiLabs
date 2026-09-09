/**
 * POST /api/archive — pack many files into a .pcc (our zip).
 * Body JSON: { files: [{ path, data_b64 }] }
 * GET describes the format.
 */
import { encodeHosted, decodeFrame, MAX_RAW } from "./lib/specialist.mjs";
import { packArchive, parseArchive, isPccz, crc32 } from "./lib/pccz.mjs";
import { lbDecode } from "./lib/engines.mjs";
import { meterSnapshot } from "./lib/usage-meter.mjs";
import { codexStamp, codexHeaders } from "./lib/codex-key.js";

const MAX_MEMBERS = 64;
const MAX_TOTAL = 16 * 1024 * 1024;

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

const CARD = {
  ok: true,
  path: "pcc-archive",
  ext: ".pcc",
  plain: "A .pcc file is our archive: many files, one container, our compression inside. Like zip. POST files, get a .pcc back. Restore with POST /api/unarchive.",
  pair: "POST /api/unarchive",
  max_members: MAX_MEMBERS,
  max_bytes_each: MAX_RAW,
};

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method === "GET") {
    return json(res, 200, { ...CARD, usage: meterSnapshot(req), ...codexStamp({ half: "archive" }) });
  }
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "POST only" });

  try {
    const j = req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body) ? req.body : null;
    const files = j && Array.isArray(j.files) ? j.files : null;
    if (!files || !files.length) return json(res, 400, { ok: false, error: "files required" });
    if (files.length > MAX_MEMBERS) return json(res, 400, { ok: false, error: "too_many_files" });
    const entries = [];
    let total = 0;
    for (const f of files) {
      const name = f.path || f.name;
      const dir = Boolean(f.dir);
      const raw = dir ? Buffer.alloc(0) : Buffer.from(f.data_b64 || f.data || "", f.data_b64 ? "base64" : "utf8");
      if (raw.length > MAX_RAW) return json(res, 400, { ok: false, error: "too_large", path: name });
      total += raw.length;
      if (total > MAX_TOTAL) return json(res, 400, { ok: false, error: "too_large_total" });
      let packed = raw;
      let stored = true;
      if (!dir && raw.length) {
        const enc = await encodeHosted(raw);
        packed = Buffer.from(enc.packed_b64, "base64");
        stored = false;
      }
      entries.push({
        name,
        packed,
        rawLen: raw.length,
        crc32: crc32(raw),
        stored,
        dir,
        mtime: f.mtime || 0,
        mode: f.mode,
      });
    }
    const archive = packArchive(entries);
    if (!isPccz(archive)) throw new Error("pack_fail");
    return json(res, 200, {
      ok: true,
      plain: `Packed ${entries.length} files into a .pcc archive (${archive.length} bytes). Restore with POST /api/unarchive.`,
      ext: ".pcc",
      filename: (j && j.filename) || "archive.pcc",
      members: entries.length,
      packed_bytes: archive.length,
      packed_b64: archive.toString("base64"),
      ...codexStamp({ half: "archive" }),
    });
  } catch (e) {
    return json(res, 400, { ok: false, error: String(e.message || e) });
  }
}

export async function unpackMembers(packed) {
  const { entries } = parseArchive(packed);
  const files = [];
  for (const e of entries) {
    if (e.dir) {
      files.push({ path: e.name, dir: true, data_b64: "", raw_bytes: 0 });
      continue;
    }
    let raw;
    if (e.stored) raw = Buffer.from(e.packed);
    else {
      try {
        raw = await decodeFrame(e.packed);
      } catch {
        raw = await lbDecode(e.packed);
      }
    }
    if (crc32(raw) !== e.crc32) throw new Error("pcc crc " + e.name);
    files.push({
      path: e.name,
      dir: false,
      data_b64: raw.toString("base64"),
      raw_bytes: raw.length,
    });
  }
  return files;
}
