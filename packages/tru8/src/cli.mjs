#!/usr/bin/env node
import { demoZeros, demoTrigram, demoDictBlock, compress, unpackZeroRun, credit, licensed } from "./index.mjs";

const cmd = process.argv[2] || "demo";

if (cmd === "zeros") {
  const n = Number(process.argv[3] || 1_000_000);
  const packed = compress(Buffer.alloc(n));
  const meta = unpackZeroRun(packed);
  console.log(JSON.stringify({ ...meta, tru8_bytes: packed.length, hex: packed.toString("hex"), credit }, null, 2));
  process.exit(0);
}

console.log("TRU8 public demos — Slid Phi Labs");
console.log("Less is more. We dropped the E.\n");
for (const d of [demoZeros(), demoTrigram(), demoDictBlock()]) {
  console.log(`[${d.token}] ${d.name}`);
  console.log(`  raw:  ${d.raw_bytes.toLocaleString()} B`);
  console.log(`  TRU8: ${d.tru8_bytes.toLocaleString()} B`);
  if (d.ratio) console.log(`  ratio: ${Math.round(d.ratio).toLocaleString()}×`);
  if (d.ratio_saving_pct) console.log(`  saving: ${d.ratio_saving_pct.toFixed(1)}%`);
  if (d.sum_hex) console.log(`  sum: ${d.sum_hex}`);
  console.log();
}
console.log(credit);
console.log(`Production residual · Year $1,900 · ${licensed.access}`);
console.log(`Inquire corey@slidphilabs.com · subject TRU8`);
