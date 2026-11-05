/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * Tests for lib/stripe-webhook-verify.mjs — deterministic vectors, no network.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  parseStripeSignatureHeader,
  verifyStripeSignature,
  extractStripeSale,
} from "./stripe-webhook-verify.mjs";

const SECRET = "whsec_test_vector_secret";
const RAW = Buffer.from(JSON.stringify({ id: "evt_123", type: "checkout.session.completed" }), "utf8");
const T = 1793805607;

function sign(t, raw) {
  return createHmac("sha256", SECRET).update(Buffer.concat([Buffer.from(`${t}.`), Buffer.from(raw)])).digest("hex");
}

test("parses t + multiple v1 entries, rejects garbage", () => {
  const p = parseStripeSignatureHeader(`t=${T},v1=${"a".repeat(64)},v1=${"b".repeat(64)}`);
  assert.equal(p.t, T);
  assert.deepEqual(p.v1, ["a".repeat(64), "b".repeat(64)]);
  assert.equal(parseStripeSignatureHeader(""), null);
  assert.equal(parseStripeSignatureHeader("t=abc,v1=zzz"), null);
  assert.equal(parseStripeSignatureHeader(null), null);
});

test("accepts a valid signature", () => {
  const h = `t=${T},v1=${sign(T, RAW)}`;
  const r = verifyStripeSignature(RAW, h, SECRET, { nowSec: T + 10 });
  assert.deepEqual(r, { ok: true, t: T });
});

test("accepts when a later v1 entry matches (key rotation)", () => {
  const h = `t=${T},v1=${"0".repeat(64)},v1=${sign(T, RAW)}`;
  const r = verifyStripeSignature(RAW, h, SECRET, { nowSec: T });
  assert.equal(r.ok, true);
});

test("rejects wrong secret, tampered body, stale timestamp", () => {
  const good = `t=${T},v1=${sign(T, RAW)}`;
  assert.equal(verifyStripeSignature(RAW, good, "whsec_wrong", { nowSec: T }).reason, "bad_signature");
  assert.equal(
    verifyStripeSignature(Buffer.from("tampered"), good, SECRET, { nowSec: T }).reason,
    "bad_signature"
  );
  assert.equal(verifyStripeSignature(RAW, good, SECRET, { nowSec: T + 301 }).reason, "stale_timestamp");
  assert.equal(verifyStripeSignature(RAW, "garbage", SECRET, { nowSec: T }).reason, "bad_header");
  assert.equal(verifyStripeSignature(RAW, good, "", { nowSec: T }).reason, "missing_secret");
});

test("extracts a paid checkout.session.completed", () => {
  const out = extractStripeSale({
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_123",
        payment_status: "paid",
        amount_total: 2000,
        currency: "usd",
        metadata: { sku: "chamber-month" },
      },
    },
  });
  assert.deepEqual(out.sale, {
    sku: "chamber-month",
    amountCents: 2000,
    currency: "usd",
    orderId: "cs_test_123",
    rail: "stripe",
  });
});

test("ignores unpaid sessions, other types, bad events", () => {
  const unpaid = extractStripeSale({
    type: "checkout.session.completed",
    data: { object: { id: "cs_x", payment_status: "unpaid", amount_total: 1 } },
  });
  assert.equal(unpaid.ignored, true);
  assert.equal(extractStripeSale({ type: "charge.refunded", data: {} }).ignored, true);
  assert.equal(extractStripeSale(null).ignored, true);
});

test("falls back to client_reference_id when metadata sku is absent", () => {
  const out = extractStripeSale({
    type: "checkout.session.completed",
    data: { object: { id: "cs_y", amount_total: 100, client_reference_id: "pcc-pro" } },
  });
  assert.equal(out.sale.sku, "pcc-pro");
});
