/**
 * consolidator.mjs — offline unit tests (node:crypto only, no I/O).
 * Covers the CLS slow loop: access/versioning, Ebbinghaus heat,
 * distill/board ordering, content-addressed seal, verify, JSON roundtrip.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createStore,
  recordAccess,
  heat,
  distillCandidates,
  boardKeep,
  sealRecord,
  verifyIndex,
  toJSON,
  fromJSON,
  sha256Hex,
  SERVICE,
  DEFAULT_HALF_LIFE_DAYS,
} from "./consolidator.mjs";

const DAY = 86_400_000;

test("createStore starts empty", () => {
  const s = createStore();
  assert.deepEqual(s.slices, {});
  assert.deepEqual(s.sealed, {});
  assert.deepEqual(s.log, []);
});

test("recordAccess counts uses and versions recalls", () => {
  const s = createStore();
  const first = recordAccess(s, "a", 1000);
  assert.equal(first.uses, 1);
  assert.equal(first.version, 1, "first touch does not version");
  const second = recordAccess(s, "a", 2000);
  assert.equal(second.uses, 2);
  assert.equal(second.version, 2, "every recall rewrites (reconsolidation)");
  assert.equal(s.log.length, 2);
});

test("heat decays untouched slices by half-life", () => {
  const hot = { uses: 4, last: 1000, version: 1 };
  assert.equal(heat(hot, 1000), 4);
  assert.equal(heat(hot, 1000 + DEFAULT_HALF_LIFE_DAYS * DAY), 2);
  assert.ok(heat(hot, 1000 + 8 * DAY) < heat(hot, 1000 + 1 * DAY));
});

test("distillCandidates returns coldest-first, boardKeep hottest-first", () => {
  const s = createStore();
  const now = 50 * DAY;
  recordAccess(s, "cold", now - 40 * DAY);
  for (let i = 0; i < 5; i++) recordAccess(s, "hot", now - i * 1000);
  const distill = distillCandidates(s, 5, now).map((c) => c.id);
  const keep = boardKeep(s, 5, now).map((c) => c.id);
  assert.equal(distill[0], "cold");
  assert.equal(keep[0], "hot");
  assert.equal(distillCandidates(s, 0, now).length, 0);
  assert.equal(boardKeep(s, 1, now).length, 1);
});

test("sealRecord is content-addressed and deduplicating", () => {
  const s = createStore();
  const a1 = sealRecord(s, Buffer.from("same"), 1000);
  const a2 = sealRecord(s, Buffer.from("same"), 2000);
  assert.equal(a1, a2, "same bytes yield the same address");
  assert.match(a1, /^[0-9a-f]{64}$/);
  assert.equal(s.sealed[a1].refs, 2);
  assert.equal(s.sealed[a1].bytes, 4);
  const other = sealRecord(s, "different");
  assert.notEqual(other, a1);
});

test("sha256Hex matches the known vector", () => {
  assert.equal(
    sha256Hex(Buffer.from("abc")),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
  );
});

test("verifyIndex passes clean and flags bad addresses", () => {
  const s = createStore();
  sealRecord(s, "ok");
  const clean = verifyIndex(s);
  assert.equal(clean.ok, true);
  assert.equal(clean.records, 1);
  s.sealed.not_an_address = { bytes: 1, at: 0, refs: 1 };
  const dirty = verifyIndex(s);
  assert.equal(dirty.ok, false);
  assert.deepEqual(dirty.bad, ["not_an_address"]);
});

test("toJSON/fromJSON roundtrips; fromJSON rejects bad stores", () => {
  const s = createStore();
  recordAccess(s, "a", 1000);
  sealRecord(s, "bytes", 1000);
  const back = fromJSON(toJSON(s));
  assert.deepEqual(back.slices, s.slices);
  assert.deepEqual(Object.keys(back.sealed), Object.keys(s.sealed));
  assert.throws(() => fromJSON("{}"), /bad consolidator store/);
  assert.throws(() => fromJSON("null"), /bad consolidator store/);
});

test("module constants", () => {
  assert.equal(SERVICE, "SPL Consolidator");
  assert.equal(DEFAULT_HALF_LIFE_DAYS, 7);
});
