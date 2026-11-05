/**
 * Solana verify 0.1.0 — Solana USDC receipt verification via injectable RPC.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * verifyReceipt({ signature, expected: { amount_cents, mint, destination } },
 * { getTransaction }) fetches the transaction through the injectable
 * getTransaction adapter (production wires this to an RPC
 * getTransaction call) and checks amount (USDC base units: raw cents via
 * cents * 10^4 at 6 decimals), mint, and destination. The adapter may
 * return either a normalized shape { transfers:[{ mint, destination,
 * amount_raw }] } or a raw Solana getTransaction JSON envelope (parsed
 * via meta.postTokenBalances + transaction.message.accountKeys).
 *
 * FAIL-CLOSED DEFAULT: with no getTransaction adapter injected this
 * module refuses with { ok:false, error:"keystore_locked" } — on-chain
 * verification needs RPC trust material and the operator keystore is
 * password-locked (needs keystore password), so there is no trusted
 * source to check against. Returning "unverified" or attempting a
 * half-check would be worse than refusing. Until the keystore is
 * unlocked and an adapter is wired, every caller gets an explicit
 * refusal, never a forged pass.
 *
 * Deterministic offline defaults: no network, no models. Fail-closed
 * envelopes throughout; adapter failures map to "verifier_failed".
 */

export const SOLANA_VERIFY_VERSION = "0.1.0";
export const USDC_DECIMALS = 6;
export const SOLANA_USDC_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const SIG_RE = /^[1-9A-HJ-NP-Za-km-z]{32,128}$/;
export const ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function fail(error, extra = {}) {
  return { ok: false, error, ...extra };
}

function str(v) {
  return String(v == null ? "" : v).trim();
}

/** USDC base units for integer cents (6 decimals): cents * 10^4, exact. */
export function centsToRaw(cents, decimals = USDC_DECIMALS) {
  const n = Math.floor(Number(cents));
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  if (!Number.isSafeInteger(decimals) || decimals < 2 || decimals > 18) return null;
  return (BigInt(n) * 10n ** BigInt(decimals - 2)).toString();
}

function checkExpected(expected) {
  if (!expected || typeof expected !== "object") return fail("bad_expected");
  const raw = centsToRaw(expected.amount_cents, expected.decimals ?? USDC_DECIMALS);
  if (raw === null) return fail("bad_expected_amount");
  if (!MINT_RE.test(str(expected.mint))) return fail("bad_expected_mint");
  if (!ADDR_RE.test(str(expected.destination))) return fail("bad_expected_destination");
  return { ok: true, raw, mint: str(expected.mint), destination: str(expected.destination) };
}

/**
 * Pull { mint, destination, amount_raw } transfers out of a transaction
 * object. Supports the normalized { transfers } shape first, then the
 * raw Solana getTransaction JSON envelope (postTokenBalances mapped
 * through accountKeys; only balance INCREASES count as receives).
 */
export function extractTransfers(tx) {
  if (!tx || typeof tx !== "object") return [];
  if (Array.isArray(tx.transfers)) {
    return tx.transfers
      .filter((t) => t && typeof t === "object")
      .map((t) => ({
        mint: str(t.mint),
        destination: str(t.destination),
        amount_raw: str(t.amount_raw != null ? t.amount_raw : t.raw),
      }))
      .filter((t) => t.mint && t.destination && t.amount_raw);
  }
  try {
    const meta = tx.meta || {};
    const msg = (tx.transaction && tx.transaction.message) || {};
    const keys = (msg.accountKeys || []).map((k) => (typeof k === "string" ? k : str(k && k.pubkey)));
    const pre = new Map();
    for (const b of meta.preTokenBalances || []) {
      if (b && Number.isInteger(b.accountIndex)) {
        pre.set(b.accountIndex, str(b.uiTokenAmount && b.uiTokenAmount.amount));
      }
    }
    const out = [];
    for (const b of meta.postTokenBalances || []) {
      if (!b || !Number.isInteger(b.accountIndex)) continue;
      const post = str(b.uiTokenAmount && b.uiTokenAmount.amount);
      const before = pre.get(b.accountIndex) || "0";
      let delta = null;
      try {
        delta = BigInt(post || "0") - BigInt(before || "0");
      } catch {
        continue;
      }
      if (delta !== null && delta > 0n) {
        out.push({
          mint: str(b.mint),
          destination: str(keys[b.accountIndex] || b.owner || ""),
          amount_raw: delta.toString(),
        });
      }
    }
    return out.filter((t) => t.mint && t.destination && t.amount_raw);
  } catch {
    return [];
  }
}

/**
 * Verify a Solana receipt. Without a getTransaction adapter this ALWAYS
 * fails closed with keystore_locked (needs keystore password).
 * Adapters: { getTransaction: (signature) => tx | Promise<tx> }.
 */
export async function verifyReceipt({ signature, expected } = {}, adapters = {}) {
  const sig = str(signature);
  if (!SIG_RE.test(sig)) return fail("bad_signature");
  const want = checkExpected(expected);
  if (!want.ok) return want;
  if (typeof adapters.getTransaction !== "function") {
    return {
      ok: false,
      error: "keystore_locked",
      detail:
        "No Solana RPC adapter is provisioned: the operator keystore is " +
        "password-locked (needs keystore password) and signing material is " +
        "absent, so receipts cannot be trusted here. Inject " +
        "{ getTransaction } once the keystore is unlocked.",
    };
  }
  let tx;
  try {
    tx = await adapters.getTransaction(sig);
  } catch (e) {
    return fail("verifier_failed", { detail: String((e && e.message) || e) });
  }
  if (!tx || typeof tx !== "object") return fail("tx_not_found", { signature: sig });
  if (tx.err != null && tx.err !== undefined) return fail("tx_failed", { signature: sig });
  const transfers = extractTransfers(tx);
  if (transfers.length === 0) return fail("no_transfers", { signature: sig });
  const mintHit = transfers.filter((t) => t.mint === want.mint);
  if (mintHit.length === 0) return fail("mint_mismatch", { expected: want.mint });
  const destHit = mintHit.filter((t) => t.destination === want.destination);
  if (destHit.length === 0) return fail("destination_mismatch", { expected: want.destination });
  const exact = destHit.find((t) => t.amount_raw === want.raw);
  if (!exact) {
    return fail("amount_mismatch", {
      expected_raw: want.raw,
      observed_raw: destHit.map((t) => t.amount_raw),
    });
  }
  return {
    ok: true,
    signature: sig,
    receipt: {
      mint: want.mint,
      destination: want.destination,
      amount_raw: want.raw,
      amount_cents: Math.floor(Number(expected.amount_cents)),
    },
  };
}

/** Sync fail-closed twin for callers that cannot await. Same refusal. */
export function verifyReceiptSync({ signature, expected } = {}, adapters = {}) {
  const sig = str(signature);
  if (!SIG_RE.test(sig)) return fail("bad_signature");
  const want = checkExpected(expected);
  if (!want.ok) return want;
  if (typeof adapters.getTransactionSync !== "function") {
    return {
      ok: false,
      error: "keystore_locked",
      detail:
        "No Solana RPC adapter is provisioned: the operator keystore is " +
        "password-locked (needs keystore password) and signing material is " +
        "absent, so receipts cannot be trusted here. Inject " +
        "{ getTransactionSync } once the keystore is unlocked.",
    };
  }
  let tx;
  try {
    tx = adapters.getTransactionSync(sig);
  } catch (e) {
    return fail("verifier_failed", { detail: String((e && e.message) || e) });
  }
  if (!tx || typeof tx !== "object") return fail("tx_not_found", { signature: sig });
  const transfers = extractTransfers(tx);
  const exact = transfers.find(
    (t) => t.mint === want.mint && t.destination === want.destination && t.amount_raw === want.raw,
  );
  if (!exact) return fail("amount_mismatch", { expected_raw: want.raw });
  return { ok: true, signature: sig, receipt: { ...exact, amount_cents: Math.floor(Number(expected.amount_cents)) } };
}
