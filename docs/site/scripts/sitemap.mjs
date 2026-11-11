/** Regenerate sitemap.xml from the tree (LAB50 step 44). Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Preserves existing entries (hand-tuned priority/changefreq/lastmod), adds
 * missing pages with defaults, and drops page URLs whose files are gone.
 * Non-file routes (blog/*, .well-known/*) are kept. Run:
 *   node docs/site/scripts/sitemap.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const site = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://www.slidphilabs.com";
const today = new Date().toISOString().slice(0, 10);

const xml = readFileSync(join(site, "sitemap.xml"), "utf8");
const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]);
const locOf = (e) => (e.match(/<loc>([^<]+)<\/loc>/) || [])[1] || "";

const fileFor = (slug) => {
  if (slug === "") return join(site, "index.html");
  for (const cand of [`${slug}.html`, join(slug, "index.html"), slug]) {
    if (existsSync(join(site, cand))) return join(site, cand);
  }
  return null;
};

const kept = [];
const dropped = [];
for (const e of entries) {
  const loc = locOf(e);
  const slug = loc.startsWith(BASE) ? loc.slice(BASE.length).replace(/^\//, "").replace(/\/$/, "") : null;
  if (slug === null) {
    kept.push(e); // foreign URL: leave alone
    continue;
  }
  if (slug.startsWith("blog/") || slug.startsWith(".well-known/")) {
    kept.push(e); // route served outside the static tree
    continue;
  }
  if (fileFor(slug)) kept.push(e);
  else dropped.push(loc);
}

const have = new Set(kept.map(locOf));
const added = [];
for (const f of readdirSync(site).filter((f) => f.endsWith(".html"))) {
  const slug = f === "index.html" ? "" : f.slice(0, -5);
  const loc = `${BASE}/${slug}`;
  if (!have.has(loc)) {
    kept.push(`<url><loc>${loc}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.5</priority></url>`);
    added.push(loc);
  }
}

const out = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${kept.join("\n")}\n</urlset>\n`;
writeFileSync(join(site, "sitemap.xml"), out);
console.log(`sitemap OK: kept ${kept.length}, added ${added.length}, dropped ${dropped.length}`);
for (const l of added) console.log(`  + ${l}`);
for (const l of dropped) console.log(`  - ${l}`);
