/**
 * Fixture seeds 0.1.0 — versioned held-out fixture PACK format + loader.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * NO fixtures are bundled here on purpose (held-out): this module only
 * defines the pack directory layout and verifies it, giving
 * private-bench a local pack dir to point at. A pack dir holds
 * pack.json ({ pack_id, suite, version, cases[] }) plus one file per
 * case; the loader checks sha256 per case and refuses fail-closed on
 * any mismatch, missing file, traversal path, or version skew.
 * Deterministic offline default: node:fs only, filesystem behind an
 * injectable fs adapter ({ readJsonText, readBytes }) for tests.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const FIXTURE_PACK_VERSION = "0.1.0";

const HEX64 = /^[0-9a-f]{64}$/;

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isBytes(v) {
  return (
    typeof v === "string" || Buffer.isBuffer(v) || v instanceof Uint8Array
  );
}

/** sha256 hex of a string (utf8) or byte array. Exported for pack authors. */
export function sha256Bytes(data) {
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Pack-relative file paths only: no absolute paths, no backslashes,
 * no drive letters, no empty/dot/dotdot segments.
 */
export function isSafePackPath(file) {
  if (typeof file !== "string" || file === "" || file.includes("\\")) return false;
  if (file.startsWith("/") || /^[A-Za-z]:/.test(file)) return false;
  const segs = file.split("/");
  return segs.every((s) => s !== "" && s !== "." && s !== "..");
}

function validCaseShape(c) {
  return (
    isPlainObject(c) &&
    typeof c.case_id === "string" &&
    c.case_id !== "" &&
    typeof c.file === "string" &&
    c.file !== "" &&
    typeof c.sha256 === "string" &&
    HEX64.test(c.sha256)
  );
}

function validManifestShape(m) {
  return (
    isPlainObject(m) &&
    typeof m.pack_id === "string" &&
    m.pack_id !== "" &&
    typeof m.suite === "string" &&
    m.suite !== "" &&
    typeof m.version === "string" &&
    Array.isArray(m.cases)
  );
}

/**
 * Build a pack manifest for { file -> bytes } content. Hashes with
 * sha256 per case; case_id defaults to the file path.
 */
export function createPackManifest({ pack_id, suite, files }) {
  if (typeof pack_id !== "string" || pack_id === "") {
    return { ok: false, error: "invalid_pack_id" };
  }
  if (typeof suite !== "string" || suite === "") {
    return { ok: false, error: "invalid_suite" };
  }
  if (!isPlainObject(files)) return { ok: false, error: "invalid_files" };
  const cases = [];
  for (const [file, bytes] of Object.entries(files)) {
    if (!isSafePackPath(file)) return { ok: false, error: `invalid_case_path:${file}` };
    if (!isBytes(bytes)) return { ok: false, error: `invalid_case_bytes:${file}` };
    cases.push({ case_id: file, file, sha256: sha256Bytes(bytes) });
  }
  return {
    ok: true,
    manifest: { pack_id, suite, version: FIXTURE_PACK_VERSION, cases },
  };
}

/**
 * Verify a manifest's cases via readFile(file) => string|Buffer.
 * @param {object} manifest pack manifest object.
 * @param {function} readFile injectable reader (pack-relative path => bytes).
 */
export function verifyPack(manifest, readFile) {
  if (!validManifestShape(manifest)) return { ok: false, error: "invalid_manifest" };
  if (manifest.version !== FIXTURE_PACK_VERSION) {
    return { ok: false, error: "unsupported_version" };
  }
  if (typeof readFile !== "function") return { ok: false, error: "no_reader" };
  for (const c of manifest.cases) {
    if (!validCaseShape(c)) return { ok: false, error: "invalid_case" };
    if (!isSafePackPath(c.file)) return { ok: false, error: `invalid_case_path:${c.case_id}` };
    let bytes;
    try {
      bytes = readFile(c.file);
    } catch {
      return { ok: false, error: `case_unreadable:${c.case_id}` };
    }
    if (!isBytes(bytes)) return { ok: false, error: `case_unreadable:${c.case_id}` };
    if (sha256Bytes(bytes) !== c.sha256) {
      return { ok: false, error: `case_hash_mismatch:${c.case_id}` };
    }
  }
  return { ok: true, verified: manifest.cases.length };
}

const defaultFs = {
  readJsonText: (absPath) => readFileSync(absPath, "utf8"),
  readBytes: (absPath) => readFileSync(absPath),
};

/**
 * Load + verify a pack dir (dir/pack.json + case files).
 * @param {string} dir pack directory path.
 * @param {object} [opts] { fs?: { readJsonText, readBytes } } injectable.
 */
export function loadPack(dir, opts = {}) {
  if (typeof dir !== "string" || dir === "") {
    return { ok: false, error: "invalid_dir" };
  }
  const o = isPlainObject(opts) ? opts : {};
  const fs = isPlainObject(o.fs) ? { ...defaultFs, ...o.fs } : defaultFs;
  if (typeof fs.readJsonText !== "function" || typeof fs.readBytes !== "function") {
    return { ok: false, error: "no_reader" };
  }
  let text;
  try {
    text = fs.readJsonText(join(dir, "pack.json"));
  } catch {
    return { ok: false, error: "pack_unreadable" };
  }
  let manifest;
  try {
    manifest = JSON.parse(typeof text === "string" ? text : Buffer.from(text).toString("utf8"));
  } catch {
    return { ok: false, error: "pack_invalid_json" };
  }
  const verdict = verifyPack(manifest, (rel) => fs.readBytes(join(dir, rel)));
  if (!verdict.ok) return verdict;
  return { ok: true, pack: manifest, verified: verdict.verified };
}
