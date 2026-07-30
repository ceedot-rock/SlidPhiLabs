/**
 * Portable bitstream — Uint8Array pack/unpack (MSB-first within bytes)
 * + frame container for omni modes
 */

export class BitWriter {
  constructor() {
    this.buf = [];
    this.acc = 0;
    this.n = 0;
  }
  writeBit(b) {
    this.acc = (this.acc << 1) | (b & 1);
    this.n++;
    if (this.n === 8) {
      this.buf.push(this.acc);
      this.acc = 0;
      this.n = 0;
    }
  }
  writeBits(val, width) {
    for (let i = width - 1; i >= 0; i--) this.writeBit((val >> i) & 1);
  }
  writeBitString(s) {
    for (let i = 0; i < s.length; i++) this.writeBit(s[i] === "1" ? 1 : 0);
  }
  finish() {
    if (this.n > 0) {
      this.acc <<= 8 - this.n;
      this.buf.push(this.acc);
      this.acc = 0;
      this.n = 0;
    }
    return new Uint8Array(this.buf);
  }
}

export class BitReader {
  constructor(bytes) {
    this.bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    this.i = 0;
    this.acc = 0;
    this.n = 0;
  }
  readBit() {
    if (this.n === 0) {
      if (this.i >= this.bytes.length) throw new Error("bitstream underrun");
      this.acc = this.bytes[this.i++];
      this.n = 8;
    }
    this.n--;
    return (this.acc >> this.n) & 1;
  }
  readBits(width) {
    let v = 0;
    for (let i = 0; i < width; i++) v = (v << 1) | this.readBit();
    return v;
  }
  readBitString(len) {
    let s = "";
    for (let i = 0; i < len; i++) s += this.readBit() ? "1" : "0";
    return s;
  }
}

export function packBits(bitStr) {
  const w = new BitWriter();
  w.writeBitString(String(bitStr || ""));
  return w.finish();
}

export function unpackBits(bytes, bitLen) {
  const r = new BitReader(bytes);
  return r.readBitString(bitLen);
}

export function roundtripBits(bitStr) {
  const s = String(bitStr || "");
  return unpackBits(packBits(s), s.length);
}

function writeU32(view, o, n) {
  view.setUint32(o, n >>> 0, true);
}
function readU32(view, o) {
  return view.getUint32(o, true);
}

/**
 * Frame container:
 *   magic "SP\x01" | modeLen+mode | flags | n u32 | bitLen u32 | payload | meta JSON
 */
export function packFrame(frame) {
  if (!frame || typeof frame.bits !== "string") {
    throw new Error("packFrame: need frame.bits string");
  }
  const mode = String(frame.mode || "classic");
  const modeBytes = new TextEncoder().encode(mode);
  if (modeBytes.length > 255) throw new Error("mode too long");
  const bitLength = frame.bits.length;
  const payload = packBits(frame.bits);
  const meta = { ...frame };
  delete meta.bits;
  delete meta.mode;
  const metaBytes = new TextEncoder().encode(JSON.stringify(meta));
  const flags = 1;
  const buf = new Uint8Array(
    3 + 1 + modeBytes.length + 1 + 4 + 4 + payload.length + metaBytes.length
  );
  let o = 0;
  buf[o++] = 0x53;
  buf[o++] = 0x50;
  buf[o++] = 0x01;
  buf[o++] = modeBytes.length;
  buf.set(modeBytes, o);
  o += modeBytes.length;
  buf[o++] = flags;
  const view = new DataView(buf.buffer);
  writeU32(view, o, frame.n >>> 0);
  o += 4;
  writeU32(view, o, bitLength);
  o += 4;
  buf.set(payload, o);
  o += payload.length;
  buf.set(metaBytes, o);
  return buf;
}

export function unpackFrame(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u8.length < 12 || u8[0] !== 0x53 || u8[1] !== 0x50) {
    throw new Error("unpackFrame: bad magic");
  }
  if (u8[2] !== 1) throw new Error("unpackFrame: unsupported ver");
  let o = 3;
  const modeLen = u8[o++];
  const mode = new TextDecoder().decode(u8.subarray(o, o + modeLen));
  o += modeLen;
  const flags = u8[o++];
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const n = readU32(view, o);
  o += 4;
  const bitLength = readU32(view, o);
  o += 4;
  const payloadLen = Math.ceil(bitLength / 8);
  const payload = u8.subarray(o, o + payloadLen);
  o += payloadLen;
  const bits = unpackBits(payload, bitLength);
  let meta = {};
  if (flags & 1) {
    meta = JSON.parse(new TextDecoder().decode(u8.subarray(o)));
  }
  return { mode, n, bits, ...meta };
}
