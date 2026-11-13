/** Regenerate the published MCP catalog from the live server (LAB50 step 42).
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Single source: api/mcp.js (COMMERCE + catalogTools + SERVER_CARD).
 * Outputs: .well-known/mcp/server-card.json (full tool list) and the counts
 * line in mcp-service.html. Run: node docs/site/scripts/mcp-card.mjs
 * Fails loudly when tools/list and the card disagree.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SERVER_CARD, TOOLS, COMMERCE } from "../api/mcp.js";
import { CATALOGS } from "../api/lib/mcp-catalogs.mjs";

const site = join(dirname(fileURLToPath(import.meta.url)), "..");

const cardNames = SERVER_CARD.tools.map((t) => t.name).sort();
const liveNames = TOOLS.map((t) => t.name).sort();
const missing = liveNames.filter((n) => !cardNames.includes(n));
const extra = cardNames.filter((n) => !liveNames.includes(n));
if (missing.length || extra.length) {
  console.error(`tools/list vs card mismatch. missing=${missing.join(",")} extra=${extra.join(",")}`);
  process.exit(1);
}

writeFileSync(join(site, ".well-known", "mcp", "server-card.json"),
  JSON.stringify(SERVER_CARD, null, 2) + "\n");

const countsLine =
  `<p><strong>${TOOLS.length} tools</strong> · ` +
  `<strong>${CATALOGS.length} catalogs</strong> · ` +
  `<strong>${COMMERCE.length} commerce tools</strong> · ` +
  `<strong>0 steps to start</strong></p>`;
const page = join(site, "mcp-service.html");
const html = readFileSync(page, "utf8");
const next = html.replace(
  /<p><strong>\d+ tools<\/strong> · <strong>\d+ catalogs<\/strong> · <strong>\d+ commerce tools<\/strong> · <strong>0 steps to start<\/strong><\/p>/,
  countsLine);
if (next === html) {
  console.error("counts line not found in mcp-service.html");
  process.exit(1);
}
writeFileSync(page, next);
console.log(`mcp card OK: ${TOOLS.length} tools, ${CATALOGS.length} catalogs, ${COMMERCE.length} commerce`);
