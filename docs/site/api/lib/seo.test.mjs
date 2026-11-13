/** SEO surface tests (LAB50 step 43). Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Every public page carries a real og:description (no fallback text), and
 * every product page carries Product + Offer JSON-LD priced from
 * pricing.json. Add new pages/products to the lists below, not around them.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const site = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const pages = readdirSync(site).filter((f) => f.endsWith(".html"));
const text = (f) => readFileSync(join(site, f), "utf8");

const FALLBACK = [/coming soon/i, /lorem ipsum/i, /TODO/, /\b1 GB\/month\b/];

test("every page has a real og:description", () => {
  assert.ok(pages.length > 50, "page inventory sanity");
  const missing = pages.filter((p) => !/<meta property="og:description" content="[^"]{20,}"/.test(text(p)));
  assert.deepEqual(missing, [], `pages without og:description: ${missing.join(",")}`);
  for (const p of pages) {
    const m = text(p).match(/<meta property="og:description" content="([^"]*)"/);
    for (const re of FALLBACK) {
      assert.ok(!re.test(m[1]), `${p} og:description looks like fallback: ${m[1].slice(0, 80)}`);
    }
  }
});

const PRODUCTS = {
  "chamber.html": ["20", "200"],
  "rider.html": ["12", "49", "199"],
  "lab-pass.html": ["495"],
  "pps.html": ["0.25", "25"],
  "warrant.html": ["8", "80"],
  "cuni.html": ["0.05"],
};

for (const [page, prices] of Object.entries(PRODUCTS)) {
  test(`Product+Offer JSON-LD on ${page}`, () => {
    const html = text(page);
    assert.ok(html.includes('"@type":"Product"'), `${page} missing Product schema`);
    assert.ok(html.includes('"@type":"Offer"'), `${page} missing Offer schema`);
    for (const price of prices) {
      assert.ok(html.includes(`"price":"${price}"`), `${page} missing offer price ${price}`);
    }
  });
}
