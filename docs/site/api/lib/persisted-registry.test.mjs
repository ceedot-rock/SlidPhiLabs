import test from "node:test";
import assert from "node:assert/strict";
import { createPersistedRegistry } from "./persisted-registry.mjs";

function memFs() {
  const files = new Map();
  return {
    files,
    readFile: (p) => {
      if (!files.has(p)) {
        const e = new Error(`ENOENT: ${p}`);
        e.code = "ENOENT";
        throw e;
      }
      return files.get(p);
    },
    appendFile: (p, s) => files.set(p, (files.get(p) ?? "") + String(s)),
    writeFile: (p, s) => files.set(p, String(s)),
    rename: (a, b) => {
      files.set(b, files.get(a));
      files.delete(a);
    },
  };
}

const tool = (over = {}) => ({
  id: "spl_compress",
  version: "1.0.0",
  price_cents: 100,
  endpoint: "https://api.example.com/compress",
  schema: null,
  ...over,
});

test("register appends JSONL and get/list round-trip", () => {
  const fs = memFs();
  const r = createPersistedRegistry({ path: "reg.jsonl", fs });
  assert.equal(r.register(tool()).ok, true);
  assert.equal(r.register(tool({ version: "2.0.0", price_cents: 50 })).ok, true);
  assert.equal(r.get("spl_compress", "1.0.0").tool.price_cents, 100);
  assert.equal(r.get("spl_compress").tool.version, "2.0.0");
  assert.deepEqual(r.list().map((t) => t.version), ["1.0.0", "2.0.0"]);
  assert.equal(fs.files.get("reg.jsonl").split("\n").filter(Boolean).length, 2);
});

test("bad + duplicate + unknown fail closed", () => {
  const r = createPersistedRegistry({ path: "r.jsonl", fs: memFs() });
  assert.equal(r.register({ id: "x" }).ok, false);
  assert.equal(r.register(tool()).ok, true);
  assert.equal(r.register(tool()).reason, "duplicate_tool");
  assert.equal(r.get("nope").reason, "unknown_tool");
  assert.equal(r.get("spl_compress", "9.9.9").reason, "unknown_version");
});

test("load rebuilds index; corrupt entry fails closed", () => {
  const fs = memFs();
  const a = createPersistedRegistry({ path: "r.jsonl", fs });
  a.register(tool());
  const b = createPersistedRegistry({ path: "r.jsonl", fs });
  assert.equal(b.load().loaded, 1);
  assert.equal(b.get("spl_compress", "1.0.0").ok, true);
  fs.files.set("r.jsonl", "not json\n");
  const c = createPersistedRegistry({ path: "r.jsonl", fs });
  assert.equal(c.load().reason, "corrupt_entry");
});

test("compact rewrites atomically via tmp+rename", () => {
  const seen = [];
  const fs = memFs();
  const origRename = fs.rename;
  fs.rename = (a, b) => {
    seen.push([a, b]);
    origRename(a, b);
  };
  const r = createPersistedRegistry({ path: "r.jsonl", fs });
  r.register(tool());
  assert.equal(r.compact().ok, true);
  assert.deepEqual(seen, [["r.jsonl.tmp", "r.jsonl"]]);
});
