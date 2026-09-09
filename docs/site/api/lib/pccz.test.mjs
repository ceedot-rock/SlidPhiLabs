import { test } from "node:test";
import assert from "node:assert/strict";
import { crc32, isPccz, packArchive, parseArchive } from "./pccz.mjs";

test("crc32 IEEE of 123456789", () => {
  assert.equal(crc32("123456789"), 0xcbf43926);
});

test("stored .pcc roundtrip", () => {
  const hello = Buffer.from("hello pcc archive\n");
  const zeros = Buffer.alloc(1000);
  const blob = packArchive([
    { name: "readme.txt", packed: hello, rawLen: hello.length, crc32: crc32(hello), stored: true },
    { name: "a/zeros.bin", packed: zeros, rawLen: zeros.length, crc32: crc32(zeros), stored: true },
    { name: "empty", packed: Buffer.alloc(0), rawLen: 0, crc32: crc32(Buffer.alloc(0)), stored: true, dir: true },
  ]);
  assert.equal(isPccz(blob), true);
  assert.equal(blob.subarray(0, 4).toString("latin1"), "PCCZ");
  const { entries } = parseArchive(blob);
  assert.equal(entries.length, 3);
  assert.equal(entries[0].name, "readme.txt");
  assert.equal(Buffer.compare(entries[0].packed, hello), 0);
  assert.equal(entries[1].rawLen, 1000);
  assert.equal(entries[2].dir, true);
});

test("reject zip-slip names", () => {
  assert.throws(() => packArchive([{ name: "../etc/passwd", packed: Buffer.from("x"), rawLen: 1, crc32: 0, stored: true }]));
});
