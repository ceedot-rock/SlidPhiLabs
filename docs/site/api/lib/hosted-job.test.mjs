import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runHostedEncode } from "./hosted-job.mjs";
import { MAX_RAW } from "./specialist.mjs";
import { addUsage, readUsage, identityFromReq } from "./usage-meter.mjs";

// Deterministic offline: isolated meter store + missing engine binaries so
// encodeHosted always takes the pure-JS store path (no pulsar/lb on PATH).
const AUTH_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "spl-hosted-job-"));
process.env.AUTH_DIR = AUTH_DIR;
process.env.PULSAR_BIN = path.join(AUTH_DIR, "missing-pulsar");
process.env.LB_BIN = path.join(AUTH_DIR, "missing-lb");

const req = (ip) => ({ headers: { "x-forwarded-for": ip } });

test("happy: all-zero fill encodes to the 8-byte flagship frame", async () => {
  const r = await runHostedEncode(req("10.7.0.1"), Buffer.alloc(100));
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.seat, "fill");
  assert.equal(r.body.packed_bytes, 8);
  assert.equal(r.body.roundtrip, true);
  assert.ok(r.body.usage);
});

test("happy: incompressible input stores as-is and records metered usage", async () => {
  const ip = "10.7.0.2";
  const raw = Buffer.from("abcdefgh".repeat(64)); // 512 B, texty, stores as-is offline
  const r = await runHostedEncode(req(ip), raw);
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.roundtrip, true);
  assert.equal(readUsage(identityFromReq(req(ip)).key).bytes, raw.length);
  assert.ok(r.body.usage.used_bytes >= raw.length);
});

test("error: empty body fails closed with 400", async () => {
  assert.deepEqual(await runHostedEncode(req("10.7.0.3"), Buffer.alloc(0)), {
    status: 400,
    body: { ok: false, error: "empty_body" },
  });
  assert.deepEqual(await runHostedEncode(req("10.7.0.3"), null), {
    status: 400,
    body: { ok: false, error: "empty_body" },
  });
});

test("error: over MAX_RAW fails closed with 413", async () => {
  const r = await runHostedEncode(req("10.7.0.4"), Buffer.alloc(MAX_RAW + 1));
  assert.equal(r.status, 413);
  assert.equal(r.body.error, "too_large");
  assert.equal(r.body.max_raw, MAX_RAW);
});

test("error: exhausted lifetime allowance returns the 402 paywall, never encodes", async () => {
  const ip = "10.7.0.5";
  addUsage(identityFromReq(req(ip)).key, 2 ** 31); // 2 GiB > free cap, number-only write
  const r = await runHostedEncode(req(ip), Buffer.from("paywall probe payload 0123456789"));
  assert.equal(r.status, 402);
  assert.equal(r.body.ok, false);
  assert.equal(r.body.error, "paywall");
  assert.ok(r.body.plain);
  assert.ok(r.body.usage);
  assert.ok(r.body.buy.gc_month);
});
