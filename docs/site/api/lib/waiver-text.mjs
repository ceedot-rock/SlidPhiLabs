/**
 * Waiver text 0.1.0 — frozen rider waiver + pinned acceptance receipts.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Deterministic, offline, dependency-free: the waiver text is frozen below
 * (WAIVER_V1); acceptance receipts pin its version + SHA-256 hash, so any
 * wording drift fails verification. No network; the clock is injectable.
 *
 * LEGAL TODO (collected here, the single place it lives):
 * this text is NOT legal advice and MUST be reviewed by a licensed attorney
 * before production use. See ATTORNEY_REVIEW_PENDING.
 */
import { createHash } from "node:crypto";

/** Pinned waiver version. Acceptance at any other version is rejected. */
export const WAIVER_VERSION = "waiver-v1";
export const WAIVER_TEXT_VERSION = "0.1.0";

/**
 * Legal review gate. True until a licensed attorney has reviewed WAIVER_V1
 * for production use. Builders MUST surface this flag wherever the waiver
 * is presented; do not ship with it silently dropped.
 */
export const ATTORNEY_REVIEW_PENDING = true;

/** Frozen waiver text (v1). Do not edit: freeze a v2 instead. */
export const WAIVER_V1 = Object.freeze(
  [
    "SLID PHI LABS — AUTONOMOUS COMMERCE RIDER WAIVER (v1).",
    "",
    "By accepting, the rider operator (1) assumes full responsibility for every",
    "action the rider takes under its safeguards, including spends, crossings,",
    "and tool calls; (2) agrees the rider acts only within its issued safeguards",
    "(spend cap, allowed crossings, velocity limit, allowed tools) and that any",
    "attempt to exceed them is blocked, not billed; (3) accepts that rating,",
    "reputation, stake, and slash outcomes are final once recorded; (4) agrees",
    "that key rotation (rider recovery) does not erase history — prior actions",
    "remain attributed through the rotation chain; (5) acknowledges this waiver",
    "is experimental text pending attorney review (see ATTORNEY_REVIEW_PENDING)",
    "and is NOT legal advice.",
    "",
    "Acceptance is recorded as a pinned receipt (version + text hash).",
  ].join("\n")
);

export function sha256hex(text) {
  return createHash("sha256").update(String(text ?? ""), "utf8").digest("hex");
}

/** SHA-256 of the frozen text; acceptance receipts pin this value. */
export function waiverHash() {
  return sha256hex(WAIVER_V1);
}

function nowMsOf(adapters) {
  if (adapters && typeof adapters.nowMs === "function") return adapters.nowMs();
  return Date.now();
}

function isNonEmptyString(x) {
  return typeof x === "string" && x.trim().length > 0;
}

/**
 * Build an acceptance receipt for a rider. The receipt pins the waiver
 * version + text hash and carries the attorney-review flag, so the legal
 * TODO travels with every acceptance. Adapters (all optional):
 * { nowMs(): number }.
 */
export function buildWaiverAcceptance(input = {}, adapters = {}) {
  const root = input && typeof input === "object" ? input : {};
  if (!isNonEmptyString(root.rider_id)) {
    return { ok: false, reason: "missing_rider_id" };
  }
  return {
    ok: true,
    receipt: Object.freeze({
      rider_id: root.rider_id.trim(),
      waiver_version: WAIVER_VERSION,
      waiver_hash: waiverHash(),
      accepted: true,
      at: nowMsOf(adapters),
      attorney_review_pending: ATTORNEY_REVIEW_PENDING,
    }),
  };
}

/**
 * Verify an acceptance receipt (or { receipt }): accepted flag set, version
 * pinned, and text hash matching the frozen WAIVER_V1.
 */
export function verifyWaiverAcceptance(input, adapters = {}) {
  void adapters;
  const receipt =
    input && typeof input === "object" && input.receipt && typeof input.receipt === "object"
      ? input.receipt
      : input;
  if (!receipt || typeof receipt !== "object") {
    return { ok: false, reason: "bad_receipt", detail: "receipt is required" };
  }
  if (!isNonEmptyString(receipt.rider_id)) {
    return { ok: false, reason: "bad_receipt", detail: "receipt.rider_id is required" };
  }
  if (receipt.accepted !== true) {
    return { ok: false, reason: "waiver_not_accepted", detail: "receipt.accepted must be true" };
  }
  if (receipt.waiver_version !== WAIVER_VERSION) {
    return {
      ok: false,
      reason: "waiver_version_mismatch",
      detail: `receipt.waiver_version must be ${WAIVER_VERSION}`,
    };
  }
  if (receipt.waiver_hash !== waiverHash()) {
    return { ok: false, reason: "waiver_hash_mismatch", detail: "receipt predates the frozen text" };
  }
  return {
    ok: true,
    rider_id: receipt.rider_id,
    waiver_version: WAIVER_VERSION,
    waiver_hash: receipt.waiver_hash,
    attorney_review_pending: ATTORNEY_REVIEW_PENDING,
  };
}
