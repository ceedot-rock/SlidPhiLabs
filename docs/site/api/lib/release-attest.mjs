/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * Release attestation (pure, offline): bind repo@tag to a tarball digest.
 *
 * buildReleaseReceipt({ repo, tag, sha256, tarball_bytes }) hashes the
 * tarball bytes and fails closed unless they match the claimed sha256.
 * The receipt { tool, version, repo, tag, sha256, bytes } is the binding:
 * verifyReleaseReceipt re-checks the shape and, when given tarball bytes
 * or an expected repo@tag/digest, re-checks those too.
 *
 * Deterministic and offline by default: hashing is SHA-256 via node:crypto
 * with an injectable hashFn adapter ({ (bytes: Buffer) => hex-string }).
 * Sync builders use a sync adapter; async adapters use the Async variants.
 * All functions return envelopes ({ ok:true,... } / { ok:false,... })
 * and never throw on bad input.
 */
import { createHash, timingSafeEqual } from "node:crypto";

export const RELEASE_ATTEST_VERSION = "0.1.0";
export const RELEASE_ATTEST_TOOL = "release-attest";

function fail(reason, extra = {}) {
  return { ok: false, stage: RELEASE_ATTEST_TOOL, reason, ...extra };
}

/** Default offline hasher: SHA-256 hex over exact bytes. */
export function defaultHashBytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function toBytes(input) {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input);
  if (typeof input === "string") return Buffer.from(input, "utf8");
  return null;
}

function normalizeDigest(sha256) {
  if (typeof sha256 !== "string") return null;
  const s = sha256.trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(s) ? s : null;
}

function normalizeRepo(repo) {
  if (typeof repo !== "string") return null;
  const r = repo.trim();
  if (!r || /\s/.test(r)) return null;
  return r;
}

function normalizeTag(tag) {
  if (typeof tag !== "string") return null;
  const t = tag.trim();
  if (!t || /\s/.test(t)) return null;
  return t;
}

function isThenable(v) {
  return v !== null && (typeof v === "object" || typeof v === "function") && typeof v.then === "function";
}

/** Timing-safe hex-digest compare. False on malformed input, never throws. */
function digestsEqual(aHex, bHex) {
  if (typeof aHex !== "string" || typeof bHex !== "string") return false;
  const a = normalizeDigest(aHex);
  const b = normalizeDigest(bHex);
  if (!a || !b) return false;
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function seal(repo, tag, sha256, byteLength) {
  return Object.freeze({
    tool: RELEASE_ATTEST_TOOL,
    version: RELEASE_ATTEST_VERSION,
    repo,
    tag,
    sha256,
    bytes: byteLength,
  });
}

function checkShape(receipt) {
  if (!receipt || typeof receipt !== "object") return fail("bad_receipt");
  if (receipt.tool !== RELEASE_ATTEST_TOOL) return fail("bad_receipt", { detail: "bad_tool" });
  if (receipt.version !== RELEASE_ATTEST_VERSION) {
    return fail("unsupported_version", { version: receipt.version ?? null });
  }
  const repo = normalizeRepo(receipt.repo);
  if (!repo) return fail("bad_repo");
  const tag = normalizeTag(receipt.tag);
  if (!tag) return fail("bad_tag");
  const sha256 = normalizeDigest(receipt.sha256);
  if (!sha256) return fail("bad_digest");
  return { sealed: { repo, tag, sha256 } };
}

/**
 * Build a release receipt. Fails closed unless tarball_bytes hash to sha256.
 * opts.hashFn defaults to SHA-256; a sync adapter is required here.
 */
export function buildReleaseReceipt(input = {}, opts = {}) {
  const { repo, tag, sha256, tarball_bytes } = input ?? {};
  const cleanRepo = normalizeRepo(repo);
  if (!cleanRepo) return fail("bad_repo");
  const cleanTag = normalizeTag(tag);
  if (!cleanTag) return fail("bad_tag");
  const expect = normalizeDigest(sha256);
  if (!expect) return fail("bad_digest");
  const bytes = toBytes(tarball_bytes);
  if (!bytes) return fail("bad_tarball");
  const hashFn = opts.hashFn ?? defaultHashBytes;
  if (typeof hashFn !== "function") return fail("bad_adapter");
  let got;
  try {
    got = hashFn(bytes);
  } catch (e) {
    return fail("hash_adapter_failed", { detail: String((e && e.message) || e) });
  }
  if (isThenable(got)) return fail("async_adapter_use_async");
  if (!digestsEqual(got, expect)) return fail("digest_mismatch");
  return { ok: true, receipt: seal(cleanRepo, cleanTag, expect, bytes.length) };
}

/** Async variant: awaits a promise-returning hashFn adapter. */
export async function buildReleaseReceiptAsync(input = {}, opts = {}) {
  const { repo, tag, sha256, tarball_bytes } = input ?? {};
  const cleanRepo = normalizeRepo(repo);
  if (!cleanRepo) return fail("bad_repo");
  const cleanTag = normalizeTag(tag);
  if (!cleanTag) return fail("bad_tag");
  const expect = normalizeDigest(sha256);
  if (!expect) return fail("bad_digest");
  const bytes = toBytes(tarball_bytes);
  if (!bytes) return fail("bad_tarball");
  const hashFn = opts.hashFn ?? defaultHashBytes;
  if (typeof hashFn !== "function") return fail("bad_adapter");
  let got;
  try {
    got = await hashFn(bytes);
  } catch (e) {
    return fail("hash_adapter_failed", { detail: String((e && e.message) || e) });
  }
  if (!digestsEqual(got, expect)) return fail("digest_mismatch");
  return { ok: true, receipt: seal(cleanRepo, cleanTag, expect, bytes.length) };
}

/**
 * Verify a release receipt. opts.tarball_bytes re-hashes and re-checks the
 * digest; opts.expect { repo, tag, sha256 } re-checks the binding (only the
 * supplied fields). opts.hashFn defaults to SHA-256 (sync required here).
 */
export function verifyReleaseReceipt(receipt, opts = {}) {
  const shape = checkShape(receipt);
  if (shape.sealed === undefined) return shape;
  const { repo, tag, sha256 } = shape.sealed;
  const expect = opts.expect;
  if (expect !== undefined) {
    if (!expect || typeof expect !== "object") return fail("bad_expect");
    if (expect.repo !== undefined && normalizeRepo(expect.repo) !== repo) {
      return fail("repo_mismatch");
    }
    if (expect.tag !== undefined && normalizeTag(expect.tag) !== tag) {
      return fail("tag_mismatch");
    }
    if (expect.sha256 !== undefined && normalizeDigest(expect.sha256) !== sha256) {
      return fail("digest_mismatch");
    }
  }
  if (opts.tarball_bytes !== undefined) {
    const bytes = toBytes(opts.tarball_bytes);
    if (!bytes) return fail("bad_tarball");
    const hashFn = opts.hashFn ?? defaultHashBytes;
    if (typeof hashFn !== "function") return fail("bad_adapter");
    let got;
    try {
      got = hashFn(bytes);
    } catch (e) {
      return fail("hash_adapter_failed", { detail: String((e && e.message) || e) });
    }
    if (isThenable(got)) return fail("async_adapter_use_async");
    if (!digestsEqual(got, sha256)) return fail("digest_mismatch");
  }
  return { ok: true, receipt: seal(repo, tag, sha256, Number(receipt.bytes) || 0) };
}

/** Async variant: awaits a promise-returning hashFn adapter. */
export async function verifyReleaseReceiptAsync(receipt, opts = {}) {
  const shape = checkShape(receipt);
  if (shape.sealed === undefined) return shape;
  const { repo, tag, sha256 } = shape.sealed;
  const expect = opts.expect;
  if (expect !== undefined) {
    if (!expect || typeof expect !== "object") return fail("bad_expect");
    if (expect.repo !== undefined && normalizeRepo(expect.repo) !== repo) {
      return fail("repo_mismatch");
    }
    if (expect.tag !== undefined && normalizeTag(expect.tag) !== tag) {
      return fail("tag_mismatch");
    }
    if (expect.sha256 !== undefined && normalizeDigest(expect.sha256) !== sha256) {
      return fail("digest_mismatch");
    }
  }
  if (opts.tarball_bytes !== undefined) {
    const bytes = toBytes(opts.tarball_bytes);
    if (!bytes) return fail("bad_tarball");
    const hashFn = opts.hashFn ?? defaultHashBytes;
    if (typeof hashFn !== "function") return fail("bad_adapter");
    let got;
    try {
      got = await hashFn(bytes);
    } catch (e) {
      return fail("hash_adapter_failed", { detail: String((e && e.message) || e) });
    }
    if (!digestsEqual(got, sha256)) return fail("digest_mismatch");
  }
  return { ok: true, receipt: seal(repo, tag, sha256, Number(receipt.bytes) || 0) };
}
