import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "./acn-schema.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const proto = path.join(here, "..", "..", "acn-protocol");
const load = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const PAIRS = [
  ["run-receipt", "run-receipt"],
  ["warrant", "warrant"],
  ["warrant-receipt-filing", "warrant-receipt-filing"],
  ["catalog-product", "catalog-product"],
  ["payment-required", "payment-required"],
  ["plan-spec", "plan-spec"],
  ["quote-args", "quote-args"],
  ["research-args", "research-args"],
];

test("manifest lists every schema and example on disk", () => {
  const manifest = load(path.join(proto, "index.json"));
  assert.equal(manifest.name, "acn-protocol");
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  for (const [name] of PAIRS) {
    assert.ok(manifest.schemas[name], `manifest missing schema ${name}`);
    assert.ok(fs.existsSync(path.join(proto, manifest.schemas[name])), `missing file for ${name}`);
  }
  assert.ok(fs.existsSync(path.join(proto, "SPEC.md")), "SPEC.md missing");
});

for (const [name] of PAIRS) {
  test(`example validates: ${name}`, () => {
    const schema = load(path.join(proto, "schemas", `${name}.json`));
    const example = load(path.join(proto, "examples", `${name}.json`));
    assert.deepEqual(validate(schema, example), []);
  });
}

test("claim token accepts spl1 triples, rejects junk", () => {
  const schema = load(path.join(proto, "schemas", "claim-token.json"));
  assert.deepEqual(validate(schema, "spl1.eyJ2Ijox.ABCdef123-_"), []);
  assert.ok(validate(schema, "Bearer xyz").length > 0);
  assert.ok(validate(schema, "spl1.onlyone").length > 0);
});

test("error envelope accepts both dialects, rejects ok:true", () => {
  const schema = load(path.join(proto, "schemas", "error.json"));
  assert.deepEqual(validate(schema, { ok: false, error: "nope" }), []);
  assert.deepEqual(validate(schema, { ok: false, reason: "tavily_unset" }), []);
  assert.ok(validate(schema, { ok: true }).length > 0);
  assert.ok(validate(schema, { ok: false }).length > 0);
});

test("negatives fail: anchorless receipt, bad warrant, wild quote", () => {
  const receipt = load(path.join(proto, "schemas", "run-receipt.json"));
  assert.ok(validate(receipt, { stage: "run", ok: true, tool: "x", toolVersion: "1" }).length > 0);
  const warrant = load(path.join(proto, "schemas", "warrant.json"));
  const good = load(path.join(proto, "examples", "warrant.json"));
  assert.ok(validate(warrant, { ...good, actions: ["teleport"] }).length > 0);
  assert.ok(validate(warrant, { ...good, id: "nope" }).length > 0);
  const quote = load(path.join(proto, "schemas", "quote-args.json"));
  assert.ok(validate(quote, { bytes: -5 }).length > 0);
  const research = load(path.join(proto, "schemas", "research-args.json"));
  assert.ok(validate(research, { max_results: 5 }).length > 0);
  assert.ok(validate(research, { query: "x", max_results: 99 }).length > 0);
});
