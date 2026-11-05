/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * Tests for lib/sub-riders.mjs — deterministic, no network.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  issueSubRider,
  verifySubRider,
  revokeSubRider,
  deriveSubRiderId,
  scopeHash,
  createFileMapStore,
  SUB_RIDER_PREFIX,
} from "./sub-riders.mjs";

const SCOPE = Object.freeze({ spendCapCents: 500, crossings: ["spend", "fetch"] });

function adapters() {
  return { store: new Map() };
}

test("issues a deterministic child id bound to parent + scope", () => {
  const r = issueSubRider({ parent_rider: "sr_root", scope: { ...SCOPE } }, adapters());
  assert.equal(r.ok, true);
  assert.match(r.receipt.rider_id, new RegExp(`^${SUB_RIDER_PREFIX}[0-9a-f]{24}$`));
  assert.equal(r.receipt.rider_id, deriveSubRiderId("sr_root", SCOPE));
  assert.equal(r.receipt.parent_rider, "sr_root");
  assert.equal(r.receipt.scope_hash, scopeHash(SCOPE));
});

test("identical input yields the identical child (crossing order irrelevant)", () => {
  const a = adapters();
  const r1 = issueSubRider({ parent_rider: "sr_root", scope: { ...SCOPE } }, a);
  const r2 = issueSubRider(
    { parent_rider: "sr_root", scope: { spendCapCents: 500, crossings: ["fetch", "spend"] } },
    a
  );
  assert.equal(r1.receipt.rider_id, r2.receipt.rider_id);
  const r3 = issueSubRider({ parent_rider: "sr_root", scope: { spendCapCents: 600, crossings: ["spend"] } }, a);
  assert.notEqual(r3.receipt.rider_id, r1.receipt.rider_id);
});

test("fail-closed on missing parent and bad scopes", () => {
  const a = adapters();
  assert.equal(issueSubRider({ scope: { ...SCOPE } }, a).reason, "missing_parent_rider");
  assert.equal(issueSubRider({ parent_rider: "sr_root" }, a).reason, "bad_scope");
  assert.equal(
    issueSubRider({ parent_rider: "sr_root", scope: { spendCapCents: 0, crossings: ["x"] } }, a).reason,
    "bad_scope"
  );
  assert.equal(
    issueSubRider({ parent_rider: "sr_root", scope: { spendCapCents: 5, crossings: [] } }, a).reason,
    "bad_scope"
  );
});

test("verify walks through nested children to the external root", () => {
  const a = adapters();
  const c1 = issueSubRider({ parent_rider: "sr_root", scope: { ...SCOPE } }, a);
  const c2 = issueSubRider(
    { parent_rider: c1.receipt.rider_id, scope: { spendCapCents: 100, crossings: ["fetch"] } },
    a
  );
  const v = verifySubRider(c2.receipt.rider_id, a);
  assert.equal(v.ok, true);
  assert.equal(v.root, "sr_root");
  assert.deepEqual(v.chain, ["sr_root", c1.receipt.rider_id, c2.receipt.rider_id]);
  assert.deepEqual(v.scope, { spendCapCents: 100, crossings: ["fetch"] });
});

test("revoking a parent kills the whole subtree", () => {
  const a = adapters();
  const c1 = issueSubRider({ parent_rider: "sr_root", scope: { ...SCOPE } }, a);
  const c2 = issueSubRider(
    { parent_rider: c1.receipt.rider_id, scope: { spendCapCents: 100, crossings: ["fetch"] } },
    a
  );
  assert.equal(revokeSubRider(c1.receipt.rider_id, a).ok, true);
  assert.equal(verifySubRider(c1.receipt.rider_id, a).reason, "revoked");
  const v = verifySubRider(c2.receipt.rider_id, a);
  assert.equal(v.ok, false);
  assert.equal(v.reason, "revoked_ancestor");
  // The untouched sibling subtree still verifies.
  const c3 = issueSubRider({ parent_rider: "sr_root", scope: { spendCapCents: 50, crossings: ["fetch"] } }, a);
  assert.equal(verifySubRider(c3.receipt.rider_id, a).ok, true);
});

test("file-backed store option persists the subtree across instances", () => {
  const file = join(mkdtempSync(join(tmpdir(), "sub-test-")), "subs.json");
  const a = { store: createFileMapStore({ file }) };
  const c1 = issueSubRider({ parent_rider: "sr_root", scope: { ...SCOPE } }, a);
  assert.equal(c1.ok, true);
  const b = { store: createFileMapStore({ file }) };
  const v = verifySubRider(c1.receipt.rider_id, b);
  assert.equal(v.ok, true);
  assert.equal(v.root, "sr_root");
});

test("verify fails closed on unknown and missing ids", () => {
  const a = adapters();
  assert.equal(verifySubRider("sub_deadbeefdeadbeefdeadbeef", a).reason, "unknown_rider");
  assert.equal(verifySubRider("", a).reason, "missing_rider_id");
  assert.equal(revokeSubRider("sub_deadbeefdeadbeefdeadbeef", a).reason, "unknown_rider");
});
