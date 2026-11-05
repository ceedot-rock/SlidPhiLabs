/** Network health tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createHealthChecker,
  probeDigestsVerify,
  probeLedgerWritable,
  resolveDataDir,
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
  const h = createHealthChecker({ nowMs, fs, dataDir: "/data" });
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

test("probeLedgerWritable exercises the live volume, not tmpdir", () => {
  const mem = {};
  const fs = {
    writeFileSync: (p, s) => {
      mem[p] = s;
    },
    readFileSync: (p) => mem[p],
    unlinkSync: () => {},
  };
  const probed = probeLedgerWritable({ fs, dataDir: "/data" });
  assert.equal(probed.ok, true);
  assert.equal(probed.dir, "/data");
  assert.ok(
    Object.keys(mem).every((p) => p.replace(/\\/g, "/").startsWith("/data/")),
    JSON.stringify(Object.keys(mem)),
  );
  assert.equal(
    probeLedgerWritable({ fs: { ...fs, readFileSync: () => "corrupt" }, dataDir: "/data" }).ok,
    false,
  );
});

test("resolveDataDir prefers dataDir, then DATA_DIR env, then /data", () => {
  assert.equal(resolveDataDir({ dataDir: "/vol" }), "/vol");
  assert.equal(resolveDataDir({ tmpDir: "/legacy" }), "/legacy");
  assert.equal(resolveDataDir({}), "/data");
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
