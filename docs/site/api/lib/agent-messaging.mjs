/**
 * Agent messaging 0.2.0 — draft/quote/ack negotiation envelopes.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Deterministic, offline: sha256 digests via node:crypto, replay
 * protection via a seen-nonce store (in-memory default, injectable store
 * adapter { has(nonce), add(nonce) }, or a file-backed store via
 * createFileNonceStore / the storePath option so replays stay rejected
 * across restarts). Fail-closed envelopes throughout.
 *
 * AUTHENTICITY NOTE: plain digests are tamper-EVIDENT, not authenticated —
 * anyone who can read an envelope can recompute its digest, so a digest
 * alone proves nothing about who sent it. This module therefore never
 * calls envelopes "signed". For sender authentication pass a `keys`
 * adapter (Map of rider_id -> secret, or { getSecret(rider_id) }); the
 * sender's envelope then carries an HMAC-SHA256 `sig` over the digest,
 * and ack() fails closed with bad_signature (unknown sender: unknown_rider)
 * unless the HMAC verifies. Symmetric HMAC authenticates the sender to
 * holders of the shared secret only — it is not a public-key signature
 * and is not verifiable by third parties.
 */
import { createHash, createHmac } from "node:crypto";
import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const MESSAGING_VERSION = "0.2.0";

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

/** HMAC-SHA256 hex of the envelope digest under the sender's secret. */
export function signDigest(digest, secret) {
  return createHmac("sha256", String(secret)).update(String(digest), "utf8").digest("hex");
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

function defaultFs() {
  return {
    readFile: (p) => readFileSync(p, "utf8"),
    writeFile: (p, s) => writeFileSync(p, s, "utf8"),
    rename: (a, b) => renameSync(a, b),
    mkdir: (d) => mkdirSync(d, { recursive: true }),
  };
}

/**
 * File-backed seen-nonce store: { has(nonce), add(nonce) } persisted as
 * JSON ({ nonces: [...] }) with atomic tmp-file + rename writes, so a
 * restart does not forget replays. opts: { fs } with
 * { readFile, writeFile, rename, mkdir } (default: node:fs sync).
 * Throws on construction only for a missing path; I/O failures inside
 * has()/add() throw so the messenger fails closed with store_failed.
 */
export function createFileNonceStore(filePath, opts = {}) {
  const path = text(filePath);
  if (!path) throw new Error("file-nonce-store: path required");
  const fs = opts && opts.fs ? opts.fs : defaultFs();
  let seen = null; // lazy-loaded Set

  function load() {
    if (seen) return seen;
    seen = new Set();
    let raw;
    try {
      raw = fs.readFile(path);
    } catch (err) {
      if (err && (err.code === "ENOENT" || /no such file/i.test(String(err && err.message)))) {
        return seen;
      }
      throw err;
    }
    let parsed;
    try {
      parsed = JSON.parse(String(raw));
    } catch {
      throw new Error("file-nonce-store: corrupt_entry");
    }
    const list = parsed && Array.isArray(parsed.nonces) ? parsed.nonces : null;
    if (!list) throw new Error("file-nonce-store: corrupt_entry");
    for (const n of list) {
      if (typeof n === "string" && n) seen.add(n);
    }
    return seen;
  }

  function persist() {
    const body = JSON.stringify({ nonces: [...seen].sort() });
    const tmp = `${path}.tmp`;
    try {
      if (typeof fs.mkdir === "function") {
        const dir = dirname(path);
        if (dir && dir !== ".") fs.mkdir(dir);
      }
      fs.writeFile(tmp, body);
      fs.rename(tmp, path);
    } catch (err) {
      throw new Error(`file-nonce-store: write_error: ${String((err && err.message) || err).slice(0, 120)}`);
    }
  }

  return {
    path,
    has(nonce) {
      return load().has(String(nonce));
    },
    add(nonce) {
      const set = load();
      set.add(String(nonce));
      persist();
    },
    size() {
      return load().size;
    },
  };
}

/**
 * Resolve a sender secret from the keys adapter: a Map of
 * rider_id -> secret, or { getSecret(rider_id) }. Returns null when the
 * adapter is absent (digest-only mode) or the rider is unknown.
 */
function secretFor(keys, rider) {
  if (!keys) return null;
  try {
    if (typeof keys.getSecret === "function") {
      const s = keys.getSecret(rider);
      return typeof s === "string" && s.length > 0 ? s : null;
    }
    if (typeof keys.get === "function") {
      const s = keys.get(rider);
      return typeof s === "string" && s.length > 0 ? s : null;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Create an isolated messenger.
 * Adapters: { store, storePath, fs, hashFn, keys }.
 * - store: custom { has, add } nonce store (takes precedence).
 * - storePath (+ optional fs): file-backed nonce store, survives restarts.
 * - keys: Map | { getSecret } of rider_id -> HMAC secret for sender auth.
 * - draft/quote build digest-authenticated envelopes (HMAC `sig` added
 *   when the sender's secret is known; unknown sender with keys configured
 *   fails closed with unknown_rider — no silent downgrade to digest-only).
 * - ack verifies digest (+ sig when keys are configured) then marks the
 *   nonce (replay fails closed).
 */
export function createMessenger({ store: storeAdapter, storePath, fs, hashFn, keys } = {}) {
  const store = storeAdapter
    ? createStore(storeAdapter)
    : storePath
      ? createFileNonceStore(storePath, { fs })
      : createStore(null);
  const hash = typeof hashFn === "function" ? hashFn : undefined;
  const useKeys = !!keys;

  function build(kind, fields) {
    const clean = cleanParties(fields);
    if (!clean) return { ok: false, reason: "bad_envelope" };
    const digest = digestEnvelope(clean, hash);
    if (useKeys) {
      const secret = secretFor(keys, clean.from_rider);
      if (!secret) return { ok: false, reason: "unknown_rider", rider_id: clean.from_rider };
      return { ok: true, envelope: { kind, ...clean, digest, sig: signDigest(digest, secret) } };
    }
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
      if (useKeys) {
        const secret = secretFor(keys, clean.from_rider);
        if (!secret) return { ok: false, reason: "unknown_rider", rider_id: clean.from_rider };
        if (envelope.sig !== signDigest(expect, secret)) {
          return { ok: false, reason: "bad_signature" };
        }
      }
      let seen;
      try {
        seen = store.has(clean.nonce);
      } catch {
        return { ok: false, reason: "store_failed" };
      }
      if (seen) return { ok: false, reason: "replay" };
      try {
        store.add(clean.nonce);
      } catch {
        return { ok: false, reason: "store_failed" };
      }
      const out = { kind: "ack", ...clean, digest: expect };
      if (useKeys) out.sig = signDigest(expect, secretFor(keys, clean.from_rider));
      return { ok: true, envelope: out };
    },
  };
}
