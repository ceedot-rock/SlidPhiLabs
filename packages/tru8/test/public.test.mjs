import assert from "node:assert/strict";
import test from "node:test";
import {
  compress,
  decompress,
  packZeroRun,
  unpackZeroRun,
  packDictPtr,
  unpackDictPtr,
  LicensedPathError,
  demoZeros,
} from "../src/index.mjs";

test("1e6 zeros → 8 B and back", () => {
  const raw = Buffer.alloc(1_000_000);
  const packed = compress(raw);
  assert.equal(packed.length, 8);
  assert.equal(packed[0], 0x00);
  assert.equal(unpackZeroRun(packed).length, 1_000_000);
  const out = decompress(packed);
  assert.equal(out.length, 1_000_000);
  assert.ok(out.every((b) => b === 0));
});

test("dict ptr is 8 B", () => {
  const p = packDictPtr(3, 1024);
  assert.equal(p.length, 8);
  const u = unpackDictPtr(p);
  assert.equal(u.dictId, 3);
  assert.equal(u.offset, 1024);
});

test("non-zero is licensed, not leaked", () => {
  assert.throws(() => compress(Buffer.from("secret-engine")), LicensedPathError);
  assert.throws(() => decompress(Buffer.from([0x03, 1, 2, 3])), LicensedPathError);
});

test("demo zeros ratio", () => {
  const d = demoZeros(1_000_000);
  assert.equal(d.tru8_bytes, 8);
  assert.equal(d.ratio, 125000);
});
