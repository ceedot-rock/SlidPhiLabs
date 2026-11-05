/** Fail-closed store tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadJson,
  checkAmountCents,
  CorruptStoreError,
  isCorruptStoreError,
  CORRUPT_STORE,
} from "./failclosed-store.mjs";

const dir = mkdtempSync(join(tmpdir(), "failclosed-test-"));

test("missing file yields the fallback, factories called fresh", () => {
  const missing = join(dir, "nope.json");
  assert.deepEqual(loadJson(missing, { a: 1 }), { a: 1 });
  let calls = 0;
  const f = loadJson(missing, () => ({ n: ++calls }));
  assert.deepEqual(f, { n: 1 });
  assert.notEqual(loadJson(missing, () => ({})), loadJson(missing, () => ({})));
});

test("valid file parses", () => {
  const f = join(dir, "ok.json");
  writeFileSync(f, JSON.stringify({ intents: {} }));
  assert.deepEqual(loadJson(f, null), { intents: {} });
});

test("garbage throws CorruptStoreError, never a blank", () => {
  const f = join(dir, "bad.json");
  writeFileSync(f, "{not json");
  assert.throws(() => loadJson(f, { intents: {} }), CorruptStoreError);
  try {
    loadJson(f, {});
    assert.fail("must throw");
  } catch (e) {
    assert.equal(e.name, "CorruptStoreError");
    assert.equal(e.code, "CORRUPT_STORE");
    assert.equal(e.path, f);
    assert.equal(isCorruptStoreError(e), true);
  }
});

test("empty and truncated files throw", () => {
  const e1 = join(dir, "empty.json");
  writeFileSync(e1, "");
  assert.throws(() => loadJson(e1, {}), CorruptStoreError);
  const e2 = join(dir, "cut.json");
  writeFileSync(e2, '{"subs": {"a": 1');
  assert.throws(() => loadJson(e2, {}), CorruptStoreError);
});

test("unreadable path throws CorruptStoreError", () => {
  assert.throws(() => loadJson(dir, {}), CorruptStoreError); // reading a directory fails
  assert.equal(isCorruptStoreError(new Error("x")), false);
  assert.equal(isCorruptStoreError(null), false);
  assert.equal(CORRUPT_STORE, "corrupt_store");
});

test("checkAmountCents validates integer cents, fail-closed", () => {
  assert.deepEqual(checkAmountCents(3900), { ok: true, cents: 3900 });
  assert.deepEqual(checkAmountCents("100"), { ok: true, cents: 100 });
  assert.equal(checkAmountCents(0).error, "bad_amount");
  assert.equal(checkAmountCents(-5).error, "bad_amount");
  assert.equal(checkAmountCents(NaN).error, "bad_amount");
  assert.equal(checkAmountCents(Infinity).error, "bad_amount");
  assert.equal(checkAmountCents("nope").error, "bad_amount");
  assert.equal(checkAmountCents(undefined).error, "bad_amount");
  assert.deepEqual(checkAmountCents(0, { min: 0 }), { ok: true, cents: 0 });
});

console.log("failclosed-store OK");
