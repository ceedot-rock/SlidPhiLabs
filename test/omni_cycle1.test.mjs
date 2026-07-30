/**
 * SlidPhi cycle 1 — RT all modes + size asserts + bitstream
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  encode,
  decode,
  encodeBytes,
  decodeBytes,
  OMNI_META,
  packBits,
  unpackBits,
  encodeHybrid,
  decodeHybrid,
  encodeClassic,
  decodeClassic,
} from "../src/index.mjs";

function rt(mode, data, opts = {}) {
  const f = encode(mode, data, opts);
  const y = decode(f);
  assert.deepEqual(y, data, mode + " RT fail");
  return f;
}

function seq(n) {
  return Array.from({ length: n }, (_, i) => i + 1);
}
function geoGaps(n, p = 0.2) {
  const x = [1];
  while (x.length < n) {
    const g = 1 + Math.floor(-Math.log(1 - Math.random()) / p);
    x.push(x.at(-1) + g);
  }
  return x;
}
function rand1toM(n, M) {
  return Array.from({ length: n }, () => 1 + Math.floor(Math.random() * M));
}

test("bitstream pack/unpack roundtrip", () => {
  const s = "1011001110001111000011111";
  const bytes = packBits(s);
  assert.equal(unpackBits(bytes, s.length), s);
});

test("RT classic list 1..100", () => {
  rt("classic", seq(100));
});

test("RT dense k4 1..1000", () => {
  rt("dense", seq(1000), { profile: "k4" });
});

test("RT universe 1..10k values in 1..10k", () => {
  const M = 10000;
  const data = rand1toM(500, M);
  rt("universe", data, { M });
});

test("RT gaps geo", () => {
  rt("gaps", geoGaps(200));
});

test("RT interp sorted unique", () => {
  const data = seq(300).map((x) => x * 3);
  rt("interp", data);
});

test("RT smooth series", () => {
  const data = seq(100).map((i) => 1000 + i * 3 + (i % 5));
  rt("smooth", data);
});

test("RT for narrow band", () => {
  const data = Array.from({ length: 200 }, () => 500 + Math.floor(Math.random() * 16));
  rt("for", data);
});

test("RT rans mode (small force + large block metrics)", () => {
  const small = geoGaps(100);
  const fSmall = encode("rans", small, { force: true });
  assert.equal(fSmall.mode, "rans");
  assert.deepEqual(decode(fSmall), small);

  const big = geoGaps(2500);
  const fBig = encode("rans", big);
  assert.ok(fBig.rans?.headerBits > 0);
  assert.ok(fBig.rans?.totalBits > 0);
  assert.deepEqual(decode(fBig), big);
});

test("portable encodeBytes/decodeBytes universe + gaps + dense", () => {
  const M = 10000;
  for (const [mode, data, opts] of [
    ["universe", rand1toM(200, M), { M }],
    ["gaps", geoGaps(150), {}],
    ["dense", rand1toM(150, M), { profile: "k4" }],
  ]) {
    const bytes = encodeBytes(mode, data, opts);
    assert.ok(bytes instanceof Uint8Array);
    assert.deepEqual(decodeBytes(bytes), data);
  }
});

test("universe smaller than dense auto on random 1..M", () => {
  const M = 10000;
  const data = rand1toM(2000, M);
  const u = encode("universe", data, { M });
  const d = encode("dense", data, { profile: "auto" });
  const uBits = u.bits.length;
  const dBits = d.bits.length;
  // Universe fixed-width should beat hybrid auto on uniform-ish 1..M
  assert.ok(
    uBits < dBits,
    `expected universe ${uBits} < dense auto ${dBits}`
  );
});

test("hybrid locked k4 RT", () => {
  for (const n of [1, 2, 15, 16, 255, 256, 10000, 999999]) {
    assert.equal(decodeHybrid(encodeHybrid(n, 4), 4), n);
  }
  assert.equal(decodeClassic(encodeClassic(42)), 42);
});

test("OMNI_META documents rans header tax + k4 default", () => {
  assert.equal(OMNI_META.version, 2);
  assert.ok(OMNI_META.pathways.includes("rans"));
  assert.ok(OMNI_META.rans.header_tax);
  assert.equal(OMNI_META.dense_default_profile, "k4");
  assert.ok(OMNI_META.bitstream.container);
});
