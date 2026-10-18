import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LEDGER = join(await mkdtemp(join(tmpdir(), "sales-")), "sales.jsonl");
process.env.SALES_LEDGER_PATH = LEDGER;
const { saleLine, recordSale } = await import("./sales-ledger.mjs");

test("line carries money facts, never email", () => {
  const line = saleLine({ sku: "gc-month", amountCents: 3900, currency: "USD", orderId: "cs_1", rail: "stripe" });
  const d = JSON.parse(line);
  assert.equal(d.sku, "gc-month");
  assert.equal(d.amount_cents, 3900);
  assert.equal(d.currency, "usd");
  assert.equal(d.order_id, "cs_1");
  assert.equal(d.rail, "stripe");
  assert.ok(d.at);
  assert.ok(!("email" in d));
  assert.ok(!line.includes("@"));
});

test("appends one line per sale", async () => {
  const r1 = await recordSale({ sku: "a", amountCents: 100, currency: "usd", orderId: "o1", rail: "stripe" });
  const r2 = await recordSale({ sku: "b", amountCents: 200, currency: "usd", orderId: "o2", rail: "x402" });
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  const lines = (await readFile(LEDGER, "utf8")).trim().split("\n");
  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[1]).order_id, "o2");
});

test("skips without order id", async () => {
  const r = await recordSale({ sku: "a", amountCents: 1, currency: "usd", orderId: "" });
  assert.equal(r.skipped, true);
});
