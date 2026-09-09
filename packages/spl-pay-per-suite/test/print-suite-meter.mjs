#!/usr/bin/env node
/** Prints quote_cents for the CuNi suite-meter fixtures. Used by `cuni prove`. */
import { computeQuote } from "../src/quote.mjs";
const GiB = 1024 ** 3;
for (const bytes of [0, 2 * GiB, 3 * GiB, 20 * GiB]) {
  console.log(String(computeQuote({ bytes }).amount_cents));
}
