/** Founding grants: 10% of the first 100 ACN signups ride 6 months free.
 *  Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  issueFoundingGrant,
  foundingStatus,
  checkGrantSpend,
  FOUNDING_WINDOW,
  FOUNDING_GRANT_COUNT,
  GRANT_TERM_MS,
  GRANT_MONTHLY_BYTES,
  GRANT_MONTHLY_CAP_CENTS,
  FOUNDING_GRANTS_VERSION,
} from "./founding-grants.mjs";

const T0 = 1790000000000; // fixed epoch ms
const DAY = 24 * 60 * 60 * 1000;

function stubs() {
  return { dir: mkdtempSync(join(tmpdir(), "founding-test-")), nowMs: () => T0 };
}

test("window and grant counts are pinned", () => {
  assert.equal(FOUNDING_WINDOW, 100);
  assert.equal(FOUNDING_GRANT_COUNT, 10);
  assert.equal(GRANT_TERM_MS, 180 * DAY);
  assert.equal(GRANT_MONTHLY_BYTES, 10 * 1024 * 1024 * 1024);
  assert.equal(GRANT_MONTHLY_CAP_CENTS, 2500);
  assert.match(FOUNDING_GRANTS_VERSION, /^\d+\.\d+\.\d+$/);
});

test("issue fails closed on bad input", () => {
  const a = stubs();
  assert.equal(issueFoundingGrant({ seq: 0, rider_id: "r1" }, a).error, "bad_seq");
  assert.equal(issueFoundingGrant({ seq: -3, rider_id: "r1" }, a).error, "bad_seq");
  assert.equal(issueFoundingGrant({ seq: 1.5, rider_id: "r1" }, a).error, "bad_seq");
  assert.equal(issueFoundingGrant({ seq: 1, rider_id: "" }, a).error, "bad_rider_id");
  assert.equal(issueFoundingGrant({ seq: 1, rider_id: "r1!" }, a).error, "bad_rider_id");
});

test("signups past the window are refused", () => {
  const a = stubs();
  const r = issueFoundingGrant({ seq: 101, rider_id: "r101" }, a);
  assert.equal(r.ok, false);
  assert.equal(r.error, "outside_window");
});

test("in-window but ungranted signups get no seat", () => {
  const a = stubs();
  const r = issueFoundingGrant({ seq: 11, rider_id: "r11" }, a);
  assert.equal(r.ok, false);
  assert.equal(r.error, "not_founding");
  assert.equal(foundingStatus({ seq: 11 }, a).ok, false);
});

test("first ten signups get six months with caps", () => {
  const a = stubs();
  const r = issueFoundingGrant({ seq: 1, rider_id: "rider-1", email: "  Ada@Example.com " }, a);
  assert.equal(r.ok, true);
  assert.equal(r.grant.seq, 1);
  assert.equal(r.grant.rider_id, "rider-1");
  assert.equal(r.grant.email, "ada@example.com");
  assert.equal(r.grant.issued_ms, T0);
  assert.equal(r.grant.expires_ms, T0 + 180 * DAY);
  assert.equal(r.grant.caps.monthly_bytes, GRANT_MONTHLY_BYTES);
  assert.equal(r.grant.caps.monthly_cap_cents, GRANT_MONTHLY_CAP_CENTS);
  assert.equal(r.duplicate, false);
});

test("reissue to the same rider is idempotent", () => {
  const a = stubs();
  const first = issueFoundingGrant({ seq: 3, rider_id: "r3" }, a);
  const again = issueFoundingGrant({ seq: 3, rider_id: "r3" }, { ...a, nowMs: () => T0 + DAY });
  assert.equal(again.ok, true);
  assert.equal(again.duplicate, true);
  assert.equal(again.grant.issued_ms, first.grant.issued_ms);
});

test("a taken sequence refuses a different rider", () => {
  const a = stubs();
  issueFoundingGrant({ seq: 5, rider_id: "r5" }, a);
  const r = issueFoundingGrant({ seq: 5, rider_id: "rival" }, a);
  assert.equal(r.ok, false);
  assert.equal(r.error, "seq_taken");
});

test("status flips to expired past the term", () => {
  const a = stubs();
  issueFoundingGrant({ seq: 2, rider_id: "r2" }, a);
  const live = foundingStatus({ seq: 2 }, a);
  assert.equal(live.ok, true);
  assert.equal(live.active, true);
  const late = foundingStatus({ seq: 2 }, { ...a, nowMs: () => T0 + 180 * DAY + 1 });
  assert.equal(late.ok, true);
  assert.equal(late.active, false);
  assert.equal(foundingStatus({ seq: 9 }, a).error, "unknown_grant");
});

test("spend check enforces the monthly cap and the term", () => {
  const a = stubs();
  issueFoundingGrant({ seq: 4, rider_id: "r4" }, a);
  const ok = checkGrantSpend({ seq: 4, spent_cents: 100 }, a);
  assert.equal(ok.ok, true);
  assert.equal(ok.remaining_cents, 2400);
  const over = checkGrantSpend({ seq: 4, spent_cents: 2501 }, a);
  assert.equal(over.ok, false);
  assert.equal(over.error, "cap_exceeded");
  const late = checkGrantSpend({ seq: 4, spent_cents: 0 }, { ...a, nowMs: () => T0 + 180 * DAY + 1 });
  assert.equal(late.ok, false);
  assert.equal(late.error, "grant_expired");
});

test("FOUNDING_DIR override pins the ledger location", () => {
  const dir = mkdtempSync(join(tmpdir(), "founding-env-"));
  const prev = process.env.FOUNDING_DIR;
  process.env.FOUNDING_DIR = dir;
  try {
    const r = issueFoundingGrant({ seq: 8, rider_id: "r8" }, {});
    assert.equal(r.ok, true);
    assert.equal(readFileSync(join(dir, "grants.json"), "utf8").includes("r8"), true);
  } finally {
    if (prev === undefined) delete process.env.FOUNDING_DIR;
    else process.env.FOUNDING_DIR = prev;
  }
});

test("corrupt ledger fails closed and is never overwritten", () => {
  const a = stubs();
  issueFoundingGrant({ seq: 6, rider_id: "r6" }, a);
  const f = join(a.dir, "grants.json");
  const before = readFileSync(f, "utf8");
  writeFileSync(f, "{nope");
  const r = issueFoundingGrant({ seq: 7, rider_id: "r7" }, a);
  assert.equal(r.ok, false);
  assert.equal(r.error, "corrupt_store");
  assert.notEqual(readFileSync(f, "utf8"), before.replace("r6", "r7"));
});
