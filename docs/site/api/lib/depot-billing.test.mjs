/** Depot billing. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildMonthlyInvoice,
  buildMonthlyInvoiceAsync,
} from "./depot-billing.mjs";
import { buildDepotReceipt } from "./depot-receipts.mjs";
import { DEPOT_FREE_BYTES } from "./depot-receipts.mjs";

const SHA = "cd".repeat(32);

function rcp(bytes, op = "publish") {
  return buildDepotReceipt({ op, team: "acme", sha256: SHA, bytes });
}

test("free tier invoice is zero within 10GB and 3 seats", () => {
  const inv = buildMonthlyInvoice(
    { team: "acme", month: "2026-11", receipts: [rcp(100), rcp(200)] },
    { seats: 3 }
  );
  assert.equal(inv.team, "acme");
  assert.equal(inv.pooled_gb, 300 / 1_000_000_000);
  assert.equal(inv.overage_gb, 0);
  assert.equal(inv.amount_cents, 0);
});

test("overage bills $0.10/GB rounded up above the seat minimum", () => {
  const inv = buildMonthlyInvoice(
    {
      team: "acme",
      month: "2026-11",
      receipts: [rcp(DEPOT_FREE_BYTES), rcp(200_000_000_000)],
    },
    { seats: 1 }
  );
  assert.equal(inv.overage_gb, 200);
  assert.equal(inv.amount_cents, 2000);
});

test("$15 seat minimum floors small overages and extra seats", () => {
  const over = buildMonthlyInvoice(
    { team: "acme", month: "2026-11", receipts: [rcp(DEPOT_FREE_BYTES + 1)] },
    { seats: 1 }
  );
  assert.equal(over.amount_cents, 1500);
  const seats = buildMonthlyInvoice(
    { team: "acme", month: "2026-11", receipts: [rcp(10)] },
    { seats: 4 }
  );
  assert.equal(seats.amount_cents, 1500);
});

test("injectable reader supplies the log", () => {
  const inv = buildMonthlyInvoice(
    { team: "acme", month: "2026-11" },
    { seats: 3, readReceipts: () => [rcp(50)] }
  );
  assert.equal(inv.pooled_gb, 50 / 1_000_000_000);
  assert.equal(inv.amount_cents, 0);
});

test("async reader works via async builder", async () => {
  const inv = await buildMonthlyInvoiceAsync(
    { team: "acme", month: "2026-11" },
    { seats: 3, readReceipts: async () => [rcp(50)] }
  );
  assert.equal(inv.amount_cents, 0);
});

test("bad receipts and bad inputs fail closed to null", async () => {
  assert.equal(buildMonthlyInvoice(null), null);
  assert.equal(
    buildMonthlyInvoice({ team: "", month: "2026-11", receipts: [] }),
    null
  );
  assert.equal(
    buildMonthlyInvoice({ team: "acme", month: "november", receipts: [] }),
    null
  );
  assert.equal(buildMonthlyInvoice({ team: "acme", month: "2026-11" }), null);
  assert.equal(
    buildMonthlyInvoice(
      { team: "acme", month: "2026-11", receipts: [{ nope: 1 }] },
      { seats: 0 }
    ),
    null
  );
  assert.equal(
    buildMonthlyInvoice(
      { team: "acme", month: "2026-11", receipts: [rcp(1)] },
      { seats: -1 }
    ),
    null
  );
  assert.equal(
    buildMonthlyInvoice(
      { team: "acme", month: "2026-11" },
      {
        seats: 0,
        readReceipts: () => {
          throw new Error("down");
        },
      }
    ),
    null
  );
  assert.equal(
    await buildMonthlyInvoiceAsync(
      { team: "acme", month: "2026-11" },
      { readReceipts: async () => "not-a-log" }
    ),
    null
  );
});
