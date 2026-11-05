import test from "node:test";
import assert from "node:assert/strict";
import {
  solanaRailConfig,
  buildReceiveInstruction,
  verifySolanaReceipt,
  verifySolanaReceiptSync,
  requestKeystoreUnlock,
  keystoreEnv,
  SOLANA_USDC_MAINNET,
  SOLANA_USDC_DEVNET,
  SOLANA_MAINNET,
} from "./solana-rail.mjs";

const PAY_TO = "BxTestPayToAddress111111111111111111111111111";

test("defaults mirror x402-products solanaConfig shape", () => {
  const cfg = solanaRailConfig({});
  assert.deepEqual(
    Object.keys(cfg).sort(),
    ["asset", "decimals", "enabled", "network", "payTo", "receive_only", "rpc"].sort(),
  );
  assert.equal(cfg.network, SOLANA_MAINNET);
  assert.equal(cfg.asset, SOLANA_USDC_MAINNET);
  assert.equal(cfg.decimals, 6);
  assert.equal(cfg.rpc, "https://api.mainnet-beta.solana.com");
  assert.equal(cfg.payTo, "");
  assert.equal(cfg.enabled, false);
  assert.equal(cfg.receive_only, true);
});

test("payTo via X402_PAY_TO enables the rail", () => {
  const cfg = solanaRailConfig({ X402_PAY_TO: PAY_TO });
  assert.equal(cfg.payTo, PAY_TO);
  assert.equal(cfg.enabled, true);
});

test("devnet network swaps mint and rpc defaults", () => {
  const cfg = solanaRailConfig({ X402_NETWORK: "solana-devnet", X402_PAY_TO: PAY_TO });
  assert.equal(cfg.asset, SOLANA_USDC_DEVNET);
  assert.equal(cfg.rpc, "https://api.devnet.solana.com");
  assert.equal(cfg.network, "solana-devnet");
});

test("env overrides for asset, decimals, rpc", () => {
  const cfg = solanaRailConfig({
    X402_PAY_TO: PAY_TO,
    X402_ASSET: "CustomMint11111111111111111111111111111111",
    X402_TOKEN_DECIMALS: "9",
    SOLANA_RPC_URL: "https://example.invalid/rpc",
  });
  assert.equal(cfg.asset, "CustomMint11111111111111111111111111111111");
  assert.equal(cfg.decimals, 9);
  assert.equal(cfg.rpc, "https://example.invalid/rpc");
});

test("receive instruction fails closed when rail disabled", () => {
  const r = buildReceiveInstruction({ amount_cents: 100 }, {});
  assert.equal(r.ok, false);
  assert.equal(r.error, "rail_disabled");
});

test("receive instruction points at payTo in raw units", () => {
  const r = buildReceiveInstruction({ amount_cents: 100 }, { X402_PAY_TO: PAY_TO });
  assert.equal(r.ok, true);
  assert.deepEqual(r.instruction, {
    to: PAY_TO,
    amount: "1000000",
    amount_cents: 100,
    asset: SOLANA_USDC_MAINNET,
    chain: SOLANA_MAINNET,
  });
  assert.equal(buildReceiveInstruction({ amount_cents: 0 }, { X402_PAY_TO: PAY_TO }).error, "bad_amount");
  assert.equal(buildReceiveInstruction({}, { X402_PAY_TO: PAY_TO }).error, "bad_amount");
});

test("verifier stub fails closed until signing material exists", async () => {
  const r = await verifySolanaReceipt({ tx: "deadbeef" });
  assert.equal(r.ok, false);
  assert.equal(r.error, "unimplemented_keystore_locked");
  assert.match(r.detail, /password-locked/);
  const bad = await verifySolanaReceipt({ tx: "" });
  assert.equal(bad.error, "bad_tx");
  const sync = verifySolanaReceiptSync({ tx: "deadbeef" });
  assert.equal(sync.error, "unimplemented_keystore_locked");
});

test("keystore unlock fails closed without password or adapter", async () => {
  assert.equal((await requestKeystoreUnlock({})).error, "keystore_password_required");
  assert.equal((await requestKeystoreUnlock({ password: "" })).error, "keystore_password_required");
  assert.equal((await requestKeystoreUnlock()).error, "keystore_password_required");
  const locked = await requestKeystoreUnlock({ password: "s3cret" });
  assert.equal(locked.ok, false);
  assert.equal(locked.error, "unimplemented_keystore_locked");
});

test("keystore unlock honors the injected unlock adapter, never leaks the password", async () => {
  let seen = null;
  const r = await requestKeystoreUnlock(
    { password: "s3cret" },
    { unlock: async (input) => { seen = input; return { handle: "h" }; } },
    { SOLANA_KEYSTORE_PATH: "/run/keys/solana.json" },
  );
  assert.equal(r.ok, true);
  assert.equal(r.unlocked, true);
  assert.equal(r.password, undefined);
  assert.equal(seen.password, "s3cret");
  assert.equal(seen.keystore.path, "/run/keys/solana.json");
  const bad = await requestKeystoreUnlock({ password: "x" }, { unlock: async () => null });
  assert.equal(bad.error, "bad_unlock_material");
  const boom = await requestKeystoreUnlock({ password: "x" }, { unlock: async () => { throw new Error("hsm down"); } });
  assert.equal(boom.error, "unlock_failed");
});

test("keystoreEnv reports presence without reading the secret", () => {
  assert.deepEqual(keystoreEnv({}), { path: "", has_password: false });
  assert.deepEqual(
    keystoreEnv({ SOLANA_KEYSTORE_PATH: "/k.json", SOLANA_KEYSTORE_PASSWORD: "pw" }),
    { path: "/k.json", has_password: true },
  );
});

test("injected verifier adapter is honored once provisioned", async () => {
  const r = await verifySolanaReceipt(
    { tx: "abc" },
    { verifyReceipt: async ({ tx }) => ({ ok: true, tx }) },
  );
  assert.equal(r.ok, true);
  assert.equal(r.tx, "abc");
  const sync = verifySolanaReceiptSync({ tx: "abc" }, { verifyReceiptSync: () => ({ ok: true }) });
  assert.equal(sync.ok, true);
});
