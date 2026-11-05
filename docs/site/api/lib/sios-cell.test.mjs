/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * Tests for lib/sios-cell.mjs — deterministic, no network.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { siosJob, siosFile, SIOS_CELL_VERSION } from "./sios-cell.mjs";

test("siosJob stamps { kind, bytes, ok, path } with a file mapping", () => {
  const r = siosJob({ kind: "intake", bytes: 12, ok: true, path: "ppp:PPP-1" });
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.stamp).sort(), ["bytes", "digest", "file", "kind", "ok", "path"]);
  assert.equal(r.stamp.kind, "intake");
  assert.equal(r.stamp.path, "ppp:PPP-1");
  assert.match(r.stamp.digest, /^[0-9a-f]{64}$/);
  assert.equal(r.stamp.file.path, "ppp:PPP-1");
  assert.match(r.stamp.file.slot, /^[0-9a-f]{16}$/);
});

test("stamp is deterministic and matches siosFile for the same path", () => {
  const a = siosJob({ kind: "intake", bytes: 12, ok: true, path: "ppp:PPP-1" });
  const b = siosJob({ kind: "intake", bytes: 12, ok: true, path: "ppp:PPP-1" });
  assert.deepEqual(a, b);
  const f = siosFile("ppp:PPP-1");
  assert.equal(f.ok, true);
  assert.deepEqual(a.stamp.file, f.file);
  const other = siosJob({ kind: "intake", bytes: 13, ok: true, path: "ppp:PPP-1" });
  assert.notEqual(other.stamp.digest, a.stamp.digest);
});

test("fail-closed on bad input", () => {
  assert.equal(siosJob({}).reason, "missing_kind");
  assert.equal(siosJob({ kind: "intake" }).reason, "missing_path");
  assert.equal(siosJob({ kind: "intake", path: "ppp:x", bytes: -1 }).reason, "bad_bytes");
  assert.equal(siosFile("").reason, "missing_path");
  assert.equal(siosFile(null).reason, "missing_path");
});

test("injectable hashFn", () => {
  const r = siosJob({ kind: "intake", bytes: 1, ok: true, path: "ppp:x" }, { hashFn: () => "f".repeat(64) });
  assert.equal(r.stamp.digest, "f".repeat(64));
  assert.equal(SIOS_CELL_VERSION, "0.1.0");
});
