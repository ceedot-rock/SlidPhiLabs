/** Fixture seeds tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import {
  FIXTURE_PACK_VERSION,
  sha256Bytes,
  isSafePackPath,
  createPackManifest,
  verifyPack,
  loadPack,
} from "./fixture-seeds.mjs";

/** In-memory fs adapter: no disk, no fixtures bundled. */
function memFs(files) {
  return {
    readJsonText: (p) => {
      if (!Object.prototype.hasOwnProperty.call(files, p)) throw new Error(`enoent: ${p}`);
      const v = files[p];
      return typeof v === "string" ? v : Buffer.from(v).toString("utf8");
    },
    readBytes: (p) => {
      if (!Object.prototype.hasOwnProperty.call(files, p)) throw new Error(`enoent: ${p}`);
      return files[p];
    },
  };
}

const DIR = join("mem", "pack");
const packFiles = {
  [join(DIR, "pack.json")]: "",
  [join(DIR, "cases", "a.json")]: '{"in":1}',
  [join(DIR, "cases", "b.bin")]: Buffer.from([0, 1, 2, 3]),
};

function manifestFor(files) {
  const m = createPackManifest({ pack_id: "heldout-01", suite: "plan", files });
  assert.equal(m.ok, true);
  return m.manifest;
}

test("manifest creation hashes every case and stamps the version", () => {
  const files = { "cases/a.json": '{"in":1}' };
  const m = manifestFor(files);
  assert.equal(m.version, FIXTURE_PACK_VERSION);
  assert.equal(m.pack_id, "heldout-01");
  assert.equal(m.cases.length, 1);
  assert.equal(m.cases[0].sha256, sha256Bytes('{"in":1}'));
});

test("verifyPack accepts intact cases via the injected reader", () => {
  const files = { "cases/a.json": '{"in":1}', "cases/b.bin": Buffer.from([9]) };
  const m = manifestFor(files);
  const r = verifyPack(m, (rel) => files[rel]);
  assert.deepEqual(r, { ok: true, verified: 2 });
});

test("verifyPack refuses on a single hash mismatch, naming the case", () => {
  const m = manifestFor({ "cases/a.json": '{"in":1}' });
  const r = verifyPack(m, () => '{"in":2}');
  assert.deepEqual(r, { ok: false, error: "case_hash_mismatch:cases/a.json" });
});

test("verifyPack refuses unreadable cases and a missing reader", () => {
  const m = manifestFor({ "cases/a.json": "x" });
  assert.deepEqual(verifyPack(m, () => { throw new Error("enoent"); }), {
    ok: false,
    error: "case_unreadable:cases/a.json",
  });
  assert.deepEqual(verifyPack(m, null), { ok: false, error: "no_reader" });
});

test("traversal and absolute paths are rejected on both ends", () => {
  for (const bad of ["../evil.json", "/abs.json", "a/../../x", "", "a\\b.json", "C:/x.json"]) {
    assert.equal(isSafePackPath(bad), false, bad);
  }
  assert.equal(isSafePackPath("cases/a.json"), true);
  assert.equal(createPackManifest({ pack_id: "p", suite: "s", files: { "../x": "v" } }).error, "invalid_case_path:../x");
  const evil = {
    pack_id: "p",
    suite: "s",
    version: FIXTURE_PACK_VERSION,
    cases: [{ case_id: "e", file: "../e.json", sha256: "0".repeat(64) }],
  };
  assert.equal(verifyPack(evil, () => "v").error, "invalid_case_path:e");
});

test("version skew and malformed manifests are fail-closed", () => {
  const m = manifestFor({ "a.json": "v" });
  assert.deepEqual(verifyPack({ ...m, version: "9.9.9" }, () => "v"), {
    ok: false,
    error: "unsupported_version",
  });
  for (const bad of [null, {}, { ...m, cases: "x" }, { ...m, pack_id: "" }]) {
    assert.equal(verifyPack(bad, () => "v").error, "invalid_manifest");
  }
  assert.equal(createPackManifest({ pack_id: "", suite: "s", files: {} }).error, "invalid_pack_id");
  assert.equal(createPackManifest({ pack_id: "p", suite: "", files: {} }).error, "invalid_suite");
});

test("loadPack round-trips a pack dir through the fs adapter", () => {
  const files = { "cases/a.json": '{"in":1}', "cases/b.bin": Buffer.from([0, 1, 2, 3]) };
  const m = manifestFor(files);
  const disk = { ...packFiles, [join(DIR, "pack.json")]: JSON.stringify(m) };
  for (const [rel, bytes] of Object.entries(files)) disk[join(DIR, rel)] = bytes;
  const r = loadPack(DIR, { fs: memFs(disk) });
  assert.equal(r.ok, true);
  assert.equal(r.verified, 2);
  assert.deepEqual(r.pack, m);
});

test("loadPack fails closed on missing dir, bad json, and tampered cases", () => {
  assert.equal(loadPack("").error, "invalid_dir");
  assert.equal(loadPack(DIR, { fs: memFs({}) }).error, "pack_unreadable");
  const notJson = { ...packFiles, [join(DIR, "pack.json")]: "{oops" };
  assert.equal(loadPack(DIR, { fs: memFs(notJson) }).error, "pack_invalid_json");
  const m = manifestFor({ "cases/a.json": "good" });
  const tampered = {
    [join(DIR, "pack.json")]: JSON.stringify(m),
    [join(DIR, "cases", "a.json")]: "evil",
  };
  assert.deepEqual(loadPack(DIR, { fs: memFs(tampered) }), {
    ok: false,
    error: "case_hash_mismatch:cases/a.json",
  });
});
