/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * Tests for lib/rider-recovery.mjs — deterministic, no network.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  rotateRiderKey,
  verifyRotation,
  deriveRiderId,
  rotationDigest,
  RIDER_ROTATION_PREFIX,
} from "./rider-recovery.mjs";

function adapters() {
  return { store: new Map() };
}

test("rotates to a deterministic id with a three-field receipt", () => {
  const a = adapters();
  const r = rotateRiderKey({ rider_id: "sr_abc", rotation_proof: "proof-1" }, a);
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.receipt).sort(), ["digest", "next_rider", "prev_rider"]);
  assert.equal(r.receipt.prev_rider, "sr_abc");
  assert.match(r.receipt.next_rider, new RegExp(`^${RIDER_ROTATION_PREFIX}[0-9a-f]{24}$`));
  assert.equal(r.receipt.next_rider, deriveRiderId("sr_abc", "proof-1"));
  assert.equal(r.receipt.digest, rotationDigest("sr_abc", r.receipt.next_rider));
});

test("rotation is deterministic and idempotent", () => {
  const a = adapters();
  const r1 = rotateRiderKey({ rider_id: "sr_abc", rotation_proof: "proof-1" }, a);
  const r2 = rotateRiderKey({ rider_id: "sr_abc", rotation_proof: "proof-1" }, a);
  assert.deepEqual(r1, r2);
  const r3 = rotateRiderKey({ rider_id: "sr_abc", rotation_proof: "proof-2" }, a);
  assert.notEqual(r3.receipt.next_rider, r1.receipt.next_rider);
});

test("fail-closed without rider_id or rotation_proof", () => {
  const a = adapters();
  assert.equal(rotateRiderKey({}, a).reason, "missing_rider_id");
  assert.equal(rotateRiderKey({ rider_id: "sr_abc" }, a).reason, "missing_rotation_proof");
  assert.equal(rotateRiderKey({ rider_id: "sr_abc", rotation_proof: "   " }, a).reason, "missing_rotation_proof");
});

test("verifyRotation chain-walks multiple rotations to the genesis rider", () => {
  const a = adapters();
  const r1 = rotateRiderKey({ rider_id: "sr_genesis", rotation_proof: "p1" }, a);
  const r2 = rotateRiderKey({ rider_id: r1.receipt.next_rider, rotation_proof: "p2" }, a);
  const r3 = rotateRiderKey({ rider_id: r2.receipt.next_rider, rotation_proof: "p3" }, a);
  const v = verifyRotation(r3.receipt.next_rider, a);
  assert.equal(v.ok, true);
  assert.equal(v.rotations, 3);
  assert.equal(v.root, "sr_genesis");
  assert.deepEqual(v.chain, [
    "sr_genesis",
    r1.receipt.next_rider,
    r2.receipt.next_rider,
    r3.receipt.next_rider,
  ]);
});

test("verifyRotation accepts { rider_id } and { receipt } shapes", () => {
  const a = adapters();
  const r = rotateRiderKey({ rider_id: "sr_x", rotation_proof: "p" }, a);
  assert.equal(verifyRotation({ rider_id: r.receipt.next_rider }, a).ok, true);
  assert.equal(verifyRotation({ receipt: r.receipt }, a).ok, true);
});

test("verifyRotation fails closed on unknown, tampered, and missing ids", () => {
  const a = adapters();
  const r = rotateRiderKey({ rider_id: "sr_y", rotation_proof: "p" }, a);
  assert.equal(verifyRotation("rr_deadbeefdeadbeefdeadbeef", a).reason, "unknown_rider");
  assert.equal(verifyRotation("", a).reason, "missing_rider_id");
  // Tamper with the stored link digest: verification must catch it.
  a.store.set(r.receipt.next_rider, { ...r.receipt, digest: "0".repeat(64) });
  assert.equal(verifyRotation(r.receipt.next_rider, a).reason, "digest_mismatch");
});
