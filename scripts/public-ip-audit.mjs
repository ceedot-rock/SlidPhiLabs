#!/usr/bin/env node
/**
 * Fail if a public npm tarball would contain host engines.
 */
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const FORBIDDEN = [
  "zrw-pack",
  "rdom-real",
  "omniwave.js",
  "encodeReal",
  "ZeroRangeWave",
  "dark_parallel",
  "barrel_cone",
  "creator_cloak",
  "vendor/engine",
];

const packs = [
  { dir: ".", name: "slid-phi" },
  { dir: "packages/blackjack-compression", name: "blackjack-compression" },
  { dir: "packages/spl-pay-per-suite", name: "spl-pay-per-suite" },
  { dir: "packages/tru8", name: "@cptasz13/tru8" },
];

let failed = 0;
for (const p of packs) {
  const tmp = mkdtempSync(join(tmpdir(), "spl-pack-"));
  try {
    const out = execSync(`npm pack --pack-destination ${tmp} --json --silent`, {
      cwd: join(process.cwd(), p.dir === "." ? "." : p.dir),
      encoding: "utf8",
    });
    const tgz = JSON.parse(out)[0]?.filename;
    if (!tgz) throw new Error("no tarball");
    execSync(`tar -xzf ${join(tmp, tgz)} -C ${tmp}`);
    const hits = [];
    function walk(d) {
      for (const ent of readdirSync(d, { withFileTypes: true })) {
        const fp = join(d, ent.name);
        if (ent.isDirectory()) walk(fp);
        else {
          const txt = readFileSync(fp, "utf8");
          for (const needle of FORBIDDEN) {
            if (txt.includes(needle) && !fp.endsWith("LICENSE") && !fp.includes("README")) {
              hits.push(`${fp}: ${needle}`);
            }
          }
        }
      }
    }
    walk(join(tmp, "package"));
    if (hits.length) {
      console.error("FAIL", p.name, hits.slice(0, 8));
      failed++;
    } else {
      console.log("OK", p.name);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (failed) {
  console.error("public-ip-audit: engine bytes would ship in npm");
  process.exit(1);
}
console.log("public-ip-audit: tarballs are stubs/clients");
