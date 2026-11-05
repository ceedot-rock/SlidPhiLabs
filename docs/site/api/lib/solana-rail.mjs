/**
 * Solana USDC rail 0.1.0 — RECEIVE-ONLY rail config plus a fail-closed
 * receipt verifier stub.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * solanaRailConfig() mirrors the solanaConfig() shape in
 * ../../x402-products.js ({ network, payTo, asset, decimals, rpc, enabled })
 * with the same defaults: mainnet USDC mint, X402_PAY_TO receive address,
 * SOLANA_RPC_URL. This module is receive-only: it builds unsigned receive
 * instructions (where buyers send USDC). It never sends, never signs.
 *
 * verifySolanaReceipt() is an intentional stub that ALWAYS fails closed
 * with { ok:false, error:"unimplemented_keystore_locked" }. On-chain
 * receipt verification needs RPC signing material and the operator
 * keystore is password-locked and absent in this environment, so there is
 * no trusted verifier to call — returning "unverified" or attempting a
 * half-check would be worse than refusing. Wire a real verifier via the
 * verifyReceipt adapter (verifySolanaReceipt(..., { verifyReceipt })), or
 * replace the stub once signing material exists. Until then every caller
 * gets an explicit refusal, never a forged pass.
 *
 * Deterministic offline defaults: config is pure env reads, no network.
 * Env source is injectable (pass an object, defaults to process.env) so
 * tests are hermetic. Fail-closed envelopes throughout.
 */

export const RAIL_VERSION = "0.1.0";
export const SOLANA_USDC_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const SOLANA_USDC_DEVNET = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
export const SOLANA_MAINNET = "solana-mainnet-beta";
export const SOLANA_DEVNET_FALLBACK = "https://api.devnet.solana.com";
export const SOLANA_MAINNET_RPC = "https://api.mainnet-beta.solana.com";
export const USDC_DECIMALS = 6;

function str(v) {
  return String(v == null ? "" : v).trim();
}

/**
 * Receive-only Solana USDC rail config. Shape mirrors solanaConfig() in
 * x402-products.js. `env` defaults to process.env; pass a plain object in
 * tests. `enabled` is false until a receive address is configured.
 */
export function solanaRailConfig(env = process.env) {
  const src = env && typeof env === "object" ? env : {};
  const network = str(src.X402_NETWORK) || SOLANA_MAINNET;
  const isMain = /mainnet/i.test(network) || network === "solana";
  // Same receive-address fallbacks as x402-products.js solanaConfig().
  const payTo = str(src.X402_PAY_TO || src.PAY_SOLANA_ADDRESS || src.BLOKZ_SOLANA_ADDRESS);
  const asset = str(src.X402_ASSET) || (isMain ? SOLANA_USDC_MAINNET : SOLANA_USDC_DEVNET);
  const decimals = Number(str(src.X402_TOKEN_DECIMALS) || USDC_DECIMALS) || USDC_DECIMALS;
  const rpc = str(src.SOLANA_RPC_URL) || (isMain ? SOLANA_MAINNET_RPC : SOLANA_DEVNET_FALLBACK);
  return {
    network: isMain ? SOLANA_MAINNET : network,
    payTo,
    asset,
    decimals,
    rpc,
    enabled: payTo.length > 0,
    receive_only: true,
  };
}

/** USDC base units for integer cents (6 decimals): cents * 10^4, exact. */
export function centsToRaw(cents, decimals = USDC_DECIMALS) {
  const n = Math.floor(Number(cents));
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  return (BigInt(n) * 10n ** BigInt(decimals - 2)).toString();
}

/**
 * Build a receive instruction (buyer sends USDC to our payTo). Fail-closed
 * when the rail is not configured (no payTo) or the amount is invalid.
 */
export function buildReceiveInstruction({ amount_cents }, env = process.env) {
  const cfg = solanaRailConfig(env);
  if (!cfg.enabled) return { ok: false, error: "rail_disabled" };
  const raw = centsToRaw(amount_cents, cfg.decimals);
  if (raw === null) return { ok: false, error: "bad_amount" };
  return {
    ok: true,
    instruction: {
      to: cfg.payTo,
      amount: raw,
      amount_cents: Math.floor(Number(amount_cents)),
      asset: cfg.asset,
      chain: cfg.network,
    },
  };
}

/**
 * Verify a Solana payment receipt. STUB: always fails closed until signing
 * material exists (operator keystore is password-locked, so no trusted
 * verifier can run here). Pass { verifyReceipt } to inject a real verifier
 * once material is provisioned; without it, refusal is the correct answer.
 */
export async function verifySolanaReceipt({ tx, expected } = {}, adapters = {}) {
  if (typeof adapters.verifyReceipt === "function") {
    try {
      return await adapters.verifyReceipt({ tx, expected });
    } catch (e) {
      return { ok: false, error: "verifier_failed", detail: String((e && e.message) || e) };
    }
  }
  if (!str(tx)) return { ok: false, error: "bad_tx" };
  return {
    ok: false,
    error: "unimplemented_keystore_locked",
    detail:
      "No Solana verifier is provisioned: the operator keystore is " +
      "password-locked and signing material is absent, so receipts cannot " +
      "be trusted here. Inject { verifyReceipt } once material exists.",
  };
}

/** Sync fail-closed twin for callers that cannot await. Same refusal. */
export function verifySolanaReceiptSync({ tx } = {}, adapters = {}) {
  if (typeof adapters.verifyReceiptSync === "function") {
    try {
      return adapters.verifyReceiptSync({ tx });
    } catch (e) {
      return { ok: false, error: "verifier_failed", detail: String((e && e.message) || e) };
    }
  }
  if (!str(tx)) return { ok: false, error: "bad_tx" };
  return {
    ok: false,
    error: "unimplemented_keystore_locked",
    detail:
      "No Solana verifier is provisioned: the operator keystore is " +
      "password-locked and signing material is absent, so receipts cannot " +
      "be trusted here. Inject { verifyReceiptSync } once material exists.",
  };
}
