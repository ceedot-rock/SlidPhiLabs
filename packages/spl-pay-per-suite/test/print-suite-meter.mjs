#!/usr/bin/env node
/** Prints quote_cents for the lifetime meter fixtures. Used by `cuni prove`. */
import { computeQuote } from "../src/quote.mjs";
const GiB = 1024 ** 3;
for (const bytes of [0, 1 * GiB, 2 * GiB, 20 * GiB]) {
  console.log(String(computeQuote({ bytes }).amount_cents));
}
// op-invariance fixtures: the meter prices input bytes, so every op matches compress
console.log(String(computeQuote({ bytes: 20 * GiB, op: "decompress" }).amount_cents));
console.log(String(computeQuote({ bytes: 20 * GiB, op: "roundtrip" }).amount_cents));
