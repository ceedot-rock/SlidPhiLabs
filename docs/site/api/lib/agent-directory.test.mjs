import test from "node:test";
import assert from "node:assert/strict";
import { createAgentDirectory } from "./agent-directory.mjs";

const agent = (over = {}) => ({
  rider_id: "rider-a",
  score: 80,
  specialties: ["compress"],
  endpoint: "https://a.example.com",
  ...over,
});

test("register + get round-trip", () => {
  const d = createAgentDirectory();
  assert.equal(d.register(agent()).ok, true);
  const got = d.get("rider-a");
  assert.equal(got.ok, true);
  assert.equal(got.agent.score, 80);
});

test("list sorted by score desc", () => {
  const d = createAgentDirectory();
  d.register(agent({ rider_id: "low", score: 10 }));
  d.register(agent({ rider_id: "high", score: 99 }));
  d.register(agent({ rider_id: "mid", score: 50 }));
  assert.deepEqual(d.list().map((a) => a.rider_id), ["high", "mid", "low"]);
});

test("unknown agent fail-closed, bad + duplicate rejected", () => {
  const d = createAgentDirectory();
  assert.equal(d.get("ghost").reason, "unknown_agent");
  assert.equal(d.register({ rider_id: "x" }).ok, false);
  assert.equal(d.register(agent()).ok, true);
  assert.equal(d.register(agent()).reason, "duplicate_agent");
});

test("benchhaus_score alias accepted, specialties sorted unique", () => {
  const d = createAgentDirectory();
  const r = d.register({
    rider_id: "r",
    benchhaus_score: 70,
    specialties: ["b", "a", "b"],
    endpoint: "https://r.example.com",
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.agent.specialties, ["a", "b"]);
});
