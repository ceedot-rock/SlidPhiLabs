/** Usage meter lifetime tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  identityFromReq,
  readUsage,
  addUsage,
  meterSnapshot,
  monthKey,
} from "./usage-meter.mjs";
import { FREE_BYTES } from "../suite-pricing.js";

process.env.AUTH_DIR = mkdtempSync(join(tmpdir(), "usage-lifetime-test-"));

const ipReq = (ip) => ({ headers: { "x-forwarded-for": ip } });

test("free IP quota does not reset next month", () => {
  const req = ipReq("203.0.113.7");
  const id = identityFromReq(req);
  assert.equal(id.key, "ip:203.0.113.7");
  addUsage(id.key, FREE_BYTES);
  const thisMonth = monthKey();
  const nextMonth = monthKey(new Date(Date.now() + 32 * 86400 * 1000));
  assert.notEqual(thisMonth, nextMonth);
  assert.equal(readUsage(id.key).bytes, FREE_BYTES);
  assert.equal(readUsage(id.key, nextMonth).bytes, FREE_BYTES);
  const snap = meterSnapshot(req, 1);
  assert.equal(snap.over, true);
  assert.equal(snap.would_charge.free, false);
});

test("different IPs are isolated, seats stay monthly", () => {
  const a = identityFromReq(ipReq("198.51.100.9"));
  const b = identityFromReq(ipReq("198.51.100.10"));
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
