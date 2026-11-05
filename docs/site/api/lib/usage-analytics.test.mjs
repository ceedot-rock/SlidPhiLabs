/** Usage analytics tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { rollupUsage, defaultFeeSchedule } from "./usage-analytics.mjs";

test("default fee schedule reads platform_fee_cents ?? fee_cents", () => {
  assert.equal(defaultFeeSchedule({ platform_fee_cents: 30, fee_cents: 5 }), 30);
  assert.equal(defaultFeeSchedule({ fee_cents: 5 }), 5);
  assert.equal(defaultFeeSchedule({}), 0);
  assert.equal(defaultFeeSchedule(null), 0);
});

test("rolls receipts up per tool and per rider", () => {
  const r = rollupUsage([
    { tool: "zelda", rider_id: "r1", amount_cents: 100, platform_fee_cents: 10 },
    { tool: "zelda", rider_id: "r1", amount_cents: 200, platform_fee_cents: 20 },
    { tool: "mario", operator: "op1", amount_cents: 50 },
  ]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.by_tool.zelda, { runs: 2, revenue_cents: 300, margin_cents: 270 });
  assert.deepEqual(r.by_tool.mario, { runs: 1, revenue_cents: 50, margin_cents: 50 });
  assert.deepEqual(r.by_rider.r1, { runs: 2, revenue_cents: 300, margin_cents: 270 });
  assert.deepEqual(r.by_rider.op1, { runs: 1, revenue_cents: 50, margin_cents: 50 });
  assert.equal(r.receipts, 3);
  assert.equal(r.skipped, 0);
});

test("custom feeSchedule adapter drives margin", () => {
  const r = rollupUsage([{ tool: "t", amount_cents: 100 }], {
    feeSchedule: () => 25,
  });
  assert.deepEqual(r.by_tool.t, { runs: 1, revenue_cents: 100, margin_cents: 75 });
});

test("usd receipts convert to cents; unknown shapes group honestly", () => {
  const r = rollupUsage([{ usd: 1.5 }, null, "nope"]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.by_tool.unknown, { runs: 1, revenue_cents: 150, margin_cents: 150 });
  assert.equal(r.receipts, 1);
  assert.equal(r.skipped, 2);
});

test("bad input fails closed", () => {
  assert.equal(rollupUsage("nope").error, "bad_receipts");
  assert.equal(rollupUsage(null).error, "bad_receipts");
  assert.equal(rollupUsage([], { feeSchedule: 42 }).error, "bad_fee_schedule");
  assert.equal(
    rollupUsage([{ amount_cents: 10 }], {
      feeSchedule: () => {
        throw new Error("pricing down");
      },
    }).error,
    "fee_failed",
  );
});
