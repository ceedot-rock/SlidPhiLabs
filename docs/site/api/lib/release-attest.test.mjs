/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * Tests for lib/release-attest.mjs — deterministic vectors, no network.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  buildReleaseReceipt,
  buildReleaseReceiptAsync,
  verifyReleaseReceipt,
  verifyReleaseReceiptAsync,
  RELEASE_ATTEST_VERSION,
} from "./release-attest.mjs";

const REPO = "ceedot-rock/PCCVerse";
const TAG = "v1.2.3";
const TARBALL = Buffer.from("fake-tarball-bytes-001", "utf8");
const DIGEST = createHash("sha256").update(TARBALL).digest("hex");

function input(over = {}) {
  return { repo: REPO, tag: TAG, sha256: DIGEST, tarball_bytes: TARBALL, ...over };
}

test("builds a receipt binding repo@tag to the digest", () => {
  const r = buildReleaseReceipt(input());
  assert.equal(r.ok, true);
  assert.deepEqual(r.receipt, {
    tool: "release-attest",
    version: RELEASE_ATTEST_VERSION,
    repo: REPO,
    tag: TAG,
    sha256: DIGEST,
    bytes: TARBALL.length,
  });
  assert.ok(Object.isFrozen(r.receipt));
});

test("normalizes case and trims repo/tag/digest", () => {
  const r = buildReleaseReceipt(input({ sha256: `  ${DIGEST.toUpperCase()} `, tag: ` ${TAG} ` }));
  assert.equal(r.ok, true);
  assert.equal(r.receipt.sha256, DIGEST);
  assert.equal(r.receipt.tag, TAG);
});

test("fails closed on digest mismatch", () => {
  const r = buildReleaseReceipt(input({ sha256: "0".repeat(64) }));
  assert.equal(r.ok, false);
  assert.equal(r.reason, "digest_mismatch");
});

test("fails closed on bad repo, tag, digest, tarball", () => {
  assert.equal(buildReleaseReceipt(input({ repo: "" })).reason, "bad_repo");
  assert.equal(buildReleaseReceipt(input({ repo: null })).reason, "bad_repo");
  assert.equal(buildReleaseReceipt(input({ tag: "  " })).reason, "bad_tag");
  assert.equal(buildReleaseReceipt(input({ sha256: "zzz" })).reason, "bad_digest");
  assert.equal(buildReleaseReceipt(input({ sha256: "abc" })).reason, "bad_digest");
  assert.equal(buildReleaseReceipt(input({ tarball_bytes: null })).reason, "bad_tarball");
  assert.equal(buildReleaseReceipt(input({ tarball_bytes: 42 })).reason, "bad_tarball");
  assert.equal(buildReleaseReceipt(null).reason, "bad_repo");
});

test("accepts string and Uint8Array tarballs with equal bytes", () => {
  const s = "same-bytes";
  const d = createHash("sha256").update(s, "utf8").digest("hex");
  const a = buildReleaseReceipt({ repo: REPO, tag: TAG, sha256: d, tarball_bytes: s });
  const b = buildReleaseReceipt({
    repo: REPO,
    tag: TAG,
    sha256: d,
    tarball_bytes: new Uint8Array(Buffer.from(s, "utf8")),
  });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
});

test("verify accepts a good receipt and re-checks tarball bytes", () => {
  const { receipt } = buildReleaseReceipt(input());
  assert.equal(verifyReleaseReceipt(receipt).ok, true);
  assert.equal(verifyReleaseReceipt(receipt, { tarball_bytes: TARBALL }).ok, true);
  assert.equal(
    verifyReleaseReceipt(receipt, { tarball_bytes: Buffer.from("other") }).reason,
    "digest_mismatch"
  );
});

test("verify fails closed on tampered binding and mismatched expect", () => {
  const { receipt } = buildReleaseReceipt(input());
  assert.equal(verifyReleaseReceipt({ ...receipt, tag: "v9.9.9" }).ok, true); // shape still valid
  assert.equal(
    verifyReleaseReceipt(receipt, { expect: { tag: "v9.9.9" } }).reason,
    "tag_mismatch"
  );
  assert.equal(
    verifyReleaseReceipt(receipt, { expect: { repo: "someone/else" } }).reason,
    "repo_mismatch"
  );
  assert.equal(
    verifyReleaseReceipt(receipt, { expect: { sha256: "0".repeat(64) } }).reason,
    "digest_mismatch"
  );
  assert.equal(verifyReleaseReceipt(null).reason, "bad_receipt");
  assert.equal(verifyReleaseReceipt({ tool: "release-attest", version: "9.9.9" }).reason, "unsupported_version");
});

test("injectable hashFn is honored; adapter failure fails closed", () => {
  const good = buildReleaseReceipt(input(), { hashFn: () => DIGEST });
  assert.equal(good.ok, true);
  const bad = buildReleaseReceipt(input(), { hashFn: () => "0".repeat(64) });
  assert.equal(bad.reason, "digest_mismatch");
  const boom = buildReleaseReceipt(input(), {
    hashFn: () => {
      throw new Error("nope");
    },
  });
  assert.equal(boom.reason, "hash_adapter_failed");
  const asyncInSync = buildReleaseReceipt(input(), { hashFn: async () => DIGEST });
  assert.equal(asyncInSync.reason, "async_adapter_use_async");
});

test("async variants await promise adapters", async () => {
  const r = await buildReleaseReceiptAsync(input(), { hashFn: async () => DIGEST });
  assert.equal(r.ok, true);
  const v = await verifyReleaseReceiptAsync(r.receipt, {
    tarball_bytes: TARBALL,
    hashFn: async (b) => createHash("sha256").update(b).digest("hex"),
  });
  assert.equal(v.ok, true);
  const bad = await verifyReleaseReceiptAsync(r.receipt, {
    tarball_bytes: TARBALL,
    hashFn: async () => "0".repeat(64),
  });
  assert.equal(bad.reason, "digest_mismatch");
});
