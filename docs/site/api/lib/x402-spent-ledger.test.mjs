import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "x402-spent-"));
process.env.AUTH_DIR = dir;

const {
  normalizeTxKey,
  consumePaymentTx,
  lookupSpent,
  alreadyUsedResponse,
} = await import("./x402-spent-ledger.mjs");

const BASE_TX = "0xB8527e49F30cB0664FdE217A0014c48A1f0b729d1de95fe880a9b686ec10b763";
const BASE_TX_LC = BASE_TX.toLowerCase();
const SOL_SIG =
  "9BfcKRFqJJLkqyjbTuFhkuYmmVRqarrwovJXY4YUegJQsM1z84iEUhn61czT2NJfZf4Y29S6zsCEtUDN4u6HYYV";

test("normalize: EVM lowercases; Solana preserves", () => {
  assert.equal(normalizeTxKey(BASE_TX), BASE_TX_LC);
  assert.equal(normalizeTxKey(SOL_SIG), SOL_SIG);
  assert.equal(normalizeTxKey("dev-bypass"), "dev-bypass");
  assert.equal(normalizeTxKey(""), "");
  assert.equal(
    normalizeTxKey("eip155:8453:" + BASE_TX),
    "eip155:8453:" + BASE_TX_LC,
  );
});

test("first consume wins; second is already_used", () => {
  const a = consumePaymentTx(BASE_TX, {
    endpoint: "x402-products",
    ref: "ORDER-1",
    sku: "rider-month",
    network: "eip155:8453",
  });
  assert.equal(a.ok, true);
  assert.equal(a.first, true);
  assert.equal(a.record.tx, BASE_TX_LC);

  const hit = lookupSpent(BASE_TX);
  assert.ok(hit);
  assert.equal(hit.endpoint, "x402-products");
  assert.equal(hit.tx, BASE_TX_LC);

  const b = consumePaymentTx(BASE_TX_LC, {
    endpoint: "x402-suite",
    ref: "JOB-2",
  });
  assert.equal(b.ok, false);
  assert.equal(b.reason, "already_used");
  assert.equal(b.prior.ref, "ORDER-1");
});

test("cross-endpoint: products then suite blocked (Solana)", () => {
  const a = consumePaymentTx(SOL_SIG, {
    endpoint: "x402-products",
    ref: "ORDER-SOL",
    network: "solana-mainnet-beta",
  });
  assert.equal(a.ok, true);

  const b = consumePaymentTx(SOL_SIG, {
    endpoint: "x402-suite",
    ref: "JOB-SOL",
  });
  assert.equal(b.ok, false);
  assert.equal(b.reason, "already_used");
  assert.equal(b.prior.endpoint, "x402-products");
});

test("dev-bypass skipped (not ledgered)", () => {
  const a = consumePaymentTx("dev-bypass", { endpoint: "x402-products" });
  assert.equal(a.ok, true);
  assert.equal(a.skipped, true);
  const b = consumePaymentTx("dev-bypass", { endpoint: "x402-suite" });
  assert.equal(b.ok, true);
  assert.equal(b.skipped, true);
});

test("alreadyUsedResponse shape", () => {
  const body = alreadyUsedResponse({
    endpoint: "x402-products",
    at: "2026-09-27T00:00:00.000Z",
    ref: "X402-1",
  });
  assert.equal(body.reason, "already_used");
  assert.equal(body.prior.ref, "X402-1");
});

test("empty / missing signature skipped", () => {
  assert.equal(consumePaymentTx(null).skipped, true);
  assert.equal(consumePaymentTx("").skipped, true);
});
