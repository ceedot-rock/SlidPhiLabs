import test from "node:test";
import assert from "node:assert/strict";
import { createMcpCatalog } from "./mcp-catalog.mjs";

const tool = (over = {}) => ({
  name: "pcc_compress",
  version: "1.0.0",
  endpoint: "https://api.example.com/mcp",
  price_cents: 25,
  protocol: "streamable-http",
  auth: "api-key",
  ...over,
});

test("register + version-pinned get", () => {
  const c = createMcpCatalog({ clock: () => "2026-01-01T00:00:00.000Z" });
  assert.equal(c.register(tool()).ok, true);
  assert.equal(c.register(tool({ version: "2.0.0", price_cents: 20 })).ok, true);
  const hit = c.get("pcc_compress", "1.0.0");
  assert.equal(hit.ok, true);
  assert.equal(hit.tool.price_cents, 25);
  assert.equal(hit.tool.protocol, "streamable-http");
  assert.equal(hit.tool.registered_at, "2026-01-01T00:00:00.000Z");
});

test("unpinned lookup fails closed with version_required", () => {
  const c = createMcpCatalog();
  c.register(tool());
  assert.deepEqual(c.get("pcc_compress"), { ok: false, reason: "version_required" });
  assert.equal(c.get("pcc_compress", "").reason, "version_required");
});

test("unknown name and version fail closed", () => {
  const c = createMcpCatalog();
  c.register(tool());
  assert.equal(c.get("nope", "1.0.0").reason, "unknown_tool");
  assert.equal(c.get("pcc_compress", "9.9.9").reason, "unknown_version");
  assert.equal(c.get("", "1.0.0").reason, "unknown_tool");
});

test("bad transport fields rejected", () => {
  const c = createMcpCatalog();
  assert.equal(c.register(tool({ protocol: "websocket" })).reason, "bad_tool");
  assert.equal(c.register(tool({ protocol: undefined })).reason, "bad_tool");
  assert.equal(c.register(tool({ auth: "" })).reason, "bad_tool");
  assert.equal(c.register(tool({ price_cents: -1 })).reason, "bad_tool");
  assert.equal(c.register(tool({ name: "" })).reason, "bad_tool");
  assert.equal(c.register(tool({ protocol: "stdio", auth: "none" })).ok, true);
});

test("duplicate register rejected; list returns sorted copies", () => {
  const c = createMcpCatalog();
  assert.equal(c.register(tool()).ok, true);
  assert.equal(c.register(tool()).reason, "duplicate_tool");
  c.register(tool({ name: "a-tool" }));
  const list = c.list();
  assert.deepEqual(list.map((t) => t.name), ["a-tool", "pcc_compress"]);
  list[0].name = "mut";
  assert.equal(c.get("a-tool", "1.0.0").tool.name, "a-tool");
});

test("file-backed option persists across catalogs via injectable fs", () => {
  let file = null;
  const fs = {
    readFile: (p) => {
      if (file === null || p !== "mcp.jsonl") {
        const err = new Error(`ENOENT: ${p}`);
        err.code = "ENOENT";
        throw err;
      }
      return file;
    },
    appendFile: (p, s) => {
      file = (file || "") + String(s);
    },
  };
  const a = createMcpCatalog({ path: "mcp.jsonl", fs });
  assert.equal(a.register(tool()).ok, true);
  const b = createMcpCatalog({ path: "mcp.jsonl", fs });
  assert.equal(b.get("pcc_compress", "1.0.0").ok, true);
  assert.equal(b.register(tool()).reason, "duplicate_tool"); // reloaded, not re-registered
  const broken = createMcpCatalog({
    path: "mcp.jsonl",
    fs: { readFile: () => { throw new Error("EACCES"); }, appendFile: () => {} },
  });
  assert.equal(broken.register(tool()).reason, "read_error");
});

test("seed adapter pre-registers offline", () => {
  const c = createMcpCatalog({ seed: [tool({ name: "seeded" })] });
  assert.equal(c.get("seeded", "1.0.0").ok, true);
  assert.equal(c.get("seeded", "2.0.0").reason, "unknown_version");
});
