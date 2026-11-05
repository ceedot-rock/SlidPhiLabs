/**
 * Standing rider 0.1.0 — standing safeguards + waiver-gated rider issuance.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Deterministic, offline, dependency-free: issuance is a pure function of
 * the safeguards + pinned waiver version (SHA-256 ids, no network, no clock
 * unless an adapter injects one). Storage is an injectable Map-like store;
 * the default is an in-memory Map (no filesystem I/O unless the caller
 * injects a persistent store). Fail-closed envelopes: { ok:false, reason }.
 */
import { createHash } from "node:crypto";

export const STANDING_RIDER_VERSION = "0.1.0";
/** Pinned waiver version. A waiver with any other version is not accepted. */
export const STANDING_WAIVER_VERSION = "waiver-v1";

export const REQUIRED_SAFEGUARDS = Object.freeze([
  "spendCapCents",
  "allowedCrossings",
  "velocityPerMin",
  "allowedTools",
]);

const _defaultStore = new Map();

function storeOf(adapters) {
  const s = adapters && adapters.store ? adapters.store : _defaultStore;
  return s;
}

function nowMsOf(adapters) {
  if (adapters && typeof adapters.nowMs === "function") return adapters.nowMs();
  return Date.now();
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

/** Canonical safeguards view: sorted arrays, fixed key order (stable hash). */
export function canonicalSafeguards(s) {
  const src = s && typeof s === "object" ? s : {};
  return {
    spendCapCents: src.spendCapCents,
    allowedCrossings: Array.isArray(src.allowedCrossings)
      ? [...src.allowedCrossings].map(String).sort()
      : src.allowedCrossings,
    velocityPerMin: src.velocityPerMin,
    allowedTools: Array.isArray(src.allowedTools)
      ? [...src.allowedTools].map(String).sort()
      : src.allowedTools,
  };
}

export function safeguardsHash(safeguards) {
  return sha256hex(JSON.stringify(canonicalSafeguards(safeguards)));
}

function checkSafeguards(safeguards) {
  if (!safeguards || typeof safeguards !== "object") {
    return { ok: false, reason: "missing_safeguard", safeguard: "spendCapCents" };
  }
  const n = Number(safeguards.spendCapCents);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    return { ok: false, reason: "missing_safeguard", safeguard: "spendCapCents" };
  }
  if (!isStringArray(safeguards.allowedCrossings)) {
    return { ok: false, reason: "missing_safeguard", safeguard: "allowedCrossings" };
  }
  const v = Number(safeguards.velocityPerMin);
  if (!Number.isFinite(v) || v <= 0) {
    return { ok: false, reason: "missing_safeguard", safeguard: "velocityPerMin" };
  }
  if (!isStringArray(safeguards.allowedTools)) {
    return { ok: false, reason: "missing_safeguard", safeguard: "allowedTools" };
  }
  return { ok: true };
}

function checkWaiver(waiver) {
  if (!waiver || typeof waiver !== "object" || waiver.accepted !== true) {
    return { ok: false, reason: "waiver_not_accepted", detail: "waiver.accepted must be true" };
  }
  if (waiver.version !== STANDING_WAIVER_VERSION) {
    return {
      ok: false,
      reason: "waiver_not_accepted",
      detail: `waiver.version must be ${STANDING_WAIVER_VERSION}`,
    };
  }
  return { ok: true };
}

/**
 * Issue a standing rider. Succeeds ONLY when every safeguard is present and
 * the waiver is accepted at the pinned version. Adapters (all optional):
 * { nowMs(): number, idFn({ safeguards_hash, waiver_version }): string,
 *   store: Map-like { get, set, has } }.
 */
export function issueStandingRider(input = {}, adapters = {}) {
  const root = input && typeof input === "object" ? input : {};
  const sg = checkSafeguards(root.safeguards);
  if (!sg.ok) return sg;
  const wv = checkWaiver(root.waiver);
  if (!wv.ok) return wv;
  const hash = safeguardsHash(root.safeguards);
  let riderId;
  try {
    riderId =
      adapters && typeof adapters.idFn === "function"
        ? adapters.idFn({ safeguards_hash: hash, waiver_version: STANDING_WAIVER_VERSION })
        : `sr_${hash.slice(0, 24)}`;
  } catch (e) {
    return { ok: false, reason: "grader_failed", detail: String((e && e.message) || e).slice(0, 200) };
  }
  if (!isNonEmptyString(riderId)) {
    return { ok: false, reason: "grader_failed", detail: "idFn returned empty id" };
  }
  const store = storeOf(adapters);
  const record = {
    rider_id: riderId,
    safeguards: canonicalSafeguards(root.safeguards),
    safeguards_hash: hash,
    waiver_version: STANDING_WAIVER_VERSION,
    waiver_at: root.waiver && root.waiver.at != null ? root.waiver.at : null,
    issued_at: nowMsOf(adapters),
    revoked: false,
  };
  try {
    store.set(riderId, record);
  } catch (e) {
    return { ok: false, reason: "grader_failed", detail: String((e && e.message) || e).slice(0, 200) };
  }
  return {
    ok: true,
    receipt: {
      rider_id: riderId,
      safeguards_hash: hash,
      waiver_version: STANDING_WAIVER_VERSION,
    },
    issued_at: record.issued_at,
  };
}

function riderIdOf(input) {
  if (typeof input === "string") return input;
  if (input && typeof input === "object") {
    if (isNonEmptyString(input.rider_id)) return input.rider_id;
    if (input.receipt && isNonEmptyString(input.receipt.rider_id)) return input.receipt.rider_id;
  }
  return null;
}

/** Verify a rider id (or { rider_id } / { receipt:{ rider_id } }). */
export function verifyStandingRider(input, adapters = {}) {
  const id = riderIdOf(input);
  if (!id) return { ok: false, reason: "missing_rider_id" };
  const store = storeOf(adapters);
  const rec = store.get(id);
  if (!rec) return { ok: false, reason: "unknown_rider", rider_id: id };
  if (rec.revoked) return { ok: false, reason: "revoked", rider_id: id };
  return {
    ok: true,
    rider_id: rec.rider_id,
    safeguards_hash: rec.safeguards_hash,
    waiver_version: rec.waiver_version,
    issued_at: rec.issued_at,
  };
}

/** Revoke a rider id. Verify fails with reason "revoked" afterwards. */
export function revokeStandingRider(input, adapters = {}) {
  const id = riderIdOf(input);
  if (!id) return { ok: false, reason: "missing_rider_id" };
  const store = storeOf(adapters);
  const rec = store.get(id);
  if (!rec) return { ok: false, reason: "unknown_rider", rider_id: id };
  try {
    store.set(id, { ...rec, revoked: true });
  } catch (e) {
    return { ok: false, reason: "grader_failed", detail: String((e && e.message) || e).slice(0, 200) };
  }
  return { ok: true, rider_id: id, revoked: true };
}
