/** Verse/board count consistency (LAB50 step 45). Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * One ledger: silesia.json totals. Every published surface must carry the
 * same four stamps, and the phantom 45,813,567 must not appear anywhere.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const site = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const text = (rel) => readFileSync(join(site, rel), "utf8");
const ledger = JSON.parse(text("silesia.json"));

const STAMPS = {
  tnssrc: "43,724,575",
  pcc: "51,498,645",
  pulsar: "55,745,438",
};
// champ is a third-party reference row: required only where the full board
// is cited, not on every product surface.
const CHAMP_SURFACES = ["silesia.html", "api/agent.js"];

test("ledger holds all four board stamps", () => {
  assert.equal(ledger.totals.tnssrc.packed_bytes, 43724575);
  assert.equal(ledger.totals.pcc.packed_bytes, 51498645);
  assert.equal(ledger.totals.pulsar.packed_bytes, 55745438);
  assert.equal(ledger.totals.champ.packed_bytes, 50541135);
  for (const [engine, t] of Object.entries(ledger.totals)) {
    if (typeof t.packed_bytes === "number") assert.equal(t.decode_ok, 12, engine);
  }
});

const SURFACES = [
  "about.html",
  "archive.html",
  "silesia.html",
  "agents.json",
  "agents.txt",
  "ai.txt",
  "humans.txt",
  "api/agent.js",
];

for (const [engine, stamp] of Object.entries(STAMPS)) {
  test(`stamp ${engine} ${stamp} on every surface`, () => {
    const missing = SURFACES.filter((f) => !text(f).includes(stamp));
    assert.deepEqual(missing, [], `${engine} stamp missing from: ${missing.join(",")}`);
  });
}

test("champ 50,541,135 where the full board is cited", () => {
  const missing = CHAMP_SURFACES.filter((f) => !text(f).includes("50,541,135"));
  assert.deepEqual(missing, []);
});

test("phantom 45,813,567 appears nowhere", () => {
  const hits = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, f.name);
      if (f.isDirectory()) {
        if (f.name === "node_modules" || f.name === ".git") continue;
        walk(p);
      } else if (/\.(html|js|mjs|json|txt|md)$/.test(f.name)) {
        // *.test.mjs fixtures name the phantom to ban it (see
        // suite-pricing.test.mjs); they are the ban, not the violation.
        if (f.name.endsWith(".test.mjs")) continue;
        if (readFileSync(p, "utf8").includes("45,813,567")) hits.push(p);
      }
    }
  };
  walk(site);
  assert.deepEqual(hits, []);
});
