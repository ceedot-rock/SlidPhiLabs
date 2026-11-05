import test from "node:test";
import assert from "node:assert/strict";
import { compileChain } from "./compose-warrant.mjs";

const chain2 = [
  { tool: "fetch", args_map: { url: "https://x.example" }, pass: "output", cap_cents: 40 },
  { tool: "compress", args_map: { text: null }, pass: "output", cap_cents: 60 },
];

test("compiles staged params with chained output refs", () => {
  const r = compileChain({ chain: chain2, total_cap_cents: 100 });
  assert.equal(r.ok, true);
  assert.equal(r.stages.length, 2);
  assert.deepEqual(r.stages[0].params, { url: "https://x.example" });
  assert.deepEqual(r.stages[1].params, { text: { from_step: 0, value: "output" } });
  assert.equal(r.stages[1].depends_on, 0);
  assert.equal(r.spent_cap_cents, 100);
});

test("field pass threads one named field", () => {
  const r = compileChain({
    chain: [
      { tool: "fetch", args_map: { url: "u" }, pass: "output", cap_cents: 10 },
      { tool: "compress", args_map: { text: null }, pass: "field", field: "body", cap_cents: 10 },
    ],
    total_cap_cents: 50,
  });
  assert.deepEqual(r.stages[1].params, { text: { from_step: 0, value: "field:body" } });
});

test("over-budget fails closed; bad chain/cap/tool fail closed", () => {
  const over = compileChain({ chain: chain2, total_cap_cents: 99 });
  assert.equal(over.reason, "over_budget");
  assert.equal(over.spent, 100);
  assert.equal(compileChain({ chain: [], total_cap_cents: 10 }).reason, "bad_chain");
  assert.equal(compileChain({ chain: chain2, total_cap_cents: -1 }).reason, "bad_cap");
  assert.equal(
    compileChain({ chain: chain2, total_cap_cents: 100, existsTool: () => false }).reason,
    "unknown_tool"
  );
  assert.equal(
    compileChain({
      chain: [{ tool: "fetch", args_map: { a: 1 }, pass: "field", cap_cents: 1 }],
      total_cap_cents: 10,
    }).reason,
    "bad_chain" // field pass without field name
  );
});
