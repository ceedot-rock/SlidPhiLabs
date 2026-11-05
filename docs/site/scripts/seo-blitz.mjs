#!/usr/bin/env node
// DOCS BLITZ 2026-11-05: JSON-LD on every page + OG tags on cuni-*.html +
// honest status.html badges. Re-runnable: skips files that already comply.
// Run: node scripts/seo-blitz.mjs  (from docs/site/)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url))) + path.sep;
const SITE = "https://www.slidphilabs.com";
const OG_IMG = SITE + "/assets/now/og.jpg";

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const grab = (html, re) => (html.match(re) || [])[1] || "";
let jsonldAdded = [], ogAdded = [];

for (const file of walk(ROOT)) {
  const raw = fs.readFileSync(file, "utf8");
  const EOL = raw.includes("\r\n") ? "\r\n" : "\n";
  const rel = "/" + path.relative(ROOT, file).replace(/\\/g, "/");
  let html = raw, changed = false;

  const title = grab(html, /<title>([^<]*)<\/title>/i).trim() || rel;
  const desc = grab(html, /<meta\s+name="description"\s+content="([^"]*)"/i).trim() || title;
  const canon = grab(html, /<link\s+rel="canonical"\s+href="([^"]*)"/i).trim()
    || SITE + rel.replace(/(^|\/)index\.html$/, "$1").replace(/\.html$/, "");

  // (5a) JSON-LD on every page missing it
  if (!html.includes("application/ld+json") && html.includes("</head>")) {
    const data = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: title,
      description: desc,
      url: canon,
      isPartOf: { "@type": "WebSite", name: "Slid Phi Labs", url: SITE + "/" },
      inLanguage: "en",
    };
    const tag = `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
    html = html.replace("</head>", tag + EOL + "</head>");
    changed = true;
    jsonldAdded.push(rel);
  }

  // (5b) OG + twitter tags on cuni-*.html missing them
  if (path.basename(file).startsWith("cuni-") && !html.includes("og:title")) {
    const tags = [
      `<meta property="og:type" content="article"/>`,
      `<meta property="og:site_name" content="Slid Phi Labs"/>`,
      `<meta property="og:title" content="${esc(title)}"/>`,
      `<meta property="og:description" content="${esc(desc)}"/>`,
      `<meta property="og:url" content="${esc(canon)}"/>`,
      `<meta property="og:image" content="${OG_IMG}"/>`,
      `<meta name="twitter:card" content="summary_large_image"/>`,
      `<meta name="twitter:title" content="${esc(title)}"/>`,
      `<meta name="twitter:description" content="${esc(desc)}"/>`,
      `<meta name="twitter:image" content="${OG_IMG}"/>`,
    ].join(EOL + "  ");
    const anchor = /<link\s+rel="canonical"[^>]*>/i;
    html = anchor.test(html)
      ? html.replace(anchor, (m) => m + EOL + "  " + tags)
      : html.replace("</head>", "  " + tags + EOL + "</head>");
    changed = true;
    ogAdded.push(rel);
  }

  if (changed) fs.writeFileSync(file, html);
}

// (6) status.html: PCC + TRUSTREAM badges say Operational while grids show
// 1-of-6 up and last check 2026-09-27. Scope: the two dishonest badges + note.
const stFile = path.join(ROOT, "status.html");
let st = fs.readFileSync(stFile, "utf8");
let badgeFix = 0;
for (const name of ["PCC", "TRUSTREAM"]) {
  const i = st.indexOf(`<span class="svc-name">${name}</span>`);
  const j = st.indexOf(`<span class="badge ok">Operational</span>`, i);
  if (i >= 0 && j >= 0 && j - i < 500) {
    st = st.slice(0, j) + `<span class="badge down">Outage — 1 of last 6 monitored days up</span>` + st.slice(j + `<span class="badge ok">Operational</span>`.length);
    badgeFix++;
  }
}
const staleNote = " Badges reflect the latest monitored days shown below; the most recent check in this file is 2026-09-27 — treat rows as stale until the monitor runs again.";
if (!st.includes("treat rows as stale")) {
  st = st.replace("that is honest, not missing.</div>", "that is honest, not missing." + staleNote + "</div>");
}
fs.writeFileSync(stFile, st);

console.log(JSON.stringify({ jsonldAdded: jsonldAdded.length, ogAdded: ogAdded.length, badgeFix, jsonldFiles: jsonldAdded, ogFiles: ogAdded }, null, 1));
