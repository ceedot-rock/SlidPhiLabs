import test from "node:test";
import assert from "node:assert/strict";
import { quoteFiat } from "./fiat-settle.mjs";

test("offline default returns instruction only (no network)", () => {
  const r = quoteFiat({ amount_cents: 999, rail: "stripe", sku: "pro-month" }, {});
  assert.equal(r.ok, true);
  assert.equal(r.offline, true);
  assert.equal(r.instruction.requires, "stripe_session");
  assert.equal(r.instruction.amount_cents, 999);
  assert.equal(r.instruction.currency, "usd");
  assert.equal(r.session, undefined);
});

test("checkout params match the Stripe session shape", () => {
  const r = quoteFiat(
    { amount_cents: 2500, sku: "lab-pro", success_url: "https://x.example/success", cancel_url: "https://x.example/cancel", metadata: { rider: "r1" } },
    {},
  );
  const p = r.instruction.checkout_params;
  assert.equal(p.mode, "payment");
  assert.equal(p.line_items.length, 1);
  assert.equal(p.line_items[0].price_data.currency, "usd");
  assert.equal(p.line_items[0].price_data.unit_amount, 2500);
  assert.equal(p.line_items[0].price_data.product_data.name, "lab-pro");
  assert.equal(p.line_items[0].quantity, 1);
  assert.equal(p.success_url, "https://x.example/success");
  assert.equal(p.metadata.sku, "lab-pro");
  assert.equal(p.metadata.rider, "r1");
});

test("createSession adapter bridges to a live session (sync + async)", async () => {
  const sync = quoteFiat({ amount_cents: 100, sku: "s" }, { createSession: (params) => ({ id: "cs_sync", url: "https://pay/s", params }) });
  assert.equal(sync.ok, true);
  assert.equal(sync.session.id, "cs_sync");
  assert.equal(sync.instruction.checkout_params.mode, "payment");
  const asyncR = await quoteFiat({ amount_cents: 100, sku: "s" }, { createSession: async (params) => ({ id: "cs_async", params }) });
  assert.equal(asyncR.ok, true);
  assert.equal(asyncR.session.id, "cs_async");
  const bad = quoteFiat({ amount_cents: 100, sku: "s" }, { createSession: () => ({ no_id: true }) });
  assert.equal(bad.error, "bad_session");
  const boom = quoteFiat({ amount_cents: 100, sku: "s" }, { createSession: () => { throw new Error("stripe down"); } });
  assert.equal(boom.error, "session_failed");
});

test("quote fails closed on bad input", () => {
  assert.equal(quoteFiat({ amount_cents: 0, sku: "s" }, {}).error, "bad_amount");
  assert.equal(quoteFiat({ amount_cents: -3, sku: "s" }, {}).error, "bad_amount");
  assert.equal(quoteFiat({ amount_cents: 100, rail: "solana", sku: "s" }, {}).error, "bad_rail");
  assert.equal(quoteFiat({ amount_cents: 100, sku: "" }, {}).error, "bad_sku");
  assert.equal(quoteFiat({ amount_cents: 100, sku: "s", metadata: ["x"] }, {}).error, "bad_metadata");
  assert.equal(quoteFiat({ amount_cents: 100, sku: "s", success_url: "not a url !!" }, {}).error, "bad_success_url");
});
