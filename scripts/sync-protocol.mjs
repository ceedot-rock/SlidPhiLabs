#!/usr/bin/env node
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const lab = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cuni = resolve(lab, "../cuni");
const src = join(cuni, "protocol.json");
if (!existsSync(src)) { console.error("missing", src); process.exit(1); }
const dests = [
  join(cuni, "playground/protocol.json"),
  join(cuni, "playground/.well-known/cuni-protocol.json"),
  join(lab, "docs/site/cuni-protocol.json"),
  join(lab, "docs/site/.well-known/cuni-protocol.json"),
];
for (const d of dests) { mkdirSync(dirname(d), { recursive: true }); copyFileSync(src, d); }
console.log("protocol →", dests.length, "mirrors");
