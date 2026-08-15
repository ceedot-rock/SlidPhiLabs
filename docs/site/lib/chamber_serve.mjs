/**
 * Called-site vault. Chamber holds it. Open once. RAM serves it.
 */
import fs from "fs";
import path from "path";
import { cloak, open } from "./chamber_box.mjs";

/** First-paint + chrome that the browser actually asks for. */
export const CALLED = Object.freeze([
  "assets/tru8/site.css",
  "assets/site-header.css",
  "assets/tru8/chat.css",
  "assets/logos/logo-slid-phi-labs.jpg",
  "assets/logos/logo-slid-phi-labs.mp4",
  "assets/dynamic-meta.js",
  "assets/tru8/chat.js",
  "assets/tru8/site.js",
  "assets/site-header.js",
  "metadata.json",
]);

const hot = new Map();

export function bootBox(root) {
  let n = 0;
  let bytes = 0;
  for (const rel of CALLED) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) continue;
    const raw = fs.readFileSync(file);
    const opened = open(cloak(raw));
    hot.set(file, opened);
    n += 1;
    bytes += opened.length;
  }
  return { n, bytes };
}

export function fromBox(filePath) {
  return hot.get(filePath) || null;
}
