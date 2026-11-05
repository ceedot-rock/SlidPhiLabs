/** Network health tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createHealthChecker,
  probeDigestsVerify,
  probeLedgerWritable,
} from "./network-health.mjs";

let tick = 1_000;
const nowMs = () => tick;

test("default probes pass offline", async () => {
  const writes = {};
  const fs = {
    writeFileSync: (p, s) => {
      writes[p] = s;
    },
    readFileSync: (p) => writes[p],
    unlinkSync: (p) => {
      delete writes[p];
    },
  };
  const h = createHealthChecker({ nowMs, fs, tmpDir: "/tmp" });
  const r = await h.check();
  assert.equal(r.ok, true);
  assert.deepEqual(
    r.stages.map((s) => s.stage),
    ["ledger_writable", "digests_verify"],
  );
  for (const s of r.stages) {
    assert.equal(s.ok, true);
    assert.ok(s.ms >= 0);
  }
});

test("probeLedgerWritable round-trips through injectable fs", () => {
  const mem = {};
  const fs = {
    writeFileSync: (p, s) => {
      mem[p] = s;
    },
    readFileSync: (p) => mem[p],
    unlinkSync: () => {},
  };
  assert.equal(probeLedgerWritable({ fs, tmpDir: "/tmp" }).ok, true);
  assert.equal(
    probeLedgerWritable({ fs: { ...fs, readFileSync: () => "corrupt" }, tmpDir: "/tmp" }).ok,
    false,
  );
});

test("probeDigestsVerify checks stability and sensitivity", () => {
  const r = probeDigestsVerify();
  assert.equal(r.ok, true);
  assert.match(r.digest, /^[0-9a-f]{64}$/);
});

test("a throwing probe fails its stage but not the run", async () => {
  const h = createHealthChecker({
    nowMs,
    probes: {
      ledger_writable: () => ({ ok: true }),
      digests_verify: () => ({ ok: true }),
      flaky: () => {
        throw new Error("boom");
      },
      sad: () => ({ ok: false, error: "nope" }),
    },
  });
  const r = await h.check();
  assert.equal(r.ok, false);
  const byStage = Object.fromEntries(r.stages.map((s) => [s.stage, s]));
  assert.equal(byStage.flaky.ok, false);
  assert.equal(byStage.flaky.error, "boom");
  assert.equal(byStage.sad.error, "nope");
  assert.equal(byStage.ledger_writable.ok, true);
});

test("register validates input and adds stages", async () => {
  const h = createHealthChecker({ nowMs, probes: { ledger_writable: null, digests_verify: null } });
  assert.equal(h.register("", () => true).ok, false);
  assert.equal(h.register("x", "not-fn").ok, false);
  assert.equal(h.register("custom", () => true).ok, true);
  const r = await h.check();
  assert.equal(r.ok, true);
  assert.deepEqual(r.stages.map((s) => s.stage), ["custom"]);
});

test("async probes are awaited; falsy means failure", async () => {
  const h = createHealthChecker({
    nowMs,
    probes: {
      ledger_writable: null,
      digests_verify: null,
      slow: async () => ({ ok: true }),
      empty: () => 0,
    },
  });
  const r = await h.check();
  assert.equal(r.ok, false);
  assert.equal(r.stages[0].ok, true);
  assert.equal(r.stages[1].ok, false);
});
