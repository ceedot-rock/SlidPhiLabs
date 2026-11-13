import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const LEDGER = join(await mkdtemp(join(tmpdir(), "sales-")), "sales.jsonl");
process.env.SALES_LEDGER_PATH = LEDGER;
const { saleLine, recordSale, hasOrderId, auditWebhookIgnored } = await import("./sales-ledger.mjs");

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

test("bad amounts fail closed, nothing appended", async () => {
  const before = await readFile(LEDGER, "utf8");
  for (const amountCents of [0, -5, NaN, Infinity, "nope", undefined]) {
    const r = await recordSale({ sku: "a", amountCents, currency: "usd", orderId: "o-bad", rail: "stripe" });
    assert.equal(r.ok, false);
    assert.equal(r.error, "bad_amount");
  }
  assert.throws(() => saleLine({ sku: "a", amountCents: 0, orderId: "o-bad" }), /bad_amount/);
  assert.throws(() => saleLine({ sku: "a", amountCents: "nope", orderId: "o-bad" }), /bad_amount/);
  assert.equal(await readFile(LEDGER, "utf8"), before);
});

test("skips without order id", async () => {
  const r = await recordSale({ sku: "a", amountCents: 1, currency: "usd", orderId: "" });
  assert.equal(r.skipped, true);
});

test("hasOrderId finds lines and misses absent ones", async () => {
  assert.equal(await hasOrderId("o1"), true);
  assert.equal(await hasOrderId("nope"), false);
});

test("hasOrderId is false on a missing ledger, throws on other I/O errors", async () => {
  process.env.SALES_LEDGER_PATH = join(tmpdir(), "sales-no-such-dir-xyz", "sales.jsonl");
  assert.equal(await hasOrderId("o1"), false);
  const dir = await mkdtemp(join(tmpdir(), "salesdir-"));
  process.env.SALES_LEDGER_PATH = dir;
  await assert.rejects(hasOrderId("o1"), /ledger_unreadable/);
  process.env.SALES_LEDGER_PATH = LEDGER;
});

test("auditWebhookIgnored logs beside the ledger, never in it", async () => {
  const before = await readFile(LEDGER, "utf8");
  const r = await auditWebhookIgnored({ reason: "unhandled_type", event_type: "charge.refunded" });
  assert.equal(r.ok, true);
  assert.equal(await readFile(LEDGER, "utf8"), before);
  const audit = await readFile(join(dirname(LEDGER), "webhook-audit.jsonl"), "utf8");
  const last = JSON.parse(audit.trim().split("\n").pop());
  assert.equal(last.kind, "webhook_ignored");
  assert.equal(last.reason, "unhandled_type");
});
