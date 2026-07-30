/**
 * Portable bitstream — Uint8Array pack/unpack (MSB-first within bytes)
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
  w.writeBitString(bitStr);
  return w.finish();
}

export function unpackBits(bytes, bitLen) {
  const r = new BitReader(bytes);
  return r.readBitString(bitLen);
}
