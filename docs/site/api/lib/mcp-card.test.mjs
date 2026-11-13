/** MCP catalog generation tests (LAB50 step 42). Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SERVER_CARD, TOOLS, COMMERCE } from "../mcp.js";
import { CATALOGS, catalogTools } from "./mcp-catalogs.mjs";

const site = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("published card tools equal live tools/list", () => {
  const card = JSON.parse(readFileSync(join(site, ".well-known", "mcp", "server-card.json"), "utf8"));
  assert.deepEqual(
    card.tools.map((t) => t.name).sort(),
    TOOLS.map((t) => t.name).sort());
});

test("published counts match the live server", () => {
  const html = readFileSync(join(site, "mcp-service.html"), "utf8");
  assert.ok(html.includes(`<strong>${TOOLS.length} tools</strong>`), "tool count");
  assert.ok(html.includes(`<strong>${CATALOGS.length} catalogs</strong>`), "catalog count");
  assert.ok(html.includes(`<strong>${COMMERCE.length} commerce tools</strong>`), "commerce count");
});

test("catalog tools are deterministic across calls", () => {
  const a = catalogTools().map((t) => t.name);
  const b = catalogTools().map((t) => t.name);
  assert.deepEqual(a, b);
  assert.equal(a.length, CATALOGS.length * 2);
});
