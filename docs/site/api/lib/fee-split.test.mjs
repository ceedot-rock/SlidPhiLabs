import test from "node:test";
import assert from "node:assert/strict";
import { splitSchedule, splitScheduleMany, DEFAULT_LAB_BPS } from "./fee-split.mjs";

test("default 250bps split", () => {
  const r = splitSchedule({ amount_cents: 1000 });
  assert.equal(r.ok, true);
  assert.equal(r.lab_bps, DEFAULT_LAB_BPS);
  assert.equal(r.lab_cents, 25);
  assert.equal(r.operator_cents, 975);
});

test("parts always sum exactly (no dust loss)", () => {
  for (const amount of [1, 2, 3, 7, 99, 999, 1001, 123456]) {
    for (const bps of [0, 1, 250, 3333, 9999, 10000]) {
      const r = splitSchedule({ amount_cents: amount, lab_bps: bps });
      assert.equal(r.ok, true);
      assert.equal(r.lab_cents + r.operator_cents, amount, `dust at ${amount}/${bps}`);
    }
  }
  // Remainder goes to operator: 999c at 250bps floors lab to 24, op keeps 975.
  const r = splitSchedule({ amount_cents: 999, lab_bps: 250 });
  assert.equal(r.lab_cents, 24);
  assert.equal(r.operator_cents, 975);
});

test("bps boundaries", () => {
  assert.equal(splitSchedule({ amount_cents: 500, lab_bps: 0 }).lab_cents, 0);
  assert.equal(splitSchedule({ amount_cents: 500, lab_bps: 0 }).operator_cents, 500);
  assert.equal(splitSchedule({ amount_cents: 500, lab_bps: 10000 }).lab_cents, 500);
  assert.equal(splitSchedule({ amount_cents: 500, lab_bps: 10000 }).operator_cents, 0);
  assert.equal(splitSchedule({ amount_cents: 500, lab_bps: 10001 }).error, "bad_bps");
  assert.equal(splitSchedule({ amount_cents: 500, lab_bps: -1 }).error, "bad_bps");
  assert.equal(splitSchedule({ amount_cents: 0 }).error, "bad_amount");
  assert.equal(splitSchedule({}).error, "bad_amount");
});

test("multi-party split absorbs dust into operator residual", () => {
  const r = splitScheduleMany({
    amount_cents: 1000,
    splits: [{ id: "lab", bps: 250 }, { id: "referrer", bps: 100 }],
  });
  assert.equal(r.ok, true);
  assert.equal(r.parts[0].cents, 25);
  assert.equal(r.parts[1].cents, 10);
  assert.equal(r.operator_cents, 965);
  assert.equal(r.parts.reduce((n, p) => n + p.cents, 0) + r.operator_cents, 1000);
  assert.equal(splitScheduleMany({ amount_cents: 100, splits: [{ id: "a", bps: 6000 }, { id: "b", bps: 5000 }] }).error, "bps_overflow");
  assert.equal(splitScheduleMany({ amount_cents: 100, splits: [] }).error, "bad_splits");
});
