import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { lbBin, lbEncode, lbAware, lbDecode } from "./engines.mjs";

const AUTH_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "spl-engines-"));
const MISSING = path.join(AUTH_DIR, "missing-lb");

test("happy: lbBin honors env, defaults under cwd/bin", () => {
  const saved = process.env.LB_BIN;
  process.env.LB_BIN = MISSING;
  try {
    assert.equal(lbBin(), MISSING);
  } finally {
    if (saved === undefined) delete process.env.LB_BIN;
    else process.env.LB_BIN = saved;
  }
  assert.ok(lbBin().endsWith(path.join("bin", "lb")));
});

test("fail-closed: missing binary returns null like its siblings", async () => {
  const saved = process.env.LB_BIN;
  process.env.LB_BIN = MISSING;
  try {
    const raw = Buffer.from("engine probe payload 0123456789");
    assert.equal(await lbEncode(raw), null);
    assert.equal(await lbAware(raw), null);
    // lbDecode used to throw ENOENT (no catch); now it returns null too.
    assert.equal(await lbDecode(raw), null);
  } finally {
    if (saved === undefined) delete process.env.LB_BIN;
    else process.env.LB_BIN = saved;
  }
});
