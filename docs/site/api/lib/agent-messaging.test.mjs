/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * Tests for lib/agent-messaging.mjs — deterministic, no network.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createMessenger,
  createFileNonceStore,
  digestEnvelope,
  signDigest,
} from "./agent-messaging.mjs";

const fields = () => ({
  from_rider: "rider-a",
  to_rider: "rider-b",
  offer: { sku: "gc-day", amount_cents: 100 },
  nonce: "n-1",
});

test("draft/quote carry digest, ack verifies", () => {
  const m = createMessenger();
  const d = m.draft(fields());
  assert.equal(d.ok, true);
  assert.equal(d.envelope.kind, "draft");
  assert.equal(d.envelope.digest, digestEnvelope(fields()));
  assert.equal("sig" in d.envelope, false);
  const q = m.quote({ ...fields(), nonce: "n-2" });
  assert.equal(q.envelope.kind, "quote");
  const ack = m.ack(d.envelope);
  assert.equal(ack.ok, true);
  assert.equal(ack.envelope.kind, "ack");
});

test("replay nonce rejected", () => {
  const m = createMessenger();
  const d = m.draft(fields()).envelope;
  assert.equal(m.ack(d).ok, true);
  const again = m.ack(d);
  assert.equal(again.ok, false);
  assert.equal(again.reason, "replay");
});

test("tampered digest fail-closed", () => {
  const m = createMessenger();
  const d = m.draft(fields()).envelope;
  const bad = m.ack({ ...d, offer: { sku: "gc-day", amount_cents: 999 } });
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, "bad_digest");
  assert.equal(m.ack({}).reason, "bad_envelope");
});

test("injectable store + hashFn adapters", () => {
  const mem = new Map();
  const store = { has: (n) => mem.has(n), add: (n) => void mem.set(n, 1) };
  const m = createMessenger({ store, hashFn: () => "fixed" });
  const d = m.draft(fields()).envelope;
  assert.equal(d.digest, "fixed");
  assert.equal(m.ack(d).ok, true);
  assert.equal(mem.has("n-1"), true);
  assert.equal(m.ack(d).reason, "replay");
});

test("HMAC keys authenticate the sender; forgeries fail closed", () => {
  const keys = new Map([["rider-a", "k-a-secret"]]);
  const m = createMessenger({ keys });
  const d = m.draft(fields());
  assert.equal(d.ok, true);
  assert.equal(d.envelope.sig, signDigest(d.envelope.digest, "k-a-secret"));
  assert.equal(m.ack(d.envelope).ok, true);
  // Forged sig on a fresh nonce fails with bad_signature, not replay.
  const forged = { ...m.draft({ ...fields(), nonce: "n-9" }).envelope, sig: "0".repeat(64) };
  const r = m.ack(forged);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "bad_signature");
  // Unknown sender never silently downgrades to digest-only.
  const stranger = createMessenger({ keys });
  assert.equal(stranger.draft({ ...fields(), from_rider: "rider-?", nonce: "n-x" }).reason, "unknown_rider");
});

test("file-backed nonce store rejects replays across restarts", () => {
  const dir = mkdtempSync(join(tmpdir(), "msg-nonce-"));
  const storePath = join(dir, "nonces.json");
  const m1 = createMessenger({ storePath });
  const d = m1.draft(fields()).envelope;
  assert.equal(m1.ack(d).ok, true);
  // A fresh messenger on the same file still remembers the nonce.
  const m2 = createMessenger({ storePath });
  assert.equal(m2.ack(d).reason, "replay");
  const store = createFileNonceStore(storePath);
  assert.equal(store.size(), 1);
  assert.equal(store.has("n-1"), true);
});
