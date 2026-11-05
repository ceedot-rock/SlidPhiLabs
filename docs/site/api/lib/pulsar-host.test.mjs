import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pulsarBin, pulsarEncode, pulsarDecode, looksPulsar } from "./pulsar-host.mjs";

const MISSING = "C:\\definitely-missing\\spl-test-pulsar-nope";

test("happy: pulsarBin honors env, defaults under cwd/bin", () => {
  const saved = process.env.PULSAR_BIN;
  process.env.PULSAR_BIN = MISSING;
  try {
    assert.equal(pulsarBin(), MISSING);
  } finally {
    if (saved === undefined) delete process.env.PULSAR_BIN;
    else process.env.PULSAR_BIN = saved;
  }
  assert.ok(pulsarBin().endsWith(path.join("bin", "pulsar")));
});

test("happy: looksPulsar recognizes frame magics only", () => {
  for (const magic of ["BW23", "BW22", "OZL2", "PZ22"]) {
    assert.equal(looksPulsar(Buffer.concat([Buffer.from(magic, "latin1"), Buffer.alloc(8)])), true);
  }
  assert.equal(looksPulsar(Buffer.from("SPLS00rest-of-frame")), false);
  assert.equal(looksPulsar(Buffer.alloc(0)), false);
  assert.equal(looksPulsar(null), false);
  assert.equal(looksPulsar(Buffer.from("BW2")), false);
});

test("fail-closed: missing binary rejects loudly, never silent success", async () => {
  const saved = process.env.PULSAR_BIN;
  process.env.PULSAR_BIN = MISSING;
  try {
    await assert.rejects(() => pulsarEncode(Buffer.from("hello pulsar")), /ENOENT/);
    await assert.rejects(() => pulsarDecode(Buffer.from("BW23fake-frame")), /ENOENT/);
  } finally {
    if (saved === undefined) delete process.env.PULSAR_BIN;
    else process.env.PULSAR_BIN = saved;
  }
});
