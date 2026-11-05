import test from "node:test";
import assert from "node:assert/strict";
import { CATALOGS, searchCatalog, getCatalog, catalogTools, dispatchCatalog } from "./mcp-catalogs.mjs";

test("happy: searchCatalog full list and filtered hits", () => {
  const all = searchCatalog("sku", "");
  assert.equal(all.catalog, "sku");
  assert.equal(all.q, null);
  assert.equal(all.n, all.hits.length);
  assert.ok(all.n > 0);
  const hits = searchCatalog("sku", "CuNi");
  assert.ok(hits.n >= 1);
  for (const h of hits.hits) {
    assert.ok([h.id, h.name, h.note, h.price, h.url].filter(Boolean).join(" ").toLowerCase().includes("cuni"));
    assert.ok(h.id && h.name);
  }
});

test("happy: getCatalog returns one entry with notes, price, links", () => {
  const e = getCatalog("rail", "x402");
  assert.equal(e.catalog, "rail");
  assert.equal(e.id, "x402");
  assert.ok(e.note);
  assert.ok(e.url);
});

test("error: unknown catalog and unknown entry envelopes", () => {
  assert.deepEqual(searchCatalog("nope", "x"), { error: "unknown catalog", id: "nope" });
  assert.deepEqual(getCatalog("nope", "x"), { error: "unknown catalog", id: "nope" });
  const r = getCatalog("sku", "nope");
  assert.equal(r.error, "unknown entry");
  assert.equal(r.catalog, "sku");
  assert.ok(Array.isArray(r.known) && r.known.length > 0);
});

test("happy: catalogTools exposes search+get per catalog plus pcc aliases", () => {
  const tools = catalogTools();
  assert.equal(tools.length, CATALOGS.length * 2 + 2);
  const names = tools.map((t) => t.name);
  for (const c of CATALOGS) {
    assert.ok(names.includes(`${c.id}_search`), `missing ${c.id}_search`);
    assert.ok(names.includes(`${c.id}_get`), `missing ${c.id}_get`);
  }
  assert.ok(names.includes("pcc_search"));
  assert.ok(names.includes("pcc_get"));
  for (const t of tools) assert.equal(t.inputSchema.type, "object");
});

test("happy: dispatchCatalog routes search/get and pcc alias", () => {
  const s = dispatchCatalog("sku_search", { q: "rider" });
  assert.equal(s.catalog, "sku");
  assert.ok(s.n >= 1);
  const g = dispatchCatalog("rail_get", { id: "stripe" });
  assert.equal(g.id, "stripe");
  const alias = dispatchCatalog("pcc_search", { q: "meter" });
  assert.equal(alias.catalog, "aware");
  const aliasGet = dispatchCatalog("pcc_get", { id: "meter" });
  assert.equal(aliasGet.catalog, "aware");
  assert.equal(aliasGet.id, "meter");
});

test("error: dispatchCatalog unknown tool returns null", () => {
  assert.equal(dispatchCatalog("nope_action", {}), null);
  assert.equal(dispatchCatalog("plain", {}), null);
});
