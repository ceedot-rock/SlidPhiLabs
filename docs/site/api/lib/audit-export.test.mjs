/** Audit export tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAuditPack, digestReceipt, stableStringify } from "./audit-export.mjs";

const READERS = {
  readIdentity: (id) => ({ id, kind: "rider" }),
  listRuns: (id) => [{ run_id: "run_0001", rider: id }],
  readSpend: () => ({ spend_cents: 250 }),
  listDisputes: () => [{ id: "d1" }],
  listReceipts: () => [{ id: "rcp_1", amount_cents: 40 }],
};

test("builds the single JSON doc from injected readers", async () => {
  const r = await buildAuditPack({ rider_id: "r1" }, { readers: READERS });
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.pack).sort(), [
    "disputes",
    "identity",
    "receipts_digests",
    "runs",
    "spend_cents",
  ]);
  assert.equal(r.pack.identity.id, "r1");
  assert.equal(r.pack.runs.length, 1);
  assert.equal(r.pack.spend_cents, 250);
  assert.equal(r.pack.disputes.length, 1);
  assert.equal(r.pack.receipts_digests.length, 1);
  assert.match(r.pack.receipts_digests[0], /^[0-9a-f]{64}$/);
  JSON.stringify(r.pack);
});

test("operator and operator_id aliases resolve identity", async () => {
  const a = await buildAuditPack({ operator: "op-7" }, { readers: READERS });
  const b = await buildAuditPack({ operator_id: "op-7" }, { readers: READERS });
  assert.equal(a.pack.identity.id, "op-7");
  assert.equal(b.pack.identity.id, "op-7");
});

test("missing identity is fail-closed", async () => {
  assert.equal((await buildAuditPack({}, { readers: READERS })).ok, false);
  assert.equal((await buildAuditPack(null, { readers: READERS })).ok, false);
  assert.equal((await buildAuditPack({ rider_id: "" }, { readers: READERS })).ok, false);
});

test("offline defaults yield an empty zero-spend pack", async () => {
  const r = await buildAuditPack({ rider_id: "ghost" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.pack.runs, []);
  assert.deepEqual(r.pack.disputes, []);
  assert.deepEqual(r.pack.receipts_digests, []);
  assert.equal(r.pack.spend_cents, 0);
});

test("reader faults are fail-closed, never partial", async () => {
  const bad = {
    ...READERS,
    readSpend: () => {
      throw new Error("ledger down");
    },
  };
  const r = await buildAuditPack({ rider_id: "r1" }, { readers: bad });
  assert.equal(r.ok, false);
  assert.ok(!("pack" in r));
});

test("bad reader shapes are fail-closed", async () => {
  const badRuns = { ...READERS, listRuns: () => ({}) };
  assert.equal((await buildAuditPack({ rider_id: "r1" }, { readers: badRuns })).error, "bad_runs");
  const badMoney = { ...READERS, readSpend: () => ({ spend_cents: -50 }) };
  const m = await buildAuditPack({ rider_id: "r1" }, { readers: badMoney });
  assert.equal(m.pack.spend_cents, 0);
});

test("digests are deterministic and key-order independent", () => {
  const a = digestReceipt({ x: 1, y: 2 });
  const b = digestReceipt({ y: 2, x: 1 });
  assert.equal(a, b);
  assert.equal(stableStringify({ b: 1, a: 2 }), '{"a":2,"b":1}');
});

test("async readers are supported", async () => {
  const readers = { ...READERS, readSpend: async () => ({ spend_cents: 99 }) };
  const r = await buildAuditPack({ rider_id: "r1" }, { readers });
  assert.equal(r.pack.spend_cents, 99);
});
