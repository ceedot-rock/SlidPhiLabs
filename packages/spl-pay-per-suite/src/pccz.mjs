/**
 * .pcc archive — our zip. Container only. Occupants come from the host.
 * Magic PCCZ. Not PKZIP. Not deflate.
 */
export const MAGIC = Buffer.from("PCCZ");
export const VER = 1;
export const LOC = Buffer.from("PCCm");
export const CD = Buffer.from("PCCd");
export const EOCD = Buffer.from("PCCz");
export const FLAG_DIR = 1;
export const FLAG_STORED = 2;
export const EOCD_LEN = 37;

export function crc32(data) {
  const buf = Buffer.from(data);
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function isPccz(buf) {
  const b = Buffer.from(buf);
  return b.length >= 8 && b.subarray(0, 4).equals(MAGIC) && b[4] === VER;
}

export function cleanName(name) {
  const s = String(name || "").replace(/\\/g, "/");
  if (!s || s.length > 4096) throw new Error("pcc name");
  if (s.startsWith("/") || s.includes("\0")) throw new Error("pcc name");
  for (const part of s.split("/")) {
    if (!part || part === "." || part === "..") throw new Error("pcc name");
  }
  return s;
}

function putU16(out, n) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n, 0);
  out.push(b);
}
function putU32(out, n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  out.push(b);
}
function putU64(out, n) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n), 0);
  out.push(b);
}

export function packArchive(entries) {
  const recs = entries.map((e) => {
    const name = cleanName(e.name);
    const packed = Buffer.from(e.packed || []);
    const flags = (e.dir ? FLAG_DIR : 0) | (e.stored ? FLAG_STORED : 0);
    return {
      name,
      flags,
      mtime: (e.mtime || 0) >>> 0,
      mode: e.mode == null ? (e.dir ? 0o755 : 0o644) : e.mode,
      rawLen: Number(e.rawLen || 0),
      packedLen: packed.length,
      crc: (e.crc32 || 0) >>> 0,
      packed,
      dataOff: 0,
    };
  });
  const parts = [Buffer.from(MAGIC), Buffer.from([VER, 0, 0, 0])];
  for (const r of recs) {
    r.dataOff = parts.reduce((n, p) => n + p.length, 0);
    const nb = Buffer.from(r.name, "utf8");
    const loc = [];
    loc.push(Buffer.from(LOC));
    putU16(loc, r.flags);
    putU16(loc, nb.length);
    loc.push(nb);
    putU32(loc, r.mtime);
    putU16(loc, r.mode);
    putU64(loc, r.rawLen);
    putU64(loc, r.packedLen);
    putU32(loc, r.crc);
    loc.push(r.packed);
    parts.push(...loc);
  }
  const cdOff = parts.reduce((n, p) => n + p.length, 0);
  const cd = [Buffer.from(CD)];
  putU32(cd, recs.length);
  let totalRaw = 0;
  let totalPacked = 0;
  for (const r of recs) {
    const nb = Buffer.from(r.name, "utf8");
    putU16(cd, r.flags);
    putU16(cd, nb.length);
    cd.push(nb);
    putU32(cd, r.mtime);
    putU16(cd, r.mode);
    putU64(cd, r.rawLen);
    putU64(cd, r.packedLen);
    putU32(cd, r.crc);
    putU64(cd, r.dataOff);
    totalRaw += r.rawLen;
    totalPacked += r.packedLen;
  }
  parts.push(...cd);
  const cdSize = parts.reduce((n, p) => n + p.length, 0) - cdOff;
  const end = [Buffer.from(EOCD), Buffer.from([VER])];
  putU32(end, recs.length);
  putU64(end, cdOff);
  putU32(end, cdSize);
  putU64(end, totalRaw);
  putU64(end, totalPacked);
  parts.push(...end);
  return Buffer.concat(parts);
}

function takeU16(buf, i) {
  return { n: buf.readUInt16LE(i), i: i + 2 };
}
function takeU32(buf, i) {
  return { n: buf.readUInt32LE(i), i: i + 4 };
}
function takeU64(buf, i) {
  return { n: Number(buf.readBigUInt64LE(i)), i: i + 8 };
}

export function parseArchive(buf) {
  const b = Buffer.from(buf);
  if (!isPccz(b)) throw new Error("not pcc archive");
  if (b.length < EOCD_LEN) throw new Error("pcc short");
  const e = b.length - EOCD_LEN;
  if (!b.subarray(e, e + 4).equals(EOCD) || b[e + 4] !== VER) throw new Error("pcc eocd");
  let i = e + 5;
  let t = takeU32(b, i); const n = t.n; i = t.i;
  t = takeU64(b, i); const cdOff = t.n; i = t.i;
  t = takeU32(b, i); const cdSize = t.n; i = t.i;
  const cd = b.subarray(cdOff, cdOff + cdSize);
  if (cd.length < 8 || !cd.subarray(0, 4).equals(CD)) throw new Error("pcc cd");
  i = 4;
  t = takeU32(cd, i); const n2 = t.n; i = t.i;
  if (n2 !== n) throw new Error("pcc n");
  const entries = [];
  for (let k = 0; k < n; k++) {
    t = takeU16(cd, i); const flags = t.n; i = t.i;
    t = takeU16(cd, i); const nl = t.n; i = t.i;
    const name = cleanName(cd.subarray(i, i + nl).toString("utf8"));
    i += nl;
    t = takeU32(cd, i); const mtime = t.n; i = t.i;
    t = takeU16(cd, i); const mode = t.n; i = t.i;
    t = takeU64(cd, i); const rawLen = t.n; i = t.i;
    t = takeU64(cd, i); const packedLen = t.n; i = t.i;
    t = takeU32(cd, i); const crc = t.n; i = t.i;
    t = takeU64(cd, i); const dataOff = t.n; i = t.i;
    let j = dataOff + 4;
    t = takeU16(b, j); j = t.i;
    t = takeU16(b, j); const nloc = t.n; j = t.i;
    j += nloc + 4 + 2 + 8 + 8 + 4;
    const packed = b.subarray(j, j + packedLen);
    entries.push({
      name,
      packed,
      rawLen,
      crc32: crc,
      stored: Boolean(flags & FLAG_STORED),
      dir: Boolean(flags & FLAG_DIR),
      mtime,
      mode,
    });
  }
  return { n, entries };
}

export function unpackStored(buf) {
  const { entries } = parseArchive(buf);
  return entries.map((e) => {
    if (e.dir) return { name: e.name, data: Buffer.alloc(0), dir: true };
    if (!e.stored) throw new Error("pcc member needs decompress");
    if (crc32(e.packed) !== e.crc32) throw new Error("pcc crc");
    return { name: e.name, data: Buffer.from(e.packed), dir: false };
  });
}
