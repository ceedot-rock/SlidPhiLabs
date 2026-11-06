/** Chamber seal stage tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sealEnvelope,
  openEnvelope,
  CHAMBER_MAGIC,
  CHAMBER_SEAL_VERSION,
} from "./chamber-seal.mjs";

const KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const OTHER = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";
const OBJ = { sku: "chamber-year", usd: 200, note: "two-key JSON seal" };

test("seal then open round-trips the object", () => {
  const env = sealEnvelope(OBJ, { keyHex: KEY });
  assert.equal(env.magic, CHAMBER_MAGIC);
  assert.equal(env.v, 1);
  assert.match(env.sha256, /^[0-9a-f]{64}$/);
  const out = openEnvelope(env, { keyHex: KEY });
  assert.equal(out.ok, true);
  assert.deepEqual(out.obj, OBJ);
});

test("tampered ciphertext fails closed", () => {
  const env = sealEnvelope(OBJ, { keyHex: KEY });
  const bad = { ...env, ct: env.ct.slice(0, -4) + "AAAA" };
  const out = openEnvelope(bad, { keyHex: KEY });
  assert.equal(out.ok, false);
});

test("wrong key fails closed", () => {
  const env = sealEnvelope(OBJ, { keyHex: KEY });
  const out = openEnvelope(env, { keyHex: OTHER });
  assert.equal(out.ok, false);
});

test("bad magic and version are refused", () => {
  const env = sealEnvelope(OBJ, { keyHex: KEY });
  assert.equal(openEnvelope({ ...env, magic: "NOPE" }, { keyHex: KEY }).ok, false);
  assert.equal(openEnvelope({ ...env, v: 99 }, { keyHex: KEY }).ok, false);
});

test("missing key fails closed on both ends", () => {
  assert.equal(sealEnvelope(OBJ, {}), null);
  const env = sealEnvelope(OBJ, { keyHex: KEY });
  assert.equal(openEnvelope(env, {}).ok, false);
});

test("version constant is pinned", () => {
  assert.match(CHAMBER_SEAL_VERSION, /^\d+\.\d+\.\d+$/);
});
