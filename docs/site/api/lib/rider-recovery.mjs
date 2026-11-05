/**
 * Rider recovery 0.1.0 — rider key rotation with chained receipts.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Deterministic, offline, dependency-free: rotated ids are SHA-256
 * derivations of (prev_rider, rotation_proof); receipt digests are SHA-256
 * over (prev_rider, next_rider), so any tampered link fails verification
 * without needing the original proof. No network, no clock in the id path.
 * Storage is an injectable Map-like store; the default is an in-memory Map.
 * Fail-closed envelopes: { ok:false, reason }.
 */
import { createHash } from "node:crypto";

export const RIDER_RECOVERY_VERSION = "0.1.0";
export const RIDER_ROTATION_PREFIX = "rr_";
/** Maximum links followed by verifyRotation (cycle/depth guard). */
export const MAX_ROTATION_HOPS = 1024;

const _defaultStore = new Map();

function storeOf(adapters) {
  const s = adapters && adapters.store ? adapters.store : _defaultStore;
  return s;
}

export function sha256hex(text) {
  return createHash("sha256").update(String(text ?? ""), "utf8").digest("hex");
}

function isNonEmptyString(x) {
  return typeof x === "string" && x.trim().length > 0;
}

/** Link digest: binds a rotation receipt to its exact prev/next pair. */
export function rotationDigest(prev_rider, next_rider) {
  return sha256hex(`${prev_rider}|${next_rider}`);
}

/** Deterministic child id for one rotation step. */
export function deriveRiderId(prev_rider, rotation_proof) {
  return `${RIDER_ROTATION_PREFIX}${sha256hex(`${prev_rider}|${rotation_proof}`).slice(0, 24)}`;
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
 * Rotate a rider key. The rotation_proof authorizes the move (e.g. a
 * signature by the previous key); it shapes the new id but is never stored.
 * Repeating the same rotation is idempotent: the stored receipt is returned.
 * Adapters (all optional): { store: Map-like { get, set, has } }.
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
  const next = deriveRiderId(prev, root.rotation_proof);
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
