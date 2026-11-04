import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-"));
process.env.WARRANT_DIR = dir;
process.env.WARRANT_SECRET = "test-agentic-secret-32bytes-min!!";

const {
  planAgenticRun,
  runAgenticRun,
  verifyConductorReceipt,
  dispatchAgentic,
  CROSSINGS,
  TOLLHOUSE_TOOLS,
} = await import("./agentic-platform.mjs");

test("toll tables match the booklets", () => {
  assert.equal(CROSSINGS.length, 7);
  assert.equal(TOLLHOUSE_TOOLS.length, 10);
  assert.ok(TOLLHOUSE_TOOLS.includes("awlpay-quote"));
});

test("plan is pure and shows eight stages", () => {
  const p = planAgenticRun({ demo: true, action: "fetch", host: "www.slidphilabs.com", url: "https://example.com/a" });
  assert.equal(p.ok, true);
  assert.deepEqual(p.plan.stages, ["rider", "warrant", "tollkeeper", "quikgater", "pcc", "awlpay", "psi", "conductor"]);
  assert.equal(p.plan.settle.rail, "none");
  assert.match(p.plan.conductor.digest, /^[a-f0-9]{64}$/);
});

test("plan rejects missing identity, bad action, bad crossing", () => {
  assert.equal(planAgenticRun({ action: "invoke", host: "h.test" }).reason, "missing_identity");
  assert.equal(planAgenticRun({ demo: true, action: "hack", host: "h.test" }).reason, "action_not_allowed");
  assert.equal(planAgenticRun({ demo: true, action: "invoke", host: "h.test", crossing: "nope" }).reason, "unknown_crossing");
  assert.equal(planAgenticRun({ demo: true, action: "fetch", host: "h.test", url: "ftp://x" }).reason, "bad_url");
});

test("unpaid fetch answers 402 with receipts so far", async () => {
  const r = await runAgenticRun({ demo: true, action: "fetch", host: "www.slidphilabs.com", url: "https://example.com/a" });
  assert.equal(r.ok, false);
  assert.equal(r.stage, "quikgater");
  assert.equal(r.status, 402);
  assert.ok(r.receipts.some((s) => s.stage === "tollkeeper" && s.ok));
});

test("paid fetch plus settle plus memory complete offline", async () => {
  const mem = [];
  let captured = null;
  const fetch402 = async (url, { paid }) =>
    paid ? { status: 200, body: "hello page" } : { status: 402, price: { cents: 3 } };
  const r = await runAgenticRun(
    { demo: true, action: "fetch", host: "www.slidphilabs.com", url: "https://example.com/a", pay: true },
    { fetch402, memorize: (e) => mem.push(e), settleFn: async (i) => { captured = i; return { captured: true }; } },
  );
  assert.equal(r.ok, true);
  assert.equal(mem.length, 1);
  assert.match(mem[0].d, /^\d{4}-\d{2}-\d{2}$/);
  const stages = r.receipts.map((s) => s.stage);
  for (const s of ["rider", "warrant", "tollkeeper", "quikgater", "pcc", "awlpay", "psi", "conductor", "warrant-receipt"]) {
    assert.ok(stages.includes(s), "missing " + s);
  }
  assert.equal(captured, null);
});

test("big metered run stops at awlpay 402 unless captured", async () => {
  const unpaid = await runAgenticRun({ demo: true, action: "compress", host: "h.test", bytes: 3 * 1024 * 1024 * 1024 });
  assert.equal(unpaid.ok, false);
  assert.equal(unpaid.stage, "awlpay");
  assert.equal(unpaid.status, 402);
  assert.equal(unpaid.instruction.rail, "x402");
  let captured = null;
  const paid = await runAgenticRun(
    { demo: true, action: "compress", host: "h.test", bytes: 3 * 1024 * 1024 * 1024 },
    { settleFn: async (i) => { captured = i; return { captured: true }; } },
  );
  assert.equal(paid.ok, true);
  assert.equal(captured.rail, "x402");
  assert.equal(captured.platform_fee_cents, Math.round(captured.amount_cents * 0.005));
});

test("conductor receipt verifies over run inputs", () => {
  const p = planAgenticRun({ demo: true, action: "invoke", host: "h.test", bytes: 10 });
  const good = verifyConductorReceipt({ action: "invoke", host: "h.test", bytes: 10, amount_cents: 0 }, p.plan.conductor);
  assert.equal(good.valid, true);
  const bad = verifyConductorReceipt({ action: "invoke", host: "evil.test", bytes: 10, amount_cents: 0 }, p.plan.conductor);
  assert.equal(bad.valid, false);
});

test("dispatch needs confirm and rejects unknown tools", async () => {
  const need = await dispatchAgentic("spl_agentic_run", { demo: true });
  assert.equal(need.needs, "confirm");
  await assert.rejects(() => dispatchAgentic("spl_nope", {}), /Unknown agentic tool/);
});

test("platform is ACN and acp rail is selectable", async () => {
  const { PLATFORM_NAME, PLATFORM_FULL_NAME, settlePreview } = await import("./agentic-platform.mjs");
  assert.equal(PLATFORM_NAME, "ACN");
  assert.equal(PLATFORM_FULL_NAME, "Agent Commerce Network");
  const auto = settlePreview(200, {});
  assert.equal(auto.rail, "x402");
  const stripe = settlePreview(200, { rail: "stripe", sku: "rider-crew" });
  assert.equal(stripe.rail, "stripe");
  assert.equal(stripe.capture, "card");
  assert.equal(stripe.amount_cents, 200);
  const acp = settlePreview(200, { rail: "acp", sku: "rider-crew" });
  assert.equal(acp.rail, "acp");
  assert.equal(acp.checkout, "checkout_sessions");
  assert.equal(acp.merchant_of_record, "merchant");
  const plan = planAgenticRun({ demo: true, action: "invoke", host: "h.test", bytes: 3 * 1024 * 1024 * 1024, rail: "acp" });
  assert.equal(plan.platform, "ACN");
  assert.equal(plan.plan.settle.rail, "acp");
  let captured = null;
  const run = await runAgenticRun(
    { demo: true, action: "invoke", host: "h.test", bytes: 3 * 1024 * 1024 * 1024, rail: "acp" },
    { settleFn: async (i) => { captured = i; return { captured: true }; } },
  );
  assert.equal(run.ok, true);
  assert.equal(run.platform, "ACN");
  assert.equal(captured.rail, "acp");
});
