import test from "node:test";
import assert from "node:assert/strict";
import { createMessenger, digestEnvelope } from "./agent-messaging.mjs";

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
