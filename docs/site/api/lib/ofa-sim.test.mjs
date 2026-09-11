import assert from "node:assert/strict";
import {
  acceptCard,
  chamberSeal,
  chamberUnseal,
  doCamp,
  packWorld,
  seedWorld,
  unpackWorld,
} from "./ofa-sim.mjs";

const w0 = seedWorld(27);
const w1 = doCamp(acceptCard(w0, true), "wrestle");
const tg8 = packWorld(w1);
assert.equal(typeof tg8, "string");
const back = unpackWorld(tg8);
assert.equal(JSON.stringify(back), JSON.stringify(w1));
const seal = chamberSeal(w1, { mode: "fixture" });
assert.equal(JSON.stringify(chamberUnseal(seal)), JSON.stringify(w1));
console.log("ofa-sim.test OK", { tg8Chars: tg8.length, leftover: w1.tissue.leftover });
