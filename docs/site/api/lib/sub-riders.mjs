/**
 * Sub-riders 0.1.0 — deterministically derived child riders with scoped caps.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Deterministic, offline, dependency-free: a child id is a SHA-256
 * derivation of (parent_rider, canonical scope); no network, no clock in the
 * id path. Revoking a parent kills its whole subtree: verify walks to the
 * root and fails on any revoked ancestor. Storage is an injectable Map-like
 * store; the default is an in-memory Map.
 * Fail-closed envelopes: { ok:false, reason }.
 */
import { createHash } from "node:crypto";

export const SUB_RIDERS_VERSION = "0.1.0";
export const SUB_RIDER_PREFIX = "sub_";
/** Maximum links followed by verifySubRider (cycle/depth guard). */
export const MAX_SUB_RIDER_HOPS = 1024;

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

function isStringArray(x) {
  return Array.isArray(x) && x.length > 0 && x.every(isNonEmptyString);
}

/** Canonical scope view: sorted crossings, fixed key order (stable hash). */
export function canonicalScope(scope) {
  const src = scope && typeof scope === "object" ? scope : {};
  return {
    spendCapCents: src.spendCapCents,
    crossings: Array.isArray(src.crossings)
      ? [...src.crossings].map(String).sort()
      : src.crossings,
  };
}

export function scopeHash(scope) {
  return sha256hex(JSON.stringify(canonicalScope(scope)));
}

function checkScope(scope) {
  if (!scope || typeof scope !== "object") {
    return { ok: false, reason: "bad_scope", detail: "scope is required" };
  }
  const n = Number(scope.spendCapCents);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    return { ok: false, reason: "bad_scope", detail: "scope.spendCapCents must be a positive integer" };
  }
  if (!isStringArray(scope.crossings)) {
    return { ok: false, reason: "bad_scope", detail: "scope.crossings must be a non-empty string array" };
  }
  return { ok: true };
}

/** Deterministic child id for (parent_rider, scope). */
export function deriveSubRiderId(parent_rider, scope) {
  return `${SUB_RIDER_PREFIX}${sha256hex(`${parent_rider}|${JSON.stringify(canonicalScope(scope))}`).slice(0, 24)}`;
}

function riderIdOf(input) {
  if (typeof input === "string") return input;
  if (input && typeof input === "object") {
    if (isNonEmptyString(input.rider_id)) return input.rider_id;
    if (input.receipt && isNonEmptyString(input.receipt.rider_id)) return input.receipt.rider_id;
  }
  return null;
}

/**
 * Issue a child rider bound to a parent with a spend cap and a crossing
 * allow-list. Identical input yields the identical child id (idempotent).
 * Adapters (all optional): { store: Map-like { get, set, has } }.
 */
export function issueSubRider(input = {}, adapters = {}) {
  const root = input && typeof input === "object" ? input : {};
  if (!isNonEmptyString(root.parent_rider)) {
    return { ok: false, reason: "missing_parent_rider" };
  }
  const sg = checkScope(root.scope);
  if (!sg.ok) return sg;
  const parent = root.parent_rider.trim();
  const scope = canonicalScope(root.scope);
  const riderId = deriveSubRiderId(parent, scope);
  const store = storeOf(adapters);
  try {
    const existing = store.get(riderId);
    if (!existing) {
      store.set(riderId, { rider_id: riderId, parent_rider: parent, scope, revoked: false });
    }
  } catch (e) {
    return { ok: false, reason: "store_failed", detail: String((e && e.message) || e).slice(0, 200) };
  }
  return {
    ok: true,
    receipt: { rider_id: riderId, parent_rider: parent, scope_hash: scopeHash(scope) },
  };
}

/** Revoke a sub-rider. Its whole subtree stops verifying afterwards. */
export function revokeSubRider(input, adapters = {}) {
  const id = riderIdOf(input);
  if (!id) return { ok: false, reason: "missing_rider_id" };
  const store = storeOf(adapters);
  let rec;
  try {
    rec = store.get(id);
  } catch (e) {
    return { ok: false, reason: "store_failed", detail: String((e && e.message) || e).slice(0, 200) };
  }
  if (!rec) return { ok: false, reason: "unknown_rider", rider_id: id };
  try {
    store.set(id, { ...rec, revoked: true });
  } catch (e) {
    return { ok: false, reason: "store_failed", detail: String((e && e.message) || e).slice(0, 200) };
  }
  return { ok: true, rider_id: id, revoked: true };
}

/**
 * Verify a sub-rider by walking parent links to the root. The root may live
 * outside this store (e.g. a standing rider); anything recorded here must be
 * unrevoked, or verification fails (directly revoked, or via an ancestor).
 */
export function verifySubRider(input, adapters = {}) {
  const id = riderIdOf(input);
  if (!id) return { ok: false, reason: "missing_rider_id" };
  const store = storeOf(adapters);
  let rec;
  try {
    rec = store.get(id);
  } catch (e) {
    return { ok: false, reason: "store_failed", detail: String((e && e.message) || e).slice(0, 200) };
  }
  if (!rec) return { ok: false, reason: "unknown_rider", rider_id: id };
  if (rec.revoked) return { ok: false, reason: "revoked", rider_id: id };
  const chain = [id];
  const seen = new Set([id]);
  let cur = rec;
  for (let hops = 0; hops < MAX_SUB_RIDER_HOPS; hops++) {
    const parent = cur.parent_rider;
    if (!isNonEmptyString(parent)) {
      return { ok: false, reason: "broken_chain", rider_id: cur.rider_id };
    }
    if (seen.has(parent)) {
      return { ok: false, reason: "sub_rider_cycle", rider_id: parent };
    }
    seen.add(parent);
    chain.unshift(parent);
    let parentRec;
    try {
      parentRec = store.get(parent);
    } catch (e) {
      return { ok: false, reason: "store_failed", detail: String((e && e.message) || e).slice(0, 200) };
    }
    if (!parentRec) break; // parent lives outside this store: it is the root.
    if (parentRec.revoked) {
      return { ok: false, reason: "revoked_ancestor", rider_id: id, ancestor: parent };
    }
    cur = parentRec;
  }
  if (chain.length > MAX_SUB_RIDER_HOPS) {
    return { ok: false, reason: "chain_too_long", rider_id: id };
  }
  return { ok: true, rider_id: id, root: chain[0], chain, scope: rec.scope };
}
