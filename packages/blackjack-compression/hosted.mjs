/**
 * Dual-licensed hosted compression client.
 * Calls POST /api/compress and POST /api/decompress on the lab host.
 * Every pathway on that machine runs; the smallest restore-safe result wins.
 * zip()/unzip() build a .pcc archive (our zip).
 */
import { crc32, isPccz, packArchive, parseArchive } from "./pccz.mjs";

export const ORIGIN = process.env.SPL_HOST || "https://www.slidphilabs.com";
export { isPccz, packArchive, parseArchive, crc32 };

export function asBuf(input) {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input);
  if (typeof input === "string") return Buffer.from(input);
  throw new TypeError("expected Buffer, Uint8Array, or string");
}

function headers(opts, contentType) {
  const h = { accept: "application/json", "content-type": contentType };
  if (opts.apiKey) h.authorization = `Bearer ${opts.apiKey}`;
  return h;
}

function fail(r, j, verb) {
  const e = new Error(j.plain || j.error || `${verb} HTTP ${r.status}`);
  e.status = r.status;
  e.body = j;
  return e;
}

export async function compress(input, opts = {}) {
  const buf = asBuf(input);
  const origin = opts.origin || ORIGIN;
  const r = await fetch(`${origin}/api/compress`, {
    method: "POST",
    headers: headers(opts, "application/octet-stream"),
    body: buf,
  });
  const j = await r.json();
  if (!j.ok) throw fail(r, j, "compress");
  j.packed = Buffer.from(j.packed_b64, "base64");
  return j;
}

export async function decompress(packed, opts = {}) {
  const origin = opts.origin || ORIGIN;
  let b64 = packed && packed.packed_b64;
  if (!b64) {
    const buf = asBuf(packed.packed || packed);
    b64 = buf.toString("base64");
  }
  const r = await fetch(`${origin}/api/decompress`, {
    method: "POST",
    headers: headers(opts, "application/json"),
    body: JSON.stringify({ packed_b64: b64 }),
  });
  const j = await r.json();
  if (!j.ok) throw fail(r, j, "decompress");
  if (j.raw_b64) j.raw = Buffer.from(j.raw_b64, "base64");
  return j;
}

/**
 * Pack many files into a .pcc archive. Each member is compressed on the host.
 * files: [{ path, data }]  data = Buffer | string | Uint8Array
 */
export async function zip(files, opts = {}) {
  const list = Array.isArray(files) ? files : [];
  if (!list.length) throw new Error("zip: no files");
  const entries = [];
  for (const f of list) {
    const name = f.path || f.name;
    const dir = Boolean(f.dir);
    const raw = dir ? Buffer.alloc(0) : asBuf(f.data || f.raw || "");
    let packed = raw;
    let stored = true;
    if (!dir && raw.length) {
      const j = await compress(raw, opts);
      packed = j.packed;
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
  return { ok: true, packed: archive, packed_b64: archive.toString("base64"), members: entries.length, ext: ".pcc" };
}

export async function unzip(packed, opts = {}) {
  const buf = asBuf(packed.packed || packed);
  const { entries } = parseArchive(buf);
  const files = [];
  for (const e of entries) {
    if (e.dir) {
      files.push({ path: e.name, data: Buffer.alloc(0), dir: true });
      continue;
    }
    let raw;
    if (e.stored) raw = Buffer.from(e.packed);
    else {
      const j = await decompress(e.packed, opts);
      raw = j.raw;
    }
    if (crc32(raw) !== e.crc32) throw new Error("pcc crc " + e.name);
    files.push({ path: e.name, data: raw, dir: false });
  }
  return { ok: true, files };
}

export default { compress, decompress, zip, unzip, ORIGIN, asBuf, isPccz };
