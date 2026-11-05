import test from "node:test";
import assert from "node:assert/strict";
import { verifyReceipt, verifyReceiptSync, extractTransfers, centsToRaw, SOLANA_USDC_MAINNET } from "./solana-verify.mjs";

const SIG = "5".repeat(88); // valid base58, correct length class
const DEST = "9".repeat(44);
const OTHER = "8".repeat(44);
// 999c at 6 decimals = 999 * 10^4 raw.
const RAW_999 = "9990000";

function expected(over = {}) {
  return { amount_cents: 999, mint: SOLANA_USDC_MAINNET, destination: DEST, ...over };
}

test("no adapter fails closed with keystore_locked", async () => {
  const r = await verifyReceipt({ signature: SIG, expected: expected() }, {});
  assert.equal(r.ok, false);
  assert.equal(r.error, "keystore_locked");
  assert.match(r.detail, /keystore password/);
  const s = verifyReceiptSync({ signature: SIG, expected: expected() }, {});
  assert.equal(s.error, "keystore_locked");
});

test("bad signature and bad expected fail closed", async () => {
  assert.equal((await verifyReceipt({ signature: "!!!", expected: expected() }, {})).error, "bad_signature");
  assert.equal((await verifyReceipt({ signature: SIG, expected: null }, {})).error, "bad_expected");
  assert.equal((await verifyReceipt({ signature: SIG, expected: expected({ amount_cents: 0 }) }, {})).error, "bad_expected_amount");
  assert.equal((await verifyReceipt({ signature: SIG, expected: expected({ mint: "zzz" }) }, {})).error, "bad_expected_mint");
  assert.equal((await verifyReceipt({ signature: SIG, expected: expected({ destination: "" }) }, {})).error, "bad_expected_destination");
  assert.equal(centsToRaw(999), RAW_999);
});

test("normalized-transfers adapter verifies amount/mint/destination", async () => {
  const rpc = { getTransaction: async (sig) => ({ transfers: [{ mint: SOLANA_USDC_MAINNET, destination: DEST, amount_raw: RAW_999 }] }) };
  const r = await verifyReceipt({ signature: SIG, expected: expected() }, rpc);
  assert.equal(r.ok, true);
  assert.equal(r.receipt.amount_raw, RAW_999);
  assert.equal(r.receipt.amount_cents, 999);
  const seen = [];
  const rpcSeen = { getTransaction: async (sig) => { seen.push(sig); return { transfers: [{ mint: SOLANA_USDC_MAINNET, destination: DEST, amount_raw: RAW_999 }] }; } };
  await verifyReceipt({ signature: SIG, expected: expected() }, rpcSeen);
  assert.deepEqual(seen, [SIG]);
});

test("mismatches fail closed with specific errors", async () => {
  const tx = { transfers: [{ mint: SOLANA_USDC_MAINNET, destination: DEST, amount_raw: RAW_999 }] };
  const rpc = { getTransaction: async () => tx };
  assert.equal((await verifyReceipt({ signature: SIG, expected: expected({ amount_cents: 1000 }) }, rpc)).error, "amount_mismatch");
  assert.equal((await verifyReceipt({ signature: SIG, expected: expected({ destination: OTHER }) }, rpc)).error, "destination_mismatch");
  assert.equal((await verifyReceipt({ signature: SIG, expected: expected({ mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" }) }, rpc)).error, "mint_mismatch");
  assert.equal((await verifyReceipt({ signature: SIG, expected: expected() }, { getTransaction: async () => null })).error, "tx_not_found");
  assert.equal((await verifyReceipt({ signature: SIG, expected: expected() }, { getTransaction: async () => ({ transfers: [] }) })).error, "no_transfers");
  assert.equal((await verifyReceipt({ signature: SIG, expected: expected() }, { getTransaction: async () => { throw new Error("rpc down"); } })).error, "verifier_failed");
});

test("raw getTransaction envelope parses balance increases", async () => {
  const envelope = {
    err: null,
    transaction: { message: { accountKeys: [OTHER, DEST] } },
    meta: {
      preTokenBalances: [{ accountIndex: 1, mint: SOLANA_USDC_MAINNET, uiTokenAmount: { amount: "0" } }],
      postTokenBalances: [{ accountIndex: 1, mint: SOLANA_USDC_MAINNET, owner: DEST, uiTokenAmount: { amount: RAW_999 } }],
    },
  };
  assert.equal(extractTransfers(envelope)[0].destination, DEST);
  const r = await verifyReceipt({ signature: SIG, expected: expected() }, { getTransaction: async () => envelope });
  assert.equal(r.ok, true);
});

test("sync twin verifies with sync adapter", () => {
  const r = verifyReceiptSync(
    { signature: SIG, expected: expected() },
    { getTransactionSync: () => ({ transfers: [{ mint: SOLANA_USDC_MAINNET, destination: DEST, amount_raw: RAW_999 }] }) },
  );
  assert.equal(r.ok, true);
  assert.equal(r.receipt.amount_raw, RAW_999);
});
