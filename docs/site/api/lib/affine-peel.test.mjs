import assert from "node:assert/strict";
import {
  fitAffineExact,
  packAffineInner,
  unpackAffineInner,
  priceAffineProgram,
  inspectAffineProgram,
  decodeLbhxAffine,
  wrapLbhxPoly,
  emitI32le,
  parseI32le,
  MODEL_AFFINE_I32,
  AFFINE_I32_ZERO_HEADER,
} from "./affine-peel.mjs";
import { priceWalkProgram } from "./walk-peel.mjs";

function makeRamp(n) {
  const a = new Int32Array(n);
  for (let i = 0; i < n; i++) a[i] = i;
  return emitI32le(a);
}

const ramp = makeRamp(65536);
assert.equal(ramp.length, 262144);

const fit = fitAffineExact(parseI32le(ramp));
assert.ok(fit);
assert.equal(Number(fit.start), 0);
assert.equal(Number(fit.step), 1);

const sku = priceAffineProgram(ramp);
assert.ok(sku);
assert.equal(sku.model, "affine_i32");
assert.equal(sku.model_id, MODEL_AFFINE_I32);
assert.equal(sku.aware_bytes, 18);
assert.equal(sku.start, 0);
assert.equal(sku.step, 1);

// walk must not steal exact same-sign ramp
assert.equal(priceWalkProgram(ramp), null, "walk must not price exact affine ramp");

const inner = packAffineInner(0n, 1n, null);
assert.equal(inner.length, AFFINE_I32_ZERO_HEADER);
assert.equal(inner[0], MODEL_AFFINE_I32);

const unpacked = unpackAffineInner(inner, 65536);
assert.equal(unpacked.model, "affine_i32");
assert.ok(emitI32le(unpacked.vals).equals(ramp));

const frame = wrapLbhxPoly(ramp.length, inner);
const insp = inspectAffineProgram(frame);
assert.ok(insp);
assert.equal(insp.aware_bytes, 18);
assert.equal(insp.model, "affine_i32");

const dec = decodeLbhxAffine(frame);
assert.ok(dec.raw.equals(ramp));
assert.equal(dec.awareBytes, 18);

console.log("affine-peel.test.mjs ok");
