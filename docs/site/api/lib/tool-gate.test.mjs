import test from "node:test";
import assert from "node:assert/strict";
import { toolGate, toolOnly402 } from "./tool-gate.mjs";

const req = (headers) => ({ headers });

test("no credential -> denied", () => {
  assert.equal(toolGate(req({})).ok, false);
  assert.equal(toolGate(req({ authorization: "" })).ok, false);
});

test("any Bearer key -> tool-called via key", () => {
  const r = toolGate(req({ authorization: "Bearer ZRW-FREE-1" }));
  assert.equal(r.ok, true);
  assert.equal(r.via, "key");
});

test("X-API-Key -> tool-called via key", () => {
  const r = toolGate(req({ "x-api-key": "abc12345" }));
  assert.equal(r.ok, true);
  assert.equal(r.via, "key");
});

test("tiny garbage values do not pass", () => {
  assert.equal(toolGate(req({ authorization: "Bearer x" })).ok, false);
  assert.equal(toolGate(req({ "x-api-key": "x" })).ok, false);
});

test("malformed spl1 claim is not laundered into via-key", () => {
  // seatFromClaimHeader reports tokenPresent for spl1-looking input;
  // the endpoint must 401 on that before consulting the key path.
  const r = toolGate(req({ authorization: "Bearer spl1.bad" }));
  assert.equal(r.ok, false);
});

test("valid seat passes through as claim", () => {
  const r = toolGate(req({}), { ok: true, sku: "gc-day", seatId: "s1" });
  assert.equal(r.ok, true);
  assert.equal(r.via, "claim");
  assert.equal(r.sku, "gc-day");
});

test("402 body points at tools, pay, and key", () => {
  const b = toolOnly402();
  assert.equal(b.ok, false);
  assert.equal(b.error, "tool_called_only");
  assert.match(b.message, /MCP/);
  assert.match(b.message, /x402-products/);
  assert.match(b.message, /X-API-Key/);
});
