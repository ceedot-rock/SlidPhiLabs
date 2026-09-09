import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { computeQuote } from "../src/quote.mjs";

const GiB = 1024 ** 3;

/** Same cases as cuni/examples/laws/suite-meter.cuni — the user's bill. */
const CASES = [
  { bytes: 0, expect: 0 },
  { bytes: 2 * GiB, expect: 0 },
  { bytes: 3 * GiB, expect: 100 },
  { bytes: 20 * GiB, expect: 144 },
];

test("JS quote matches CuNi suite-meter gold", () => {
  const got = CASES.map((c) => computeQuote({ bytes: c.bytes }).amount_cents);
  assert.deepEqual(got, CASES.map((c) => c.expect));
});

test("cuni prove suite-meter when cuni is on PATH", (t) => {
  const cuni = process.env.CUNI_BIN;
  if (!cuni) {
    t.skip("set CUNI_BIN to run live prove");
    return;
  }
  const printer = new URL("./print-suite-meter.mjs", import.meta.url);
  const law = process.env.CUNI_SUITE_METER_LAW;
  if (!law) {
    t.skip("set CUNI_SUITE_METER_LAW to the .cuni path");
    return;
  }
  const r = spawnSync(cuni, ["prove", law, "--against", printer.pathname], {
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr + r.stdout);
});
