import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { signClaim } from "./x402-claim.mjs";
import { ownerFromReq, meterSnapshot, OWNER_INCLUDED_BYTES } from "./usage-meter.mjs";

process.env.X402_CLAIM_SECRET = "test-owner-secret";
process.env.AUTH_DIR = mkdtempSync(join(tmpdir(), "usage-owner-test-"));

const req = (headers) => ({ headers });
function claimReq(email) {
  const s = signClaim({ order_id: "ord-owner-1", sku: "gc-month", email, tx: "owner-gratis", network: "owner", amount_cents: 0 });
  assert.equal(s.ok, true);
  return req({ authorization: "Bearer " + s.token });
}

test("owner claim email bypasses meter", () => {
  assert.equal(ownerFromReq(claimReq("corey@slidphilabs.com")), true);
  assert.equal(ownerFromReq(claimReq("  CEEDOTROCK@GMAIL.COM ")), true);
  const snap = meterSnapshot(claimReq("ptasz13@hotmail.com"), 10 * 1024 * 1024 * 1024);
  assert.equal(snap.identity, "owner");
  assert.equal(snap.included_bytes, OWNER_INCLUDED_BYTES);
  assert.equal(snap.over, false);
});

test("stranger claims and anonymous stay metered", () => {
  assert.equal(ownerFromReq(claimReq("someone@else.com")), false);
  assert.equal(ownerFromReq(req({})), false);
  assert.equal(ownerFromReq(req({ authorization: "Bearer garbage" })), false);
  const snap = meterSnapshot(req({}), 10 * 1024 * 1024 * 1024);
  assert.notEqual(snap.identity, "owner");
  assert.equal(snap.over, true);
});
