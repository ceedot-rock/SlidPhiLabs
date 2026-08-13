#!/usr/bin/env node
/**
 * Fail if any docs/site HTML page lacks full SEO meta pack.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const REQUIRED = [
  ["charset", /charset\s*=/i],
  ["viewport", /name=["']viewport["']/i],
  ["title", /<title>[^<]+<\/title>/i],
  ["description", /name=["']description["']/i],
  ["og:title", /property=["']og:title["']/i],
  ["og:description", /property=["']og:description["']/i],
  ["og:image", /property=["']og:image["']/i],
  ["twitter:card", /name=["']twitter:card["']/i],
  ["canonical", /rel=["']canonical["']/i],
];

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".git" || ent.name === "assets" || ent.name === "archive") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith(".html")) out.push(p);
  }
  return out;
}

let fails = 0;
for (const file of walk(ROOT)) {
  const text = fs.readFileSync(file, "utf8");
  if (!/<html/i.test(text) && !/<!doctype/i.test(text)) continue;
  // skip tiny asset samples
  if (file.includes(`${path.sep}assets${path.sep}`)) continue;
  const miss = REQUIRED.filter(([, rx]) => !rx.test(text)).map(([n]) => n);
  const rel = path.relative(ROOT, file);
  if (miss.length) {
    fails++;
    console.log(`FAIL ${rel}: missing ${miss.join(", ")}`);
  } else {
    console.log(`OK   ${rel}`);
  }
}

if (fails) {
  console.error(`\nseo-audit: ${fails} page(s) incomplete.`);
  process.exit(1);
}
console.log("\nseo-audit: all site HTML pages have full SEO meta.");
