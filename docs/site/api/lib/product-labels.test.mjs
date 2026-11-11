/** Lead-product label tests (LAB50 step 46). Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * PCC Pro must read PCC Pro everywhere (never Suite Pro), and the lead
 * product page must show real measured values, never a 0.0 placeholder.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const site = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("no Suite Pro label anywhere in published text", () => {
  const hits = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, f.name);
      if (f.isDirectory()) {
        if (f.name === "node_modules" || f.name === ".git") continue;
        walk(p);
      } else if (/\.(html|js|mjs|json|txt|md)$/.test(f.name)) {
        if (f.name.endsWith(".test.mjs")) continue;
        if (readFileSync(p, "utf8").includes("Suite Pro")) hits.push(p);
      }
    }
  };
  walk(site);
  assert.deepEqual(hits, []);
});

test("PCC Pro naming present where the plan is sold", () => {
  for (const f of ["pricing.html", "pay.html", "pps.html"]) {
    assert.match(readFileSync(join(site, f), "utf8"), /PCC Pro/, `${f} must name PCC Pro`);
  }
});

test("lead product page shows measured values, no 0.0 placeholder", () => {
  const html = readFileSync(join(site, "tru8.html"), "utf8");
  assert.ok(!/>0\.0</.test(html), "0.0 placeholder score");
  assert.ok(!/score[^<]{0,40}TBD/i.test(html), "TBD score");
  assert.match(html, /1 000 000 zeros|8 B/, "flagship measured value present");
});
