import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  expandRepeat,
  fitByteRepeat,
  packRepeat,
  unpackRepeat,
  priceRepeatProgram,
  inspectRepeatProgram,
  decodeLbhxRepeat,
  wrapLbhxPoly,
  MODEL_REPEAT,
  REPEAT_HDR_OVERHEAD,
} from "./repeat-peel.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDirs = [
  "/workspace/corpora/periodic",
  join(here, "../../../../../../corpora/periodic"),
  join(here, "../../../../../corpora/periodic"),
];

const TEXT_UNIT = Buffer.from("the cat sat on the mat. "); // period 24
const JSON_UNIT = Buffer.from('{"id":12345,"name":"sample-record","ok":true,"n":0}\n'); // period 52
const TEXT_N = 256 * 1024; // 262144; rem 16
const JSON_N = 128 * 1024; // 131072; rem 32
const TEXT_SHA =
  "b79edb8353013eecf23f3220cb4bf03320fb43e8424d1d517b670f378847e12e";
const JSON_SHA =
  "0896aa905a2edd3e65c5a7f8ae6a53985b693a8608e0218bee52f3b54f78b098";

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function loadOrSynth(name, unit, n, expectSha) {
  for (const d of fixtureDirs) {
    const p = join(d, name);
    if (existsSync(p)) {
      const b = readFileSync(p);
      assert.equal(sha256(b), expectSha, name + " sha256");
      return b;
    }
  }
  // Synthesize locked units when fixtures absent (CI without corpora).
  const synth = expandRepeat(unit, n);
  assert.equal(sha256(synth), expectSha, name + " synth sha256");
  return synth;
}

const text = loadOrSynth("text_repeat_256k.bin", TEXT_UNIT, TEXT_N, TEXT_SHA);
const json = loadOrSynth("json_128k.bin", JSON_UNIT, JSON_N, JSON_SHA);
assert.equal(text.length, TEXT_N);
assert.equal(json.length, JSON_N);
assert.equal(TEXT_N % 24, 16);
assert.equal(JSON_N % 52, 32);

// Bit-exact expand twin vs fixtures
assert.ok(expandRepeat(TEXT_UNIT, TEXT_N).equals(text), "text expand bit-exact");
assert.ok(expandRepeat(JSON_UNIT, JSON_N).equals(json), "json expand bit-exact");

// Period recovery
const ut = fitByteRepeat(text);
const uj = fitByteRepeat(json);
assert.ok(ut && ut.equals(TEXT_UNIT), "text period 24");
assert.ok(uj && uj.equals(JSON_UNIT), "json period 52");
assert.equal(ut.length, 24);
assert.equal(uj.length, 52);

// Pack sizes: 9 + period → 33 / 61
const pt = packRepeat(ut, TEXT_N);
const pj = packRepeat(uj, JSON_N);
assert.equal(pt.length, REPEAT_HDR_OVERHEAD + 24);
assert.equal(pj.length, REPEAT_HDR_OVERHEAD + 52);
assert.equal(pt.length, 33);
assert.equal(pj.length, 61);
assert.equal(pt[0], MODEL_REPEAT);
assert.equal(pj[0], MODEL_REPEAT);
assert.equal(pt.readUInt32LE(1), 24);
assert.equal(pj.readUInt32LE(1), 52);
assert.equal(pt.readUInt32LE(5 + 24), TEXT_N);
assert.equal(pj.readUInt32LE(5 + 52), JSON_N);

// Roundtrip LBHX repeat via JS helpers (metadata twin — not hosted seating claim)
for (const [raw, unit, n, aware] of [
  [text, ut, TEXT_N, 33],
  [json, uj, JSON_N, 61],
]) {
  const inner = packRepeat(unit, n);
  assert.equal(inner.length, aware);
  const blob = wrapLbhxPoly(raw.length, inner);
  assert.equal(blob.length, 13 + aware);
  const back = decodeLbhxRepeat(blob);
  assert.ok(back.raw.equals(raw), "LBHX repeat RT");
  assert.equal(back.model, "repeat");
  assert.equal(back.awareBytes, aware);
  assert.equal(back.unit_len, unit.length);
  assert.equal(back.n, n);
  const prog = inspectRepeatProgram(blob);
  assert.equal(prog.model, "repeat");
  assert.equal(prog.aware_bytes, aware);
  assert.equal(prog.unit_len, unit.length);
  assert.equal(prog.n, n);
  const unpacked = unpackRepeat(inner, raw.length);
  assert.ok(unpacked.raw.equals(raw));
}

// SKU pricing from raw
const skuT = priceRepeatProgram(text);
assert.equal(skuT.model, "repeat");
assert.equal(skuT.aware_bytes, 33);
assert.equal(skuT.unit_len, 24);
assert.equal(skuT.n, TEXT_N);
const skuJ = priceRepeatProgram(json);
assert.equal(skuJ.model, "repeat");
assert.equal(skuJ.aware_bytes, 61);
assert.equal(skuJ.unit_len, 52);
assert.equal(skuJ.n, JSON_N);

// Non-periodic rejects
assert.equal(fitByteRepeat(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8])), null);
assert.equal(priceRepeatProgram(Buffer.from("abcdefghi")), null);

console.log("repeat-peel OK", {
  text_repeat_256k: { period: 24, rem: 16, aware: 33, frame: 46 },
  json_128k: { period: 52, rem: 32, aware: 61, frame: 74 },
});
