/**
 * Agent messaging 0.1.0 — draft/quote/ack negotiation envelopes.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Deterministic, offline: sha256 digests via node:crypto, replay
 * protection via a seen-nonce set (in-memory default, injectable store
 * adapter { has(nonce), add(nonce) }). Fail-closed envelopes throughout.
 */
import { createHash } from "node:crypto";

export const MESSAGING_VERSION = "0.1.0";

function text(v) {
  return v == null ? "" : String(v).trim();
}

function cleanOffer(offer) {
  if (!offer || typeof offer !== "object") return null;
  const sku = text(offer.sku);
  const amount_cents = Number(offer.amount_cents);
  if (!sku || !Number.isSafeInteger(amount_cents) || amount_cents < 0) return null;
  return { sku, amount_cents };
}

/** Canonical digest over { from_rider, to_rider, offer, nonce }. */
export function digestEnvelope({ from_rider, to_rider, offer, nonce }, hashFn) {
  const body = JSON.stringify({
    from_rider: text(from_rider),
    to_rider: text(to_rider),
    offer: cleanOffer(offer),
    nonce: text(nonce),
  });
  if (typeof hashFn === "function") return hashFn(body);
  return createHash("sha256").update(body).digest("hex");
}

function cleanParties({ from_rider, to_rider, offer, nonce }) {
  const from = text(from_rider);
  const to = text(to_rider);
  const n = text(nonce);
  const o = cleanOffer(offer);
  if (!from || !to || !n || !o) return null;
  return { from_rider: from, to_rider: to, offer: o, nonce: n };
}

function createStore(adapter) {
  if (adapter && typeof adapter.has === "function" && typeof adapter.add === "function") {
    return adapter;
  }
  const seen = new Set();
  return { has: (n) => seen.has(n), add: (n) => void seen.add(n) };
}

/**
 * Create an isolated messenger. Adapters: { store, hashFn }.
 * - draft/quote build signed envelopes (no replay marking).
 * - ack verifies digest + marks nonce (replay fails closed).
 */
export function createMessenger({ store: storeAdapter, hashFn } = {}) {
  const store = createStore(storeAdapter);
  const hash = typeof hashFn === "function" ? hashFn : undefined;

  function build(kind, fields) {
    const clean = cleanParties(fields);
    if (!clean) return { ok: false, reason: "bad_envelope" };
    const digest = digestEnvelope(clean, hash);
    return { ok: true, envelope: { kind, ...clean, digest } };
  }

  return {
    draft(fields) {
      return build("draft", fields);
    },
    quote(fields) {
      return build("quote", fields);
    },
    ack(envelope) {
      if (!envelope || typeof envelope !== "object") return { ok: false, reason: "bad_envelope" };
      const clean = cleanParties(envelope);
      if (!clean) return { ok: false, reason: "bad_envelope" };
      const expect = digestEnvelope(clean, hash);
      if (envelope.digest !== expect) return { ok: false, reason: "bad_digest" };
      if (store.has(clean.nonce)) return { ok: false, reason: "replay" };
      store.add(clean.nonce);
      return { ok: true, envelope: { kind: "ack", ...clean, digest: expect } };
    },
  };
}
