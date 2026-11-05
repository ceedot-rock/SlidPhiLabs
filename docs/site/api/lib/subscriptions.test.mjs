import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createSubscription,
  getSubscription,
  dueSubs,
  recordRenewal,
  prorateUpgrade,
  INTERVALS,
} from "./subscriptions.mjs";

const T0 = 1790000000000; // fixed epoch ms

function stubs(ids) {
  let i = 0;
  return { dir: mkdtempSync(join(tmpdir(), "subs-test-")), nowMs: () => T0, id: () => ids[i++] };
}

test("create fails closed on bad input", () => {
  const a = stubs(["sub_x"]);
  assert.equal(createSubscription({ rider_id: "", sku: "sku-1", amount_cents: 100 }, a).error, "bad_rider_id");
  assert.equal(createSubscription({ rider_id: "r1", sku: "", amount_cents: 100 }, a).error, "bad_sku");
  assert.equal(createSubscription({ rider_id: "r1", sku: "sku-1", interval: "week", amount_cents: 100 }, a).error, "bad_interval");
  assert.equal(createSubscription({ rider_id: "r1", sku: "sku-1", amount_cents: 0 }, a).error, "bad_amount");
  assert.equal(createSubscription({ rider_id: "r1", sku: "sku-1", amount_cents: -5 }, a).error, "bad_amount");
});

test("create returns sub_id + next_due one month out", () => {
  const a = stubs(["sub_1"]);
  const r = createSubscription({ rider_id: "rider-1", sku: "pro", amount_cents: 999 }, a);
  assert.equal(r.ok, true);
  assert.equal(r.sub_id, "sub_1");
  assert.equal(r.next_due, T0 + INTERVALS.month);
  assert.equal(r.sub.status, "active");
});

test("year interval uses 365-day window", () => {
  const a = stubs(["sub_y"]);
  const r = createSubscription({ rider_id: "r1", sku: "yr", interval: "year", amount_cents: 9999 }, a);
  assert.equal(r.ok, true);
  assert.equal(r.next_due, T0 + INTERVALS.year);
});

test("dueSubs lists only active subs past next_due", () => {
  const a = stubs(["sub_a", "sub_b"]);
  createSubscription({ rider_id: "r1", sku: "s", amount_cents: 100 }, a);
  createSubscription({ rider_id: "r2", sku: "s", amount_cents: 100 }, { ...a, id: () => "sub_b" });
  const early = dueSubs(T0, a);
  assert.equal(early.ok, true);
  assert.deepEqual(early.due.map((s) => s.sub_id), []);
  const late = dueSubs(T0 + INTERVALS.month + 1, a);
  assert.deepEqual(late.due.map((s) => s.sub_id).sort(), ["sub_a", "sub_b"]);
});

test("recordRenewal advances one interval; overdue restarts from now", () => {
  const a = stubs(["sub_r"]);
  createSubscription({ rider_id: "r1", sku: "s", amount_cents: 100 }, a);
  const onTime = recordRenewal({ sub_id: "sub_r" }, { ...a, nowMs: () => T0 });
  assert.equal(onTime.ok, true);
  assert.equal(onTime.next_due, T0 + 2 * INTERVALS.month);
  assert.equal(onTime.renewals, 1);
  const overdue = recordRenewal({ sub_id: "sub_r" }, { ...a, nowMs: () => T0 + 10 * INTERVALS.month });
  assert.equal(overdue.next_due, T0 + 11 * INTERVALS.month);
  assert.equal(recordRenewal({ sub_id: "sub_nope" }, a).error, "unknown_sub");
  assert.equal(getSubscription("sub_r", a).sub.next_due, T0 + 11 * INTERVALS.month);
});

test("corrupt ledger fails closed with corrupt_store, never saved over", () => {
  const a = stubs(["sub_c"]);
  const f = join(a.dir, "subs.json");
  writeFileSync(f, "{oops");
  assert.equal(createSubscription({ rider_id: "r1", sku: "s", amount_cents: 100 }, a).error, "corrupt_store");
  assert.equal(getSubscription("sub_c", a).error, "corrupt_store");
  assert.equal(dueSubs(T0, a).error, "corrupt_store");
  assert.equal(recordRenewal({ sub_id: "sub_c" }, a).error, "corrupt_store");
  assert.equal(readFileSync(f, "utf8"), "{oops");
});

test("prorateUpgrade math is exact integer cents", () => {
  // Half the month remains: credit 500 on old 1000 plan, charge 1000 on
  // new 2000 plan, 500 due now.
  const r = prorateUpgrade({
    old_amount_cents: 1000,
    new_amount_cents: 2000,
    next_due: T0 + INTERVALS.month,
    now_ms: T0 + INTERVALS.month / 2,
    period_ms: INTERVALS.month,
  });
  assert.equal(r.ok, true);
  assert.equal(r.credit_cents, 500);
  assert.equal(r.charge_cents, 1000);
  assert.equal(r.due_now_cents, 500);
  // Expired window: nothing remaining, nothing due.
  const z = prorateUpgrade({
    old_amount_cents: 1000,
    new_amount_cents: 2000,
    next_due: T0 - 1,
    now_ms: T0,
    period_ms: INTERVALS.month,
  });
  assert.equal(z.due_now_cents, 0);
  // Downgrade yields a negative due (credit owed to rider).
  const d = prorateUpgrade({
    old_amount_cents: 2000,
    new_amount_cents: 1000,
    next_due: T0 + INTERVALS.month,
    now_ms: T0 + INTERVALS.month / 2,
    period_ms: INTERVALS.month,
  });
  assert.equal(d.due_now_cents, -500);
  assert.equal(prorateUpgrade({ old_amount_cents: 0, new_amount_cents: 5, next_due: 1, now_ms: 0, period_ms: 1 }).error, "bad_old_amount");
  assert.equal(prorateUpgrade({ old_amount_cents: 5, new_amount_cents: 5, next_due: 1, now_ms: 0, period_ms: 0 }).error, "bad_period");
});
