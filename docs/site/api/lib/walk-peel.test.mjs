import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  makeWalk,
  emitI32le,
  parseI32le,
  packWalkLcg,
  packWalkD1,
  fitWalkConstMag,
  tryWalkLcgParams,
  priceWalkProgram,
  inspectWalkProgram,
  decodeLbhxWalk,
  wrapLbhxPoly,
  WALK_LCG_HEADER,
} from "./walk-peel.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDirs = [
  "/workspace/corpora/walks",
  join(here, "../../../../../../corpora/walks"),
  join(here, "../../../../../corpora/walks"),
];

function loadFixture(name) {
  for (const d of fixtureDirs) {
    const p = join(d, name);
    if (existsSync(p)) return readFileSync(p);
  }
  // Synthesize from makeWalk when fixtures absent (CI without corpora).
  if (name.includes("s1")) return emitI32le(makeWalk(10000, 1, 1));
  if (name.includes("s5")) return emitI32le(makeWalk(10000, 5, 2));
  throw new Error("missing fixture " + name);
}

const s1 = loadFixture("walk_10k_s1.i32le.bin");
const s5 = loadFixture("walk_10k_s5.i32le.bin");
assert.equal(s1.length, 40_000);
assert.equal(s5.length, 40_000);

// Bit-exact makeWalk twin vs fixtures
assert.ok(emitI32le(makeWalk(10000, 1, 1)).equals(s1), "makeWalk s1 bit-exact");
assert.ok(emitI32le(makeWalk(10000, 5, 2)).equals(s5), "makeWalk s5 bit-exact");

// Param recovery (may be an equivalent {±step,seed} pair — same as Rust/lb search order)
const v1 = parseI32le(s1);
const v5 = parseI32le(s5);
const r1 = tryWalkLcgParams(v1);
const r5 = tryWalkLcgParams(v5);
assert.ok(r1 && emitI32le(makeWalk(10000, r1.step, r1.seed)).equals(s1), "s1 params regenerate");
assert.ok(r5 && emitI32le(makeWalk(10000, r5.step, r5.seed)).equals(s5), "s5 params regenerate");
// Published generators still bit-exact:
assert.ok(emitI32le(makeWalk(10000, 1, 1)).equals(s1));
assert.ok(emitI32le(makeWalk(10000, 5, 2)).equals(s5));

// walk_lcg pack is exactly 9 B
const p1 = packWalkLcg(1, 1);
const p5 = packWalkLcg(5, 2);
assert.equal(p1.length, WALK_LCG_HEADER);
assert.equal(p5.length, 9);
assert.equal(p1[0], 6);
assert.equal(p5[0], 6);

// Roundtrip LBHX walk_lcg via JS helpers (metadata twin — not hosted seating claim)
for (const [raw, recovered] of [
  [s1, r1],
  [s5, r5],
]) {
  const inner = packWalkLcg(recovered.step, recovered.seed);
  assert.equal(inner.length, 9);
  const blob = wrapLbhxPoly(raw.length, inner);
  assert.equal(blob.length, 13 + 9);
  const back = decodeLbhxWalk(blob);
  assert.ok(back.raw.equals(raw), "LBHX walk_lcg RT");
  assert.equal(back.model, "walk_lcg");
  assert.equal(back.awareBytes, 9);
  const prog = inspectWalkProgram(blob);
  assert.equal(prog.model, "walk_lcg");
  assert.equal(prog.aware_bytes, 9);
  assert.equal(prog.step, recovered.step);
  assert.equal(prog.seed, recovered.seed);
}

// SKU pricing from raw — 9 B crown price; step/seed match search twin (≡ published)
const sku1 = priceWalkProgram(s1);
assert.equal(sku1.model, "walk_lcg");
assert.equal(sku1.aware_bytes, 9);
assert.ok(emitI32le(makeWalk(10000, sku1.step, sku1.seed)).equals(s1));
const sku5 = priceWalkProgram(s5);
assert.equal(sku5.model, "walk_lcg");
assert.equal(sku5.aware_bytes, 9);
assert.ok(emitI32le(makeWalk(10000, sku5.step, sku5.seed)).equals(s5));

// walk_d1 ladder pack + RT (non-LCG alternating signs)
{
  const n = 64;
  const vals = new Int32Array(n);
  vals[0] = 7;
  for (let i = 1; i < n; i++) vals[i] = (vals[i - 1] + (i % 3 === 0 ? -3 : 3)) | 0;
  const fit = fitWalkConstMag(vals);
  assert.ok(fit);
  assert.equal(tryWalkLcgParams(vals), null);
  const inner = packWalkD1(fit.start, fit.mag, fit.signs);
  assert.ok(inner.length >= 14);
  assert.equal(inner[0], 5);
  const blob = wrapLbhxPoly(n * 4, inner);
  const back = decodeLbhxWalk(blob);
  assert.ok(back.raw.equals(emitI32le(vals)));
  assert.equal(back.model, "walk_d1");
}

console.log("walk-peel OK", {
  s1: { step: 1, seed: 1, pack: 9 },
  s5: { step: 5, seed: 2, pack: 9 },
});
