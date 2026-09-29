/**
 * pccz archive roundtrip — local, no network.
 * Tests the real packArchive/parseArchive/crc32/isPccz code path.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  packArchive,
  parseArchive,
  crc32,
  isPccz,
  cleanName,
} from "../src/pccz.mjs";

test("crc32 is deterministic and sensitive", () => {
  const a = crc32(Buffer.from("hello"));
  const b = crc32(Buffer.from("hello"));
  const c = crc32(Buffer.from("hellp"));
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("isPccz rejects non-archives", () => {
  assert.equal(isPccz(Buffer.from("not an archive")), false);
  assert.equal(isPccz(Buffer.alloc(0)), false);
});

test("cleanName refuses traversal", () => {
  assert.throws(() => cleanName("../../etc/passwd"), /pcc name/);
  assert.throws(() => cleanName("/abs/path"), /pcc name/);
  assert.equal(cleanName("docs/a.txt"), "docs/a.txt");
});

test("pack/parse roundtrip preserves entries", () => {
  const payload = Buffer.from("the quick brown fox".repeat(100));
  const entries = [
    { name: "a.txt", packed: payload, rawLen: payload.length, crc32: crc32(payload) },
    { name: "empty.bin", packed: Buffer.alloc(0), rawLen: 0, crc32: crc32(Buffer.alloc(0)) },
    { name: "docs", dir: true },
  ];
  const buf = packArchive(entries);
  assert.ok(isPccz(buf), "packed output must be a pccz archive");
  const { entries: back } = parseArchive(buf);
  assert.equal(back.length, 3);
  assert.equal(back[0].name, "a.txt");
  assert.deepEqual(Buffer.from(back[0].packed), payload);
  assert.equal(back[0].crc32, crc32(payload) >>> 0);
  assert.equal(back[2].name, "docs");
});

test("parseArchive refuses garbage", () => {
  assert.throws(() => parseArchive(Buffer.from("PCCZ" + "x".repeat(100))), /pcc/);
});
