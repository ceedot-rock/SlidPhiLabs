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
  createRotationProof,
  seedRiderSecret,
  RIDER_ROTATION_PREFIX,
} from "./rider-recovery.mjs";

function adapters() {
  return { store: new Map(), secrets: new Map() };
}

function proofFor(a, rider, nonce, secret) {
  if (secret !== undefined) seedRiderSecret(rider, a, secret);
  const p = createRotationProof({ rider_id: rider }, a, { nonce });
  assert.equal(p.ok, true);
  return p.proof;
}

test("rotates to a deterministic id with a three-field receipt", () => {
  const a = adapters();
  const proof = proofFor(a, "sr_abc", "n1", "s3cr3t-abc");
  const r = rotateRiderKey({ rider_id: "sr_abc", rotation_proof: proof }, a);
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.receipt).sort(), ["digest", "next_rider", "prev_rider"]);
  assert.equal(r.receipt.prev_rider, "sr_abc");
  assert.match(r.receipt.next_rider, new RegExp(`^${RIDER_ROTATION_PREFIX}[0-9a-f]{24}$`));
  assert.equal(r.receipt.next_rider, deriveRiderId("sr_abc", "n1"));
  assert.equal(r.receipt.digest, rotationDigest("sr_abc", r.receipt.next_rider));
});

test("rotation is deterministic and idempotent", () => {
  const a = adapters();
  const p1 = proofFor(a, "sr_abc", "n1", "s3cr3t-abc");
  const r1 = rotateRiderKey({ rider_id: "sr_abc", rotation_proof: p1 }, a);
  const r2 = rotateRiderKey({ rider_id: "sr_abc", rotation_proof: p1 }, a);
  assert.deepEqual(r1, r2);
  const p2 = proofFor(a, "sr_abc", "n2");
  const r3 = rotateRiderKey({ rider_id: "sr_abc", rotation_proof: p2 }, a);
  assert.notEqual(r3.receipt.next_rider, r1.receipt.next_rider);
});

test("fail-closed without rider_id or rotation_proof", () => {
  const a = adapters();
  assert.equal(rotateRiderKey({}, a).reason, "missing_rider_id");
  assert.equal(rotateRiderKey({ rider_id: "sr_abc" }, a).reason, "missing_rotation_proof");
  assert.equal(rotateRiderKey({ rider_id: "sr_abc", rotation_proof: "   " }, a).reason, "missing_rotation_proof");
});

test("throwaway bare proofs fail closed with bad_proof", () => {
  const a = adapters();
  seedRiderSecret("sr_abc", a, "s3cr3t-abc");
  // Pre-HMAC-era bare strings carry no <nonce>.<mac> signature.
  assert.equal(
    rotateRiderKey({ rider_id: "sr_abc", rotation_proof: "proof-1" }, a).reason,
    "bad_proof"
  );
  assert.equal(rotateRiderKey({ rider_id: "sr_abc", rotation_proof: "p1" }, a).reason, "bad_proof");
  // Tampered mac fails as well.
  const good = proofFor(a, "sr_abc", "n1");
  const [nonce, mac] = good.split(".");
  const badMac = mac.slice(0, 63) + (mac[63] === "0" ? "1" : "0");
  assert.equal(
    rotateRiderKey({ rider_id: "sr_abc", rotation_proof: `${nonce}.${badMac}` }, a).reason,
    "bad_proof"
  );
  // Proof minted for another rider does not transfer.
  const b = adapters();
  seedRiderSecret("sr_other", b, "other-secret");
  const foreign = createRotationProof({ rider_id: "sr_other" }, b, { nonce: "n1" }).proof;
  assert.equal(
    rotateRiderKey({ rider_id: "sr_abc", rotation_proof: foreign }, a).reason,
    "bad_proof"
  );
});

test("unknown rider fails closed with an injected secrets registry", () => {
  const a = adapters(); // empty injected secrets: no auto-seed.
  const r = rotateRiderKey({ rider_id: "sr_new", rotation_proof: "n1.00" }, a);
  assert.equal(r.reason, "unknown_rider");
  assert.equal(createRotationProof({ rider_id: "sr_new" }, a, { nonce: "n1" }).reason, "unknown_rider");
});

test("verifyRotation chain-walks multiple rotations to the genesis rider", () => {
  const a = adapters();
  seedRiderSecret("sr_genesis", a, "genesis-secret");
  const r1 = rotateRiderKey(
    { rider_id: "sr_genesis", rotation_proof: proofFor(a, "sr_genesis", "p1") }, a
  );
  seedRiderSecret(r1.receipt.next_rider, a, "hop2-secret");
  const r2 = rotateRiderKey(
    { rider_id: r1.receipt.next_rider, rotation_proof: proofFor(a, r1.receipt.next_rider, "p2") }, a
  );
  seedRiderSecret(r2.receipt.next_rider, a, "hop3-secret");
  const r3 = rotateRiderKey(
    { rider_id: r2.receipt.next_rider, rotation_proof: proofFor(a, r2.receipt.next_rider, "p3") }, a
  );
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
  const r = rotateRiderKey(
    { rider_id: "sr_x", rotation_proof: proofFor(a, "sr_x", "p", "s3cr3t-x") }, a
  );
  assert.equal(verifyRotation({ rider_id: r.receipt.next_rider }, a).ok, true);
  assert.equal(verifyRotation({ receipt: r.receipt }, a).ok, true);
});

test("verifyRotation fails closed on unknown, tampered, and missing ids", () => {
  const a = adapters();
  const r = rotateRiderKey(
    { rider_id: "sr_y", rotation_proof: proofFor(a, "sr_y", "p", "s3cr3t-y") }, a
  );
  assert.equal(verifyRotation("rr_deadbeefdeadbeefdeadbeef", a).reason, "unknown_rider");
  assert.equal(verifyRotation("", a).reason, "missing_rider_id");
  // Tamper with the stored link digest: verification must catch it.
  a.store.set(r.receipt.next_rider, { ...r.receipt, digest: "0".repeat(64) });
  assert.equal(verifyRotation(r.receipt.next_rider, a).reason, "digest_mismatch");
});
