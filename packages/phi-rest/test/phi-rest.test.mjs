/**
 * phi-rest — offline unit tests (no network, no build step).
 * Covers the real cloak/open + split/join crypto path and the
 * createRest / bootRest RAM-serve path with temp-dir fixtures.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  phiSplit,
  phiJoin,
  cloak,
  open,
  createRest,
  bootRest,
  fromRest,
  walkCalled,
} from "../src/phi_rest.mjs";

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "phi-rest-"));
}

test("phiSplit/phiJoin roundtrip restores the key", () => {
  const key = Buffer.from("0123456789abcdef0123456789abcdef", "utf8");
  const { a, b } = phiSplit(key);
  assert.equal(a.length, key.length);
  assert.equal(b.length, key.length);
  assert.deepEqual(phiJoin(a, b), key);
});

test("cloak/open roundtrip restores plaintext", () => {
  const plain = Buffer.from("after fire, rest ".repeat(64), "utf8");
  const sealed = cloak(plain);
  assert.deepEqual(open(sealed), plain);
});

test("open fails closed on tampered ciphertext", () => {
  const sealed = cloak(Buffer.from("tamper me", "utf8"));
  const bad = { ...sealed, ct: Buffer.from(sealed.ct) };
  bad.ct[0] ^= 0xff;
  assert.throws(() => open(bad));
});

test("createRest boots called files and serves them from RAM", () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, "a.txt"), "hello rest");
  fs.writeFileSync(path.join(dir, "b.bin"), Buffer.from([1, 2, 3, 4]));
  const rest = createRest({ root: dir, called: ["a.txt", "b.bin", "missing.txt"] });
  const stats = rest.boot();
  assert.equal(stats.n, 2, "missing files are skipped");
  assert.equal(stats.bytes, Buffer.byteLength("hello rest") + 4);
  assert.deepEqual(rest.from(path.join(dir, "a.txt")), Buffer.from("hello rest"));
  assert.equal(rest.from(path.join(dir, "nope.txt")), null);
  assert.equal(rest.from(""), null);
});

test("createRest boot accepts extra files", () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, "extra.txt"), "extra");
  const rest = createRest({ root: dir });
  const stats = rest.boot(["extra.txt"]);
  assert.equal(stats.n, 1);
  assert.deepEqual(rest.from(path.join(dir, "extra.txt")), Buffer.from("extra"));
});

test("bootRest/fromRest serve the module-global hot map", () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, "hot.txt"), "hot bytes");
  const stats = bootRest(dir, ["hot.txt"]);
  assert.equal(stats.n, 1);
  assert.deepEqual(fromRest(path.join(dir, "hot.txt")), Buffer.from("hot bytes"));
  assert.equal(fromRest(path.join(dir, "cold.txt")), null);
});

test("walkCalled lists files relative to base", () => {
  const dir = tmpDir();
  fs.mkdirSync(path.join(dir, "sub"));
  fs.writeFileSync(path.join(dir, "sub", "c.txt"), "c");
  const out = walkCalled(path.join(dir, "sub"), dir).sort();
  assert.deepEqual(out, [path.join("sub", "c.txt")]);
  assert.deepEqual(walkCalled(path.join(dir, "nope"), dir), []);
});
