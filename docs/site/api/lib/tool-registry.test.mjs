import test from "node:test";
import assert from "node:assert/strict";
import { createToolRegistry } from "./tool-registry.mjs";

const tool = (over = {}) => ({
  id: "spl_compress",
  version: "1.0.0",
  price_cents: 100,
  endpoint: "https://api.example.com/compress",
  schema: { type: "object" },
  ...over,
});

test("register + version-pinned get", () => {
  const r = createToolRegistry();
  assert.equal(r.register(tool()).ok, true);
  assert.equal(r.register(tool({ version: "2.0.0", price_cents: 50 })).ok, true);
  assert.equal(r.get("spl_compress", "1.0.0").tool.price_cents, 100);
  assert.equal(r.get("spl_compress", "2.0.0").tool.price_cents, 50);
});

test("unknown tool and version fail closed", () => {
  const r = createToolRegistry();
  r.register(tool());
  assert.equal(r.get("nope", "1.0.0").ok, false);
  assert.equal(r.get("nope", "1.0.0").reason, "unknown_tool");
  assert.equal(r.get("spl_compress", "9.9.9").ok, false);
  assert.equal(r.get("spl_compress", "9.9.9").reason, "unknown_version");
});

test("bad + duplicate register rejected", () => {
  const r = createToolRegistry();
  assert.equal(r.register({ id: "x" }).ok, false);
  assert.equal(r.register(tool({ price_cents: -1 })).ok, false);
  assert.equal(r.register(tool()).ok, true);
  assert.equal(r.register(tool()).reason, "duplicate_tool");
});

test("list returns copies sorted by id", () => {
  const r = createToolRegistry();
  r.register(tool({ id: "b-tool" }));
  r.register(tool({ id: "a-tool" }));
  const list = r.list();
  assert.deepEqual(list.map((t) => t.id), ["a-tool", "b-tool"]);
  list[0].id = "mut";
  assert.equal(r.get("a-tool").tool.id, "a-tool");
});
