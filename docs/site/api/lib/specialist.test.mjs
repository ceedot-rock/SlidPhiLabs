import assert from "node:assert/strict";
import { accessSync, constants } from "node:fs";
import { classify, encodeFill, decodeFill, encodeHosted, decodeFrame, inputToRaw } from "./specialist.mjs";
import { pulsarBin } from "./pulsar-host.mjs";
import { lbBin } from "./engines.mjs";

// Engine binaries resolve via PULSAR_BIN/LB_BIN or ./bin under cwd.
// No stale home-directory defaults: an absent engine is a real state,
// and "store" is then the correct answer, not a failure.
const hasEngines = [pulsarBin(), lbBin()].every((p) => {
  try {
    accessSync(p, constants.X_OK);
    return true;
  } catch {
    return false;
  }
});

const z1e6 = Buffer.alloc(1_000_000);
const e1 = encodeFill(z1e6);
assert.equal(e1.packed_bytes, 8);
assert.equal(e1.host_fallback, false);
const backZ = decodeFill(Buffer.from(e1.packed_b64, "base64"));
assert.ok(backZ.equals(z1e6));

const text = Buffer.from("the cat sat on the mat. ".repeat(800));
assert.equal(classify(text).seat, "struct_text");
const enc = await encodeHosted(text);
assert.equal(enc.ok, true);
assert.equal(enc.host_fallback, false);
if (hasEngines) {
  assert.ok(["pulsar", "lz", "paq", "lbr1", "aware", "repeat", "walk_lcg", "walk_d1"].includes(enc.method), enc.method);
  assert.ok(enc.packed_bytes < text.length);
} else {
  assert.equal(enc.method, "store");
  assert.equal(enc.packed_bytes, text.length);
}
const back = await decodeFrame(Buffer.from(enc.packed_b64, "base64"));
assert.ok(back.equals(text), "hosted RT");

const zerosJson = inputToRaw({ corpus: "zeros", n: 40_000 });
assert.equal(zerosJson.length, 40_000);

console.log("specialist OK", {
  zeros: e1.packed_bytes,
  text: { method: enc.method, packed: enc.packed_bytes, raw: text.length },
});
