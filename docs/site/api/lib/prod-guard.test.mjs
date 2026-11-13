/** Production boot-gate tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const GUARD = path.join(path.dirname(fileURLToPath(import.meta.url)), "prod-guard.mjs");

function boot(env) {
  try {
    execFileSync(process.execPath, ["--input-type=module", "-e",
      `import(${JSON.stringify("file://" + GUARD)}).then(() => console.log("booted"))`],
      { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, stderr: "" };
  } catch (e) {
    return { ok: false, stderr: String(e.stderr || e.message) };
  }
}

test("production + bypass armed refuses boot", () => {
  const r = boot({ NODE_ENV: "production", X402_DEV_BYPASS: "1" });
  assert.equal(r.ok, false);
  assert.match(r.stderr, /refusing boot/);
});

test("production without bypass boots", () => {
  const r = boot({ NODE_ENV: "production", X402_DEV_BYPASS: "0" });
  assert.equal(r.ok, true);
});

test("staging with bypass boots (dry-run rail)", () => {
  const r = boot({ NODE_ENV: "staging", X402_DEV_BYPASS: "1" });
  assert.equal(r.ok, true);
});
