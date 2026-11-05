import test from "node:test";
import assert from "node:assert/strict";
import { createMessageTransport } from "./message-transport.mjs";

function transport(over = {}) {
  let n = 0;
  return createMessageTransport({
    dir: "q",
    idFn: () => `ack-${++n}`,
    nowFn: () => 1000,
    routes: { alice: "bob" },
    ...over,
  });
}

test("enqueue -> deliver routes sender to recipient inbox", () => {
  const t = transport();
  const { ack_id } = t.enqueue({ from: "alice", body: "hi" });
  assert.equal(typeof ack_id, "string");
  const d = t.deliver();
  assert.deepEqual(d.delivered, [{ ack_id, recipient: "bob" }]);
  assert.equal(t.inbox("bob").messages[0].body, "hi");
  assert.equal(t.inbox("alice").messages.length, 0);
});

test("at-least-once: redelivers until ack", () => {
  const t = transport();
  const { ack_id } = t.enqueue({ from: "alice", body: "hi" });
  t.deliver();
  assert.equal(t.deliver().delivered.length, 1); // still pending -> redelivered
  assert.equal(t.ack(ack_id).ok, true);
  assert.equal(t.deliver().delivered.length, 0);
  assert.deepEqual(t.pending().pending, []);
});

test("bad message, bad recipient, unknown ack fail closed", () => {
  const t = transport();
  assert.equal(t.enqueue({}).reason, "bad_message");
  assert.equal(t.inbox("").reason, "bad_recipient");
  assert.equal(t.ack("missing").reason, "unknown_ack_id");
  assert.equal(t.ack("").reason, "bad_ack_id");
});

test("unrouted sender falls back to own inbox", () => {
  const t = transport({ routes: {} });
  const { ack_id } = t.enqueue({ from: "cara", body: "yo" });
  assert.deepEqual(t.deliver().delivered, [{ ack_id, recipient: "cara" }]);
});
