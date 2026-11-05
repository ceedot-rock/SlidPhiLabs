/**
 * Network health 0.1.0 — self-check runner over registered stage probes.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * createHealthChecker({ probes, nowMs, fs, tmpDir }) runs one probe per
 * stage and returns a health snapshot { ok, at, stages: [{ stage, ok,
 * ms, error? }] } for a future /healthz-style endpoint. Probes are
 * injectable (sync or async, (ctx) => { ok } or truthy) so tests stub
 * them; the offline defaults are ledger-writable (temp-file round trip
 * outside prod paths) and digests-verify (fixture digest determinism
 * via SHA-256). Fail-closed: a throwing probe records { ok:false,
 * error } and never aborts the remaining stages.
 */

import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import nodeFs from "node:fs";

export const HEALTH_VERSION = "0.1.0";

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function text(v) {
  return v == null ? "" : String(v);
}

/** Stable stringify: sorted keys, so fixture digests are deterministic. */
export function stableStringify(v) {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  if (isPlainObject(v)) {
    const keys = Object.keys(v).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

export function digestFixture(value) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

const DIGEST_FIXTURE = Object.freeze({
  id: "health-fixture",
  operator: "self-check",
  amount_cents: 100,
  at: "2026-11-05T00:00:00.000Z",
});

/** Default probe: temp-dir write/read/remove round trip (never /data). */
export function probeLedgerWritable(ctx = {}) {
  const fs = ctx.fs || nodeFs;
  const dir = typeof ctx.tmpDir === "string" && ctx.tmpDir ? ctx.tmpDir : tmpdir();
  const name = `health-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}.tmp`;
  const path = join(dir, name);
  fs.writeFileSync(path, "health", "utf8");
  const back = fs.readFileSync(path, "utf8");
  try {
    fs.unlinkSync(path);
  } catch {
    /* best-effort cleanup */
  }
  if (back !== "health") return { ok: false, error: "roundtrip_mismatch" };
  return { ok: true };
}

/** Default probe: SHA-256 fixture digests verify (stable + sensitive). */
export function probeDigestsVerify() {
  const a = digestFixture(DIGEST_FIXTURE);
  const b = digestFixture({ ...DIGEST_FIXTURE });
  if (a !== b) return { ok: false, error: "digest_unstable" };
  const mutated = digestFixture({ ...DIGEST_FIXTURE, amount_cents: 101 });
  if (mutated === a) return { ok: false, error: "digest_insensitive" };
  if (!/^[0-9a-f]{64}$/.test(a)) return { ok: false, error: "digest_malformed" };
  return { ok: true, digest: a };
}

export function defaultProbes() {
  return {
    ledger_writable: probeLedgerWritable,
    digests_verify: probeDigestsVerify,
  };
}

/**
 * Create a health checker.
 * @param {object} [opts] { probes, nowMs, fs, tmpDir } — probes maps
 *   stage name -> probe fn (ctx) => { ok } | truthy. Extra probes merge
 *   over (and may override) the defaults; pass { probes: {...}, } with
 *   a stage set to null to disable a default.
 */
export function createHealthChecker(opts = {}) {
  const o = isPlainObject(opts) ? opts : {};
  const nowMs = typeof o.nowMs === "function" ? o.nowMs : Date.now;
  const ctx = { fs: o.fs || nodeFs, tmpDir: o.tmpDir };
  const stages = new Map(Object.entries(defaultProbes()));
  if (isPlainObject(o.probes)) {
    for (const [stage, fn] of Object.entries(o.probes)) {
      if (fn === null) stages.delete(stage);
      else if (typeof fn === "function") stages.set(stage, fn);
    }
  }

  function register(stage, fn) {
    if (text(stage).trim() === "" || typeof fn !== "function") {
      return { ok: false, error: "bad_probe" };
    }
    stages.set(text(stage), fn);
    return { ok: true, stage: text(stage) };
  }

  async function check() {
    const rows = [];
    for (const [stage, fn] of stages) {
      const t0 = Number(nowMs());
      try {
        const r = await fn(ctx);
        const ok = isPlainObject(r) ? r.ok !== false : !!r;
        const row = { stage, ok, ms: Math.max(0, Number(nowMs()) - t0) };
        if (!ok && isPlainObject(r) && text(r.error)) row.error = text(r.error);
        if (!ok && !isPlainObject(r)) row.error = "probe_failed";
        rows.push(row);
      } catch (e) {
        rows.push({
          stage,
          ok: false,
          ms: Math.max(0, Number(nowMs()) - t0),
          error: text((e && e.message) || e) || "probe_threw",
        });
      }
    }
    const at = new Date(Number.isFinite(Number(nowMs())) ? Number(nowMs()) : 0).toISOString();
    return { ok: rows.every((r) => r.ok), at, stages: rows };
  }

  return { register, check };
}
