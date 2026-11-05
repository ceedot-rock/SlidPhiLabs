/**
 * Fiat settle 0.1.0 — USD fiat quote adapter bridging to Stripe Checkout.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * quoteFiat({ amount_cents, rail, sku, success_url, cancel_url, ... })
 * builds the Stripe Checkout Session create-params shape
 * ({ mode:"payment", line_items:[{ price_data:{ currency:"usd",
 * unit_amount, product_data:{ name } }, quantity:1 }], client_reference_id,
 * metadata }) and either passes it to the injectable createSession adapter
 * (production wires this to stripe.checkout.sessions.create) or — the
 * offline deterministic default — returns the params as an UNSIGNED
 * instruction ({ requires:"stripe_session" }) with no network call.
 * This module never calls Stripe itself and never holds API keys.
 *
 * Deterministic offline defaults: pure, no disk, no network, no models.
 * Fail-closed envelopes throughout. Only rail "stripe" is supported.
 */

export const FIAT_SETTLE_VERSION = "0.1.0";
export const RAILS = ["stripe"];
export const SKU_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;
export const REF_RE = /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,127}$/;
export const MAX_META_KEYS = 16;
export const MAX_META_LEN = 500;

function fail(error, extra = {}) {
  return { ok: false, error, ...extra };
}

function cleanMeta(meta) {
  if (meta == null) return {};
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const keys = Object.keys(meta);
  if (keys.length > MAX_META_KEYS) return null;
  const out = {};
  for (const k of keys) {
    const v = meta[k];
    if (typeof v !== "string" && typeof v !== "number") return null;
    const s = String(v);
    if (s.length > MAX_META_LEN) return null;
    out[k] = s;
  }
  return out;
}

/**
 * Build Stripe Checkout Session create-params for a USD amount.
 * Adapters: { createSession: async (params) => session, id }.
 * Without createSession the offline default returns the params as an
 * instruction only ({ requires:"stripe_session" }) — no network.
 */
export function quoteFiat(
  {
    amount_cents,
    rail = "stripe",
    sku,
    success_url = null,
    cancel_url = null,
    client_reference_id = null,
    metadata = {},
  } = {},
  adapters = {},
) {
  const cents = Math.floor(Number(amount_cents));
  if (!Number.isSafeInteger(cents) || cents <= 0) return fail("bad_amount");
  if (String(rail) !== "stripe") return fail("bad_rail", { rails: RAILS });
  if (!SKU_RE.test(String(sku || ""))) return fail("bad_sku");
  const meta = cleanMeta(metadata);
  if (meta === null) return fail("bad_metadata");
  const params = {
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: cents,
          product_data: { name: String(sku) },
        },
        quantity: 1,
      },
    ],
    client_reference_id:
      client_reference_id != null ? String(client_reference_id) : `fiat_${String(sku)}_${cents}`,
    metadata: { ...meta, sku: String(sku), rail: "stripe" },
  };
  if (success_url != null) {
    if (!REF_RE.test(String(success_url))) return fail("bad_success_url");
    params.success_url = String(success_url);
  }
  if (cancel_url != null) {
    if (!REF_RE.test(String(cancel_url))) return fail("bad_cancel_url");
    params.cancel_url = String(cancel_url);
  }
  const instruction = {
    rail: "stripe",
    amount_cents: cents,
    currency: "usd",
    sku: String(sku),
    checkout_params: params,
    requires: "stripe_session",
  };
  if (typeof adapters.createSession === "function") {
    let session;
    try {
      session = adapters.createSession(params);
      if (session && typeof session.then === "function") {
        return session.then(
          (s) => {
            if (!s || typeof s !== "object" || !s.id) return fail("bad_session");
            return { ok: true, session: s, instruction };
          },
          (e) => fail("session_failed", { detail: String((e && e.message) || e) }),
        );
      }
    } catch (e) {
      return fail("session_failed", { detail: String((e && e.message) || e) });
    }
    if (!session || typeof session !== "object" || !session.id) return fail("bad_session");
    return { ok: true, session, instruction };
  }
  // Offline default: instruction only, no network, no keys.
  return { ok: true, offline: true, instruction };
}
