import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { encode, decode } from "./spl-codec.mjs";

function check(name, buf) {
  const e = encode(buf);
  const back = decode(e.frame);
  assert.ok(back.equals(buf), name + " RT fail " + e.method);
  return e;
}

const z = Buffer.alloc(40000);
const ez = check("zeros", z);
assert.ok(ez.packed <= 16, "zeros should be tiny, got " + ez.packed);

const ramp = Buffer.alloc(40000);
for (let i = 0; i < 10000; i++) ramp.writeInt32LE(i, i * 4);
const er = check("ramp", ramp);
assert.ok(er.packed < 100, "ramp tiny, got " + er.packed);

const hello = Buffer.from("the cat sat on the mat. ".repeat(40));
const eh = check("hello", hello);
assert.ok(eh.packed < hello.length);



console.log("spl-codec OK", {
  zeros: { packed: ez.packed, method: ez.method },
  ramp: { packed: er.packed, method: er.method },
  hello: { packed: eh.packed, method: eh.method },
});
