import assert from "node:assert/strict";
import { encode, decode, inputToRaw, publicResult } from "./spl-codec.mjs";

function check(name, buf) {
  const e = encode(buf);
  const back = decode(e.frame);
  assert.ok(Buffer.isBuffer(back) && back.equals(buf), name + " RT fail " + e.method);
  return e;
}

const z = Buffer.alloc(40000);
const ez = check("zeros", z);
const zpub = publicResult(ez);
if (ez.method === "zrw") {
  assert.equal(ez.packed, 8);
  assert.equal(ez.lab_gene, true);
  assert.equal(ez.host_fallback, false);
  assert.equal(zpub.lab_gene, true);
  assert.equal(zpub.host_fallback, false);
  assert.equal(zpub.zrw_bytes, 8);
  assert.equal(zpub.claim_check.matches_flagship_8b_on_10k, true);
} else {
  assert.equal(ez.host_fallback, true, "without ZRW on this host, zeros must be labeled host fallback");
  assert.equal(ez.lab_gene, false);
  assert.equal(zpub.host_fallback, true);
  assert.equal(zpub.lab_gene, false);
}

const fromJson = inputToRaw({ corpus: "zeros", n: 10000 });
assert.ok(fromJson.equals(z));

const ramp = inputToRaw({ corpus: "ramp", n: 10000 });
const er = check("ramp", ramp);
if (er.method === "zrw") {
  assert.equal(er.lab_gene, true);
  assert.ok(er.packed < 100, "ramp tiny, got " + er.packed);
} else {
  assert.equal(er.host_fallback, true);
}

const walk = inputToRaw({ corpus: "walk", n: 256 });
check("walk", walk);

const hello = Buffer.from("the cat sat on the mat. ".repeat(40));
const eh = check("hello", hello);
assert.ok(eh.packed < hello.length);
assert.equal(eh.host_fallback, true, "english text on this surface is host gzip/brotli, not a lab gene");
assert.equal(eh.lab_gene, false);

const jsonish = Buffer.from(JSON.stringify({ a: 1, b: [2, 2, 2], s: "the cat sat on the mat" }).repeat(8));
check("jsonish", jsonish);

const empty = Buffer.alloc(0);
check("empty", empty);

console.log("spl-codec OK", {
  zeros: { packed: ez.packed, method: ez.method },
  ramp: { packed: er.packed, method: er.method },
  hello: { packed: eh.packed, method: eh.method, trials: eh.trials },
});
