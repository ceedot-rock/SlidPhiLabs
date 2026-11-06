/**
 * Rider paid call — identity plus x402 proof in one envelope.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * The RiderVerse sample pattern as a stage: the caller presents a Rider
 * identity and an x402 "txHash" proof (txHash plus payerSig binding, the
 * scheme the rider-x402 service verifies on-chain). This module checks the
 * envelope shape pure, then defers truth to injectable adapters —
 * verifyRider for identity, verifyChain for on-chain payment. No adapters
 * means no verification and a refusal: offline-safe, zero network by
 * default. Fail-closed throughout, never a half-paid call.
 */
export const RIDER_PAID_CALL_VERSION = "0.1.0";
export const PAY_SCHEME = "txHash";
export const RAILS = ["base", "solana", "btc"];

function text(v) {
  return v == null ? "" : String(v);
}

function validTxHash(v) {
  return /^0x[0-9a-fA-F]{64}$/.test(text(v));
}

function validPayerSig(v) {
  return /^0x[0-9a-fA-F]{130}$/.test(text(v));
}

function validCents(v) {
  return Number.isSafeInteger(v) && v >= 0;
}

/**
 * Pure structural check of one x402 txHash proof. Returns { ok:true, norm }
 * with the normalized proof, or { ok:false, reason } — never throws.
 */
export function checkPaidProof(proof) {
  if (!proof || typeof proof !== "object" || Array.isArray(proof)) {
    return { ok: false, reason: "bad_proof" };
  }
  if (!validTxHash(proof.txHash)) return { ok: false, reason: "bad_tx" };
  if (!validPayerSig(proof.payerSig)) return { ok: false, reason: "bad_sig" };
  const rail = text(proof.rail || "base").toLowerCase();
  if (!RAILS.includes(rail)) return { ok: false, reason: "bad_rail" };
  const amountCents = proof.amount_cents == null ? 0 : proof.amount_cents;
  if (!validCents(amountCents)) return { ok: false, reason: "bad_amount" };
  return {
    ok: true,
    norm: {
      scheme: PAY_SCHEME,
      txHash: text(proof.txHash),
      payerSig: text(proof.payerSig),
      rail,
      amount_cents: amountCents,
    },
  };
}

/**
 * Verify one paid call: rider identity first, then the chain proof.
 * adapters: { verifyRider(riderId) => {ok,rider_id}, verifyChain(norm) }.
 * Either adapter missing refuses with adapter_required — identity and
 * payment are never assumed.
 */
export async function verifyPaidCall(input = {}, adapters = {}) {
  const o = input && typeof input === "object" ? input : {};
  const riderId = text(o.rider == null ? o.rider_id : o.rider).trim();
  if (!riderId) return { ok: false, reason: "bad_rider" };
  const checked = checkPaidProof(o.payment);
  if (!checked.ok) return checked;
  if (o.min_cents != null) {
    const floor = Math.floor(Number(o.min_cents));
    if (!Number.isSafeInteger(floor) || floor < 0) return { ok: false, reason: "bad_floor" };
    if (checked.norm.amount_cents < floor) {
      return { ok: false, reason: "underpaid", paid_cents: checked.norm.amount_cents, min_cents: floor };
    }
  }
  const a = adapters && typeof adapters === "object" ? adapters : {};
  if (typeof a.verifyRider !== "function" || typeof a.verifyChain !== "function") {
    return { ok: false, reason: "adapter_required" };
  }
  let id;
  try {
    id = await a.verifyRider(riderId);
  } catch {
    return { ok: false, reason: "rider_verify_failed" };
  }
  if (!id || id.ok !== true) {
    return { ok: false, reason: (id && (id.reason || id.error)) || "rider_rejected" };
  }
  let chain;
  try {
    chain = await a.verifyChain(checked.norm);
  } catch {
    return { ok: false, reason: "chain_verify_failed" };
  }
  if (!chain || chain.ok !== true) {
    return { ok: false, reason: (chain && (chain.reason || chain.error)) || "chain_rejected" };
  }
  return {
    ok: true,
    rider_id: String((id && id.rider_id) || riderId),
    tx: checked.norm.txHash,
    rail: checked.norm.rail,
    amount_cents: checked.norm.amount_cents,
  };
}
