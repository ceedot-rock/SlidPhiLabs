/**
 * Rider recovery 0.2.0 — rider key rotation with chained receipts.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Deterministic, offline, dependency-free: rotated ids are SHA-256
 * derivations of (prev_rider, proof nonce); receipt digests are SHA-256
 * over (prev_rider, next_rider), so any tampered link fails verification
 * without needing the original proof. No network, no clock in the id path.
 *
 * Rotation proofs are HMAC-SHA256 bound, not bare strings: a valid proof
 * has the form `<nonce>.<mac>` where mac = HMAC(secret_for_prev,
 * "<prev_rider>|<next_rider>") and next_rider = deriveRiderId(prev, nonce).
 * Anyone can read the ids, but only the holder of the per-rider secret can
 * mint a proof the server accepts. Bare throwaway strings (e.g. "proof-1")
 * fail closed with bad_proof.
 *
 * Secrets live in an injectable Map-like registry ({ get, set }) passed as
 * adapters.secrets. The module default is a process-local in-memory Map
 * that AUTO-SEEDS each rider's secret from a PUBLIC derivation
 * (sha256("rider-secret-v1|<rider_id>")) on first use: convenient for
 * single-process dev/tests, NOT a real secret — any reader of this source
 * can recompute it. Production deployments MUST inject per-rider secrets
 * (e.g. from a KMS/HSM-backed store); with an injected registry, a rider
 * with no stored secret fails closed with unknown_rider instead of
 * being seeded. Use seedRiderSecret() to provision, and
 * createRotationProof() to mint proofs.
 *
 * Storage is an injectable Map-like store; the default is an in-memory Map.
 * Fail-closed envelopes: { ok:false, reason }.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const RIDER_RECOVERY_VERSION = "0.2.0";
export const RIDER_ROTATION_PREFIX = "rr_";
/** Maximum links followed by verifyRotation (cycle/depth guard). */
export const MAX_ROTATION_HOPS = 1024;

const _defaultStore = new Map();
const _defaultSecrets = new Map();

function storeOf(adapters) {
  const s = adapters && adapters.store ? adapters.store : _defaultStore;
  return s;
}

function secretsOf(adapters) {
  const s = adapters && adapters.secrets ? adapters.secrets : _defaultSecrets;
  return s;
}

export function sha256hex(text) {
  return createHash("sha256").update(String(text ?? ""), "utf8").digest("hex");
}

export function hmacHex(secret, text) {
  return createHmac("sha256", String(secret)).update(String(text ?? ""), "utf8").digest("hex");
}

function isNonEmptyString(x) {
  return typeof x === "string" && x.trim().length > 0;
}

function safeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  try {
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

/** Link digest: binds a rotation receipt to its exact prev/next pair. */
export function rotationDigest(prev_rider, next_rider) {
  return sha256hex(`${prev_rider}|${next_rider}`);
}

/** Deterministic child id for one rotation step (input: the proof nonce). */
export function deriveRiderId(prev_rider, proof_nonce) {
  return `${RIDER_ROTATION_PREFIX}${sha256hex(`${prev_rider}|${proof_nonce}`).slice(0, 24)}`;
}

/** The HMAC message bound by a rotation proof for (prev, next). */
export function rotationProofMessage(prev_rider, next_rider) {
  return `${prev_rider}|${next_rider}`;
}

/**
 * Resolve the secret for a rider. Default registry auto-seeds from a
 * public derivation (see header: dev/test convenience only). An
 * explicitly injected secrets registry never auto-seeds: unknown riders
 * return null so the caller fails closed with unknown_rider.
 */
function secretFor(prev, adapters) {
  const reg = secretsOf(adapters);
  const injected = !!(adapters && adapters.secrets);
  try {
    const cur = reg.get(prev);
    if (typeof cur === "string" && cur.length > 0) return cur;
  } catch {
    return null;
  }
  if (!injected) {
    const gen = sha256hex(`rider-secret-v1|${prev}`);
    try {
      reg.set(prev, gen);
    } catch {
      return null;
    }
    return gen;
  }
  return null;
}

/**
 * Provision a rider secret in the secrets registry.
 * Adapters: { secrets: Map-like { get, set } } (default: module registry).
 * With no secret argument a random 32-byte hex secret is generated.
 */
export function seedRiderSecret(rider_id, adapters = {}, secret) {
  if (!isNonEmptyString(rider_id)) {
    return { ok: false, reason: "missing_rider_id" };
  }
  const prev = rider_id.trim();
  const value =
    typeof secret === "string" && secret.length > 0 ? secret : randomBytes(32).toString("hex");
  const reg = secretsOf(adapters);
  try {
    reg.set(prev, value);
  } catch (e) {
    return { ok: false, reason: "store_failed", detail: String((e && e.message) || e).slice(0, 200) };
  }
  return { ok: true, rider_id: prev };
}

/**
 * Mint a rotation proof for prev_rider: `<nonce>.<mac>` with
 * mac = HMAC(secret_for_prev, "<prev>|<next>"), next = derive(prev, nonce).
 * Adapters: { secrets } (see header). opts: { nonce } — defaults to 16
 * random hex bytes; pass an explicit nonce in tests for determinism.
 */
export function createRotationProof(input = {}, adapters = {}, opts = {}) {
  const root = input && typeof input === "object" ? input : {};
  const riderIn = root.rider_id;
  if (!isNonEmptyString(riderIn)) {
    return { ok: false, reason: "missing_rider_id" };
  }
  const prev = riderIn.trim();
  const secret = secretFor(prev, adapters);
  if (!secret) {
    return { ok: false, reason: "unknown_rider", rider_id: prev };
  }
  const nonce =
    opts && typeof opts.nonce === "string" && opts.nonce.trim().length > 0
      ? opts.nonce.trim()
      : randomBytes(8).toString("hex");
  if (nonce.includes(".")) {
    return { ok: false, reason: "bad_nonce", detail: "nonce must not contain '.'" };
  }
  const next = deriveRiderId(prev, nonce);
  const mac = hmacHex(secret, rotationProofMessage(prev, next));
  return { ok: true, proof: `${nonce}.${mac}`, nonce, next_rider: next, rider_id: prev };
}

function splitProof(proof) {
  const s = String(proof);
  const dot = s.lastIndexOf(".");
  if (dot <= 0 || dot === s.length - 1) return null;
  const nonce = s.slice(0, dot);
  const mac = s.slice(dot + 1);
  if (!nonce || !mac) return null;
  if (!/^[0-9a-fA-F]{64}$/.test(mac)) return null;
  return { nonce, mac: mac.toLowerCase() };
}

function riderIdOf(input) {
  if (typeof input === "string") return input;
  if (input && typeof input === "object") {
    if (isNonEmptyString(input.rider_id)) return input.rider_id;
    if (input.receipt && isNonEmptyString(input.receipt.next_rider)) return input.receipt.next_rider;
  }
  return null;
}

/**
 * Rotate a rider key. The rotation_proof must be a `<nonce>.<mac>` HMAC
 * proof minted for prev_rider (see createRotationProof); the proof shapes
 * the new id but is never stored. Repeating the same rotation is
 * idempotent: the stored receipt is returned.
 * Adapters (all optional): { store: Map-like { get, set, has },
 *   secrets: Map-like { get, set } }.
 */
export function rotateRiderKey(input = {}, adapters = {}) {
  const root = input && typeof input === "object" ? input : {};
  if (!isNonEmptyString(root.rider_id)) {
    return { ok: false, reason: "missing_rider_id" };
  }
  if (!isNonEmptyString(root.rotation_proof)) {
    return { ok: false, reason: "missing_rotation_proof" };
  }
  const prev = root.rider_id.trim();
  const secret = secretFor(prev, adapters);
  if (!secret) {
    return { ok: false, reason: "unknown_rider", rider_id: prev };
  }
  const parts = splitProof(root.rotation_proof.trim());
  if (!parts) {
    return { ok: false, reason: "bad_proof", detail: "proof must be <nonce>.<64-hex-mac>" };
  }
  const next = deriveRiderId(prev, parts.nonce);
  const expect = hmacHex(secret, rotationProofMessage(prev, next));
  if (!safeEqualHex(parts.mac, expect)) {
    return { ok: false, reason: "bad_proof" };
  }
  const receipt = Object.freeze({
    prev_rider: prev,
    next_rider: next,
    digest: rotationDigest(prev, next),
  });
  const store = storeOf(adapters);
  try {
    const existing = store.get(next);
    if (existing) {
      if (existing.prev_rider !== prev || existing.digest !== receipt.digest) {
        return { ok: false, reason: "rotation_collision", rider_id: next };
      }
      return { ok: true, receipt: existing };
    }
    store.set(next, receipt);
  } catch (e) {
    return { ok: false, reason: "store_failed", detail: String((e && e.message) || e).slice(0, 200) };
  }
  return { ok: true, receipt };
}

/**
 * Verify a rotated rider id by chain-walking receipts back to the genesis
 * (pre-rotation) rider. Every link's digest is recomputed; any tampered,
 * cycled, or over-long chain fails closed.
 */
export function verifyRotation(input, adapters = {}) {
  const id = riderIdOf(input);
  if (!id) return { ok: false, reason: "missing_rider_id" };
  const store = storeOf(adapters);
  let first;
  try {
    first = store.get(id);
  } catch (e) {
    return { ok: false, reason: "store_failed", detail: String((e && e.message) || e).slice(0, 200) };
  }
  if (!first) return { ok: false, reason: "unknown_rider", rider_id: id };
  const chain = [id];
  const seen = new Set([id]);
  let cur = id;
  for (let hops = 0; hops < MAX_ROTATION_HOPS; hops++) {
    let rec;
    try {
      rec = store.get(cur);
    } catch (e) {
      return { ok: false, reason: "store_failed", detail: String((e && e.message) || e).slice(0, 200) };
    }
    if (!rec) break; // unreachable on hop 0 (checked above); guards races.
    if (rec.next_rider !== cur || !isNonEmptyString(rec.prev_rider)) {
      return { ok: false, reason: "broken_chain", rider_id: cur };
    }
    if (rec.digest !== rotationDigest(rec.prev_rider, rec.next_rider)) {
      return { ok: false, reason: "digest_mismatch", rider_id: cur };
    }
    if (seen.has(rec.prev_rider)) {
      return { ok: false, reason: "rotation_cycle", rider_id: rec.prev_rider };
    }
    seen.add(rec.prev_rider);
    chain.unshift(rec.prev_rider);
    cur = rec.prev_rider;
    let parent;
    try {
      parent = store.get(cur);
    } catch (e) {
      return { ok: false, reason: "store_failed", detail: String((e && e.message) || e).slice(0, 200) };
    }
    if (!parent) break; // cur is the genesis (pre-rotation) rider.
  }
  if (chain.length > MAX_ROTATION_HOPS) {
    return { ok: false, reason: "chain_too_long", rider_id: id };
  }
  return { ok: true, rider_id: id, root: cur, chain, rotations: chain.length - 1 };
}
