/**
 * TG8 pack — same frame as packages/trugame (MAGIC TG8\\x01).
 * Node zlib residual; bit-exact within this packer.
 */
import { deflateSync, inflateSync } from "node:zlib";

export const MAGIC = new Uint8Array([0x54, 0x47, 0x38, 0x01]); // TG8\x01
const T_ZERO = 0x00;

function u32le(n) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n >>> 0, true);
  return b;
}

function readU32le(u8, off) {
  return new DataView(u8.buffer, u8.byteOffset + off, 4).getUint32(0, true);
}

function concat(...parts) {
  const len = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function leadingZeros(data) {
  let n = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i] === 0) n++;
    else break;
  }
  return n;
}

export function tg8Compress(data) {
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (!u8.length) return concat(MAGIC, new Uint8Array([0]), u32le(0), u32le(0));
  let flags = 0;
  const parts = [];
  let rest = u8;
  const zrun = leadingZeros(u8);
  if (zrun >= 64) {
    flags |= 0x01;
    parts.push(new Uint8Array([T_ZERO]));
    parts.push(u32le(zrun));
    parts.push(new Uint8Array([0, 0, 0]));
    rest = u8.subarray(zrun);
  }
  flags |= 0x02;
  parts.push(deflateSync(rest.length ? rest : new Uint8Array(0), { level: 9 }));
  const payload = concat(...parts);
  return concat(MAGIC, new Uint8Array([flags]), u32le(u8.length), u32le(payload.length), payload);
}

export function tg8Decompress(blob) {
  const u8 = blob instanceof Uint8Array ? blob : new Uint8Array(blob);
  const isMagic =
    u8.length >= 13 &&
    u8[0] === MAGIC[0] &&
    u8[1] === MAGIC[1] &&
    u8[2] === MAGIC[2] &&
    u8[3] === MAGIC[3];
  if (!isMagic) return inflateSync(u8);
  const flags = u8[4];
  const packedLen = readU32le(u8, 9);
  const payload = u8.subarray(13, 13 + packedLen);
  let off = 0;
  const chunks = [];
  if (flags & 0x01) {
    if (payload[off] !== T_ZERO) throw new Error("bad T_ZERO");
    chunks.push(new Uint8Array(readU32le(payload, off + 1)));
    off += 8;
  }
  if (flags & 0x02) {
    const body = payload.subarray(off);
    if (body.length) chunks.push(inflateSync(body));
  } else {
    chunks.push(payload.subarray(off));
  }
  return concat(...chunks);
}

export function assertTg8Magic(u8) {
  if (
    !(
      u8 instanceof Uint8Array &&
      u8.length >= 4 &&
      u8[0] === 0x54 &&
      u8[1] === 0x47 &&
      u8[2] === 0x38 &&
      u8[3] === 0x01
    )
  ) {
    throw new Error("not TG8\\x01");
  }
}
