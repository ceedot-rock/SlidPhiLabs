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
assert.equal(ez.method, "zrw");
assert.equal(ez.packed, 8);
const zpub = publicResult(ez);
assert.equal(zpub.claim_check.matches_flagship_8b_on_10k, true);
assert.equal(zpub.zrw_bytes, 8);

const fromJson = inputToRaw({ corpus: "zeros", n: 10000 });
assert.ok(fromJson.equals(z));

const ramp = inputToRaw({ corpus: "ramp", n: 10000 });
const er = check("ramp", ramp);
assert.equal(er.method, "zrw");
assert.ok(er.packed < 100, "ramp tiny, got " + er.packed);

const walk = inputToRaw({ corpus: "walk", n: 256 });
check("walk", walk);

const hello = Buffer.from("the cat sat on the mat. ".repeat(40));
const eh = check("hello", hello);
assert.ok(eh.packed < hello.length);

const jsonish = Buffer.from(JSON.stringify({ a: 1, b: [2, 2, 2], s: "the cat sat on the mat" }).repeat(8));
check("jsonish", jsonish);

const empty = Buffer.alloc(0);
check("empty", empty);

console.log("spl-codec OK", {
  zeros: { packed: ez.packed, method: ez.method },
  ramp: { packed: er.packed, method: er.method },
  hello: { packed: eh.packed, method: eh.method, trials: eh.trials },
});
