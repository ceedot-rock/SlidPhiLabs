/** Usage meter lifetime tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  identityFromReq,
  identityDay,
  readUsage,
  addUsage,
  meterSnapshot,
  monthKey,
  ANON_KEY,
  ANON_INCLUDED_BYTES,
} from "./usage-meter.mjs";
import { FREE_BYTES } from "../suite-pricing.js";

process.env.AUTH_DIR = mkdtempSync(join(tmpdir(), "usage-lifetime-test-"));
process.env.USAGE_IDENTITY_SECRET = "test-identity-secret";

const ipReq = (ip) => ({ headers: { "x-forwarded-for": ip } });

test("IP identity is HMAC-bound, day-scoped, and never carries the raw IP", () => {
  const today = identityDay();
  const id = identityFromReq(ipReq("203.0.113.7"));
  assert.match(id.key, /^iph:\d{4}-\d{2}-\d{2}:[0-9a-f]{32}$/);
  assert.ok(!id.key.includes("203.0.113.7"), "raw IP must not appear in the key");
  assert.equal(identityFromReq(ipReq("203.0.113.7")).key, id.key);
  assert.equal(id.day, today);
  // Same header, next day -> different bucket (abuse expires with the day).
  const tomorrow = identityDay(new Date(Date.now() + 86400 * 1000));
  assert.notEqual(tomorrow, today);
  const rotated = identityFromReq(ipReq("203.0.113.7"), { day: tomorrow });
  assert.notEqual(rotated.key, id.key);
  assert.ok(!rotated.key.includes("203.0.113.7"));
});

test("free IP quota is enforced within the day bucket", () => {
  const req = ipReq("203.0.113.7");
  const id = identityFromReq(req);
  addUsage(id.key, FREE_BYTES);
  assert.equal(readUsage(id.key).bytes, FREE_BYTES);
  const snap = meterSnapshot(req, 1);
  assert.equal(snap.over, true);
  assert.equal(snap.would_charge.free, false);
  assert.equal(snap.window, "daily");
});

test("different IPs are isolated, seats stay monthly", () => {
  const a = identityFromReq(ipReq("198.51.100.9"));
  const b = identityFromReq(ipReq("198.51.100.10"));
  assert.notEqual(a.key, b.key);
  assert.equal(readUsage(b.key).bytes, 0);
  addUsage(a.key, 10);
  assert.equal(readUsage(b.key).bytes, 0);
  const seat = identityFromReq({
    headers: { "x-spl-seat": "pcc-pro", "x-spl-seat-id": "seat-1" },
  });
  assert.equal(seat.key, "seat:pcc-pro:seat-1");
  // Seat ledgers stay month-scoped: a fresh month reads zero without any writes.
  const nextMonth = monthKey(new Date(Date.now() + 32 * 86400 * 1000));
  assert.equal(readUsage(seat.key, nextMonth).bytes, 0);
  const snap = meterSnapshot(
    { headers: { "x-spl-seat": "pcc-pro", "x-spl-seat-id": "seat-1" } },
    0
  );
  assert.equal(snap.window, "calendar_month");
  assert.equal(snap.identity, "paid");
});

test("headerless requests share one low anon bucket", () => {
  const id = identityFromReq({ headers: {} });
  assert.equal(id.key, ANON_KEY);
  assert.equal(id.via, "anon");
  assert.equal(ANON_INCLUDED_BYTES, 10 * 1024 * 1024);
  const snap = meterSnapshot({ headers: {} }, 11 * 1024 * 1024);
  assert.equal(snap.identity, "anon");
  assert.equal(snap.included_bytes, ANON_INCLUDED_BYTES);
  assert.equal(snap.over, true);
});
