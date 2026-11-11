/** Price-truth sweep (LAB50 step 39). Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * pricing.json is the only price source. Value-level checks compare imported
 * code constants against it; text-level checks prove the published pages and
 * discovery blurbs carry the same numbers. Any price edit must start in
 * pricing.json and update the surface, or this suite fails.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FREE_GB, FREE_WINDOW, CENTS_PER_GB, DEFAULT_CAP_CENTS,
} from "../suite-pricing.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const pricing = JSON.parse(readFileSync(join(root, "pricing.json"), "utf8"));
const math = pricing.math;
const text = (rel) => readFileSync(join(root, rel), "utf8");

// ---- value level: code constants equal the JSON source ----

test("meter constants match pricing.json", () => {
  assert.equal(CENTS_PER_GB / 100, math.pcc_meter_gb);
  assert.equal(FREE_GB, pricing.products.pcc.meter.free_gb);
  assert.equal(FREE_WINDOW, pricing.products.pcc.meter.free_window);
  assert.equal(DEFAULT_CAP_CENTS / 100, pricing.products.pcc.meter.cap_default_usd);
});

// ---- text level: published surfaces carry the same numbers ----

const cases = [
  ["pricing.html", /\$0\.25\s*\/\s*GB input/, "PCC meter 25c"],
  ["pricing.html", /\$25\s*\/\s*month/, "PCC Pro 25"],
  ["pricing.html", /\$369\s*\/\s*yr grant/, "TNSSRC grant 369"],
  ["pricing.html", /founding \$190/, "TNSSRC founding 190"],
  ["docs.html", /\$0\.25\/GB of input/, "docs PCC meter"],
  ["docs.html", /first 1 GB free once per IP address \(lifetime/, "docs lifetime"],
  ["pay.html", /Chamber \$20\/mo/, "pay chamber month"],
  ["pay.html", /\$200\/yr/, "pay chamber year"],
  ["pay.html", /PCC Pro \$25\/mo/, "pay pro month"],
  ["pay.html", /Rider Solo \$12/, "pay rider solo"],
  ["pay.html", /Team \$49/, "pay rider team"],
  ["pay.html", /Fleet \$199/, "pay rider fleet"],
  ["api/agent.js", /\$0\.25\/GB of input/, "agent PCC meter"],
  ["api/agent.js", /\$120\/year/, "agent rider solo annual"],
  ["api/agent.js", /bundle \$495/, "agent lab pass"],
  ["api/agent.js", /\$0\.05 per check/, "agent cuni check"],
  ["api/agent.js", /\$0\.02 per fetch/, "agent quikgater"],
];

for (const [file, re, label] of cases) {
  test(`price present: ${label} (${file})`, () => {
    assert.match(text(file), re, `${label} missing or drifted in ${file}`);
  });
}

test("agent catalog amounts match pricing.json math", () => {
  const agent = text("api/agent.js");
  assert.match(agent, new RegExp(`"rider-solo"[\\s\\S]{0,200}usd: "${math.rider_solo}"`));
  assert.match(agent, new RegExp(`"rider-team"[\\s\\S]{0,200}usd: "${math.rider_team}"`));
  assert.match(agent, new RegExp(`"rider-fleet"[\\s\\S]{0,200}usd: "${math.rider_fleet}"`));
  assert.match(agent, new RegExp(`"lab-pass"[\\s\\S]{0,200}usd: "${math.lab_pass_year}"`));
  assert.match(agent, new RegExp(`"warrant-addon"[\\s\\S]{0,200}usd: "${math.warrant_addon}"`));
  assert.match(agent, new RegExp(`"chamber-month"[\\s\\S]{0,200}usd: "${math.chamber_month}"`));
});

test("spl-pay-per-suite copy matches pricing.json (LAB50 step 41)", () => {
  const pkgRoot = join(root, "..", "..", "packages", "spl-pay-per-suite");
  const readme = readFileSync(join(pkgRoot, "README.md"), "utf8");
  const quote = readFileSync(join(pkgRoot, "src", "quote.mjs"), "utf8");
  assert.match(readme, /First \*\*1 GB\*\*.*lifetime/, "README free tier");
  assert.match(readme, /\$0\.25\/GB/, "README meter");
  assert.match(quote, /export const FREE_GB = 1;/, "quote FREE_GB");
  assert.match(quote, /export const FREE_WINDOW = "lifetime";/, "quote FREE_WINDOW");
  assert.ok(!readme.includes("2 GB/month") && !readme.includes("8¢"),
    "stale 2 GB / 8c copy must not return");
});

test("mcp-service page carries current prices", () => {
  const page = text("mcp-service.html");
  assert.match(page, /first 1 GB free once per IP \(lifetime\), then \$0\.25\/GB/);
  assert.match(page, /Chamber \$20\/mo · \$200\/yr/);
  assert.match(page, /Lab Pass \$495\/yr/);
  assert.ok(!page.includes("2 GB/month") && !page.includes("8¢"),
    "stale meter copy must not return");
});

test("openapi carries no rogue price", () => {
  const spec = text("openapi.yaml");
  const allowed = new Set(Object.values(math).filter((v) => typeof v === "number"));
  for (const m of spec.matchAll(/\$(\d+(?:\.\d+)?)/g)) {
    assert.ok(allowed.has(Number(m[1])), `openapi price $${m[1]} not in pricing.json math`);
  }
});
