import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "warrant-"));
process.env.WARRANT_DIR = dir;
process.env.WARRANT_SECRET = "test-warrant-secret-32bytes-min";

const {
  hostAllowed,
  issueWarrant,
  verifyWarrant,
  fileReceipt,
  revokeWarrant,
  getWarrant,
  listReceipts,
} = await import("./warrant.mjs");

test("host allowlist", () => {
  assert.equal(hostAllowed(["www.slidphilabs.com"], "www.slidphilabs.com"), true);
  assert.equal(hostAllowed(["www.slidphilabs.com"], "evil.example"), false);
  assert.equal(hostAllowed(["*"], "anything.test"), true);
  assert.equal(hostAllowed([".slidphilabs.com"], "api.slidphilabs.com"), true);
});

test("demo issue + receipt + budget", () => {
  const issued = issueWarrant({ demo: true, max_usd: 1, max_calls: 2, ttl_seconds: 120 });
  assert.equal(issued.ok, true);
  assert.match(issued.token, /^w1\./);
  assert.equal(issued.warrant.agent_id, "demo");

  const ok = verifyWarrant(issued.token, { host: "www.slidphilabs.com", action: "invoke" });
  assert.equal(ok.ok, true);

  const blockedHost = verifyWarrant(issued.token, { host: "evil.example", action: "invoke" });
  assert.equal(blockedHost.ok, false);
  assert.equal(blockedHost.reason, "host_not_allowed");

  const r1 = fileReceipt({
    token: issued.token,
    action: "invoke",
    host: "www.slidphilabs.com",
    usd: 0.4,
    request_sha256: "aa",
    result_sha256: "bb",
  });
  assert.equal(r1.ok, true);
  assert.equal(r1.receipt.warrant_id, issued.warrant.id);
  assert.ok(r1.warrant.remaining_usd < 1);

  const r2 = fileReceipt({
    token: issued.token,
    action: "invoke",
    host: "www.slidphilabs.com",
    usd: 0.8,
  });
  assert.equal(r2.ok, false);
  assert.equal(r2.reason, "usd_exhausted");

  const r3 = fileReceipt({
    token: issued.token,
    action: "invoke",
    host: "www.slidphilabs.com",
    usd: 0.2,
  });
  assert.equal(r3.ok, true);
  assert.equal(r3.warrant.remaining_calls, 0);

  const r4 = fileReceipt({
    token: issued.token,
    action: "invoke",
    host: "www.slidphilabs.com",
    usd: 0,
  });
  assert.equal(r4.ok, false);
  assert.equal(r4.reason, "calls_exhausted");

  const listed = listReceipts(issued.warrant.id);
  assert.equal(listed.ok, true);
  assert.equal(listed.receipts.length, 2);

  const rev = revokeWarrant(issued.token);
  assert.equal(rev.ok, true);
  const after = verifyWarrant(issued.token, { host: "www.slidphilabs.com", action: "invoke" });
  assert.equal(after.ok, false);
  assert.equal(after.reason, "revoked");

  const pub = getWarrant(issued.warrant.id);
  assert.equal(pub.ok, true);
  assert.equal(pub.warrant.revoked, true);
});

test("tamper fails", () => {
  const issued = issueWarrant({ demo: true, ttl_seconds: 60 });
  const bad = issued.token.slice(0, -2) + "xx";
  const v = verifyWarrant(bad);
  assert.equal(v.ok, false);
});
