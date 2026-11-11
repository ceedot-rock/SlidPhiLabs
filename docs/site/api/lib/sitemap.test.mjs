/** Sitemap + internal-link tests (LAB50 step 44). Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * The sitemap must cover every page and name no dead page; same-site links
 * must resolve to a file. Regenerate with docs/site/scripts/sitemap.mjs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const site = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASE = "https://www.slidphilabs.com";
const sm = readFileSync(join(site, "sitemap.xml"), "utf8");
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const pages = readdirSync(site).filter((f) => f.endsWith(".html"));

function resolves(slug) {
  if (slug === "") return existsSync(join(site, "index.html"));
  return existsSync(join(site, `${slug}.html`))
    || existsSync(join(site, slug, "index.html"))
    || existsSync(join(site, slug));
}

test("sitemap covers every page", () => {
  const missing = pages
    .map((f) => (f === "index.html" ? `${BASE}/` : `${BASE}/${f.slice(0, -5)}`))
    .filter((u) => !locs.includes(u));
  assert.deepEqual(missing, []);
});

test("every sitemap page URL resolves to a file", () => {
  const dead = locs
    .filter((u) => u.startsWith(BASE))
    .map((u) => u.slice(BASE.length).replace(/^\//, "").replace(/\/$/, ""))
    .filter((s) => !s.startsWith("blog/") && !s.startsWith(".well-known/"))
    .filter((s) => !resolves(s));
  assert.deepEqual(dead, []);
});

test("same-site links resolve", () => {
  // Live non-file routes: vercel rewrites plus server.mjs route tables.
  // Every entry here must be provable in routing config, or the test fails.
  const vercel = JSON.parse(readFileSync(join(site, "vercel.json"), "utf8"));
  const rewriteSrc = new Set(
    (vercel.rewrites || []).map((r) => String(r.source || "").replace(/\/$/, "")));
  const serverSrc = readFileSync(join(site, "server.mjs"), "utf8");
  const ROUTES = ["/stand", "/codex/history", "/the-word"];
  for (const r of ROUTES) {
    assert.ok(rewriteSrc.has(r) || rewriteSrc.has(r + "/") || serverSrc.includes(`"${r}"`),
      `${r} allowlisted but missing from routing config`);
  }
  const broken = [];
  for (const f of pages) {
    const html = readFileSync(join(site, f), "utf8");
    for (const m of html.matchAll(/href="(\/[^"#?]*)"/g)) {
      const path = m[1];
      if (/^\/(api|mcp)(\/|$)/.test(path)) continue; // live routes, not files
      if (/\.[a-z0-9]+$/i.test(path) && !/\.(html?|txt|json|xml|css|js|png|jpg|svg|webmanifest|md)$/i.test(path)) continue;
      const slug = path.replace(/^\//, "").replace(/\/$/, "").replace(/\.html?$/, "");
      if (rewriteSrc.has(path) || ROUTES.includes(path)) continue;
      if (!resolves(slug)) broken.push(`${f} -> ${path}`);
    }
  }
  assert.deepEqual(broken.slice(0, 20), [], `${broken.length} broken internal links`);
});
