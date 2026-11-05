/** Depot receipts. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildDepotReceipt,
  verifyDepotReceipt,
  defaultDepotPrice,
  DEPOT_FREE_BYTES,
} from "./depot-receipts.mjs";

const SHA = "ab".repeat(32);
const TEAM = "acme";

test("publish receipt carries surface, hashes, bytes, zero quote under free tier", () => {
  const r = buildDepotReceipt({ op: "publish", team: TEAM, sha256: SHA, bytes: 100 });
  assert.equal(r.surface, "gitdepot");
  assert.equal(r.op, "publish");
  assert.equal(r.blob_sha256, SHA);
  assert.match(r.team_sha, /^[0-9a-f]{64}$/);
  assert.equal(r.bytes, 100);
  assert.equal(r.quoted_cents, 0);
});

test("team_sha is deterministic per team", () => {
  const a = buildDepotReceipt({ op: "join", team: TEAM, sha256: SHA, bytes: 0 });
  const b = buildDepotReceipt({ op: "join", team: TEAM, sha256: SHA, bytes: 0 });
  const c = buildDepotReceipt({ op: "join", team: "other", sha256: SHA, bytes: 0 });
  assert.equal(a.team_sha, b.team_sha);
  assert.notEqual(a.team_sha, c.team_sha);
});

test("default price is $0.10/GB over 10GB, rounded up", () => {
  assert.equal(defaultDepotPrice(DEPOT_FREE_BYTES), 0);
  assert.equal(defaultDepotPrice(DEPOT_FREE_BYTES + 1), 10);
  assert.equal(defaultDepotPrice(DEPOT_FREE_BYTES + 1_000_000_000), 10);
  assert.equal(defaultDepotPrice(DEPOT_FREE_BYTES + 1_000_000_001), 20);
});

test("large publish quotes overage via default priceFn", () => {
  const r = buildDepotReceipt({
    op: "publish",
    team: TEAM,
    sha256: SHA,
    bytes: DEPOT_FREE_BYTES + 2_000_000_000,
  });
  assert.equal(r.quoted_cents, 20);
});

test("injectable priceFn overrides the quote", () => {
  const r = buildDepotReceipt(
    { op: "publish", team: TEAM, sha256: SHA, bytes: 100 },
    { priceFn: () => 42 }
  );
  assert.equal(r.quoted_cents, 42);
});

test("bad priceFn output fails closed", () => {
  assert.equal(
    buildDepotReceipt(
      { op: "publish", team: TEAM, sha256: SHA, bytes: 1 },
      { priceFn: () => -5 }
    ),
    null
  );
  assert.equal(
    buildDepotReceipt(
      { op: "publish", team: TEAM, sha256: SHA, bytes: 1 },
      {
        priceFn: () => {
          throw new Error("down");
        },
      }
    ),
    null
  );
});

test("malformed inputs fail closed to null", () => {
  assert.equal(buildDepotReceipt(null), null);
  assert.equal(
    buildDepotReceipt({ op: "rm", team: TEAM, sha256: SHA, bytes: 1 }),
    null
  );
  assert.equal(
    buildDepotReceipt({ op: "publish", team: "", sha256: SHA, bytes: 1 }),
    null
  );
  assert.equal(
    buildDepotReceipt({ op: "publish", team: TEAM, sha256: "zz", bytes: 1 }),
    null
  );
  assert.equal(
    buildDepotReceipt({ op: "publish", team: TEAM, sha256: SHA, bytes: -1 }),
    null
  );
  assert.equal(
    buildDepotReceipt({ op: "publish", team: TEAM, sha256: SHA, bytes: 1.5 }),
    null
  );
});

test("verify recomputes quote and rebinds team", () => {
  const r = buildDepotReceipt({ op: "evict", team: TEAM, sha256: SHA, bytes: 5 });
  assert.deepEqual(verifyDepotReceipt(r), { ok: true });
  assert.deepEqual(verifyDepotReceipt(r, { team: TEAM }), { ok: true });
  assert.equal(verifyDepotReceipt(r, { team: "impostor" }).ok, false);
  assert.equal(
    verifyDepotReceipt({ ...r, quoted_cents: r.quoted_cents + 1 }).ok,
    false
  );
  assert.equal(verifyDepotReceipt({ ...r, surface: "x" }).ok, false);
  assert.equal(verifyDepotReceipt(null).ok, false);
});

test("verify honors injected priceFn on both sides", () => {
  const priceFn = () => 7;
  const r = buildDepotReceipt(
    { op: "publish", team: TEAM, sha256: SHA, bytes: 1 },
    { priceFn }
  );
  assert.deepEqual(verifyDepotReceipt(r, { priceFn }), { ok: true });
  assert.equal(verifyDepotReceipt(r).ok, false);
});
