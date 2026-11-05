/**
 * Private bench 0.1.0 — held-out suite runner (same 4-suite SHAPE as benchhaus).
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Held-out by construction: NO fixtures are bundled here. Fixtures arrive
 * ONLY via the injected adapter (adapters.fixtures or adapters.getFixtures).
 * Without an adapter the runner refuses with { ok:false,
 * reason:"no_public_fixture" } instead of falling back to public fixtures.
 * Spec-side fixtures are ignored on purpose: passing fixtures in `spec`
 * does not run anything. Deterministic, offline, dependency-free.
 *
 * Coverage rules mirror benchhaus: missing/N-A suites are skipped and
 * weights renormalized (NO imputation). Result provenance is always
 * "held-out:" + source.
 *
 * Attestation: `verified` is true ONLY when the adapter attests the run —
 * pass `attest: true`, or an `attest(digest)` function returning truthy
 * (it receives the result digest for countersigning). Without attestation
 * the run still scores, but reports `verified: false` plus
 * `attest_reason: "no_adapter_attestation"` — an unattested held-out run
 * must never look verified.
 */
import { createHash } from "node:crypto";

export const PRIVATE_BENCH_VERSION = "0.1.0";
export const NO_PUBLIC_FIXTURE = "no_public_fixture";

export const PRIVATE_BENCH_WEIGHTS = Object.freeze({
  plan: 0.3,
  retrieval: 0.25,
  state: 0.25,
  refusal: 0.2,
});

export const CANON_ORDER = Object.freeze(["plan", "retrieval", "state", "refusal"]);

const SUITE_ALIAS = Object.freeze({
  plan: "plan",
  "plan-exactness": "plan",
  retrieval: "retrieval",
  "retrieval-precision": "retrieval",
  state: "state",
  "state-tracking": "state",
  refusal: "refusal",
  "refusal-robustness": "refusal",
});

function sha256hex(text) {
  return createHash("sha256").update(String(text ?? ""), "utf8").digest("hex");
}

function clamp01(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/** Wilson score interval (95%, z=1.96) for a k-of-n pass rate. Bounded. */
export function wilson(k, n, z = 1.96) {
  const nn = Math.max(0, Math.floor(Number(n) || 0));
  if (nn <= 0) return { lo: 0, hi: 1 };
  const kk = Math.min(nn, Math.max(0, Number(k) || 0));
  const p = kk / nn;
  const z2 = z * z;
  const denom = 1 + z2 / nn;
  const center = p + z2 / (2 * nn);
  const delta = z * Math.sqrt((p * (1 - p) + z2 / (4 * nn)) / nn);
  return {
    lo: Math.min(1, Math.max(0, (center - delta) / denom)),
    hi: Math.min(1, Math.max(0, (center + delta) / denom)),
  };
}

function failPrivate(reason, extra = {}) {
  return { ok: false, stage: "private-bench", reason, ...extra };
}

/**
 * Default pass-rate grader over an injected fixture. Accepted fixture
 * shapes: { passed, n } counts, or an array (truthy = pass). Returns a
 * suite result or { ok:false, detail } for malformed fixtures.
 */
export function gradePassRate(suite, fixture) {
  let passed;
  let n;
  if (Array.isArray(fixture)) {
    n = fixture.length;
    passed = fixture.filter(Boolean).length;
  } else if (fixture && typeof fixture === "object") {
    passed = Number(fixture.passed);
    n = Number(fixture.n);
  } else {
    return { ok: false, detail: "fixture must be { passed, n } or an array" };
  }
  if (!Number.isFinite(n) || Math.floor(n) !== n || n < 0) {
    return { ok: false, detail: "fixture.n must be an integer >= 0" };
  }
  if (!Number.isFinite(passed) || passed < 0 || passed > n) {
    return { ok: false, detail: "fixture.passed must satisfy 0 <= passed <= n" };
  }
  const score = n === 0 ? 0 : passed / n;
  return {
    suite,
    n,
    passed,
    pass_rate: clamp01(score),
    score: clamp01(score),
    ci95: wilson(passed, n),
  };
}

function validSuite(r) {
  if (!r || typeof r !== "object") return { ok: false, detail: "grader returned non-object" };
  const s = Number(r.score);
  if (!Number.isFinite(s) || s < 0 || s > 1) return { ok: false, detail: "score out of bounds 0..1" };
  if (!Number.isFinite(Number(r.n))) return { ok: false, detail: "missing n" };
  if (!r.ci95 || !Number.isFinite(Number(r.ci95.lo)) || !Number.isFinite(Number(r.ci95.hi))) {
    return { ok: false, detail: "missing ci95" };
  }
  return { ok: true };
}

/** 100 * weighted mean over completed suites only; NO imputation. */
export function computePrivateScore(results = [], { provenance = "held-out:custom" } = {}) {
  const list = Array.isArray(results) ? results : [];
  const bySuite = new Map();
  for (const r of list) {
    if (r && typeof r.suite === "string" && !bySuite.has(r.suite)) bySuite.set(r.suite, r);
  }
  let num = 0;
  let den = 0;
  let completed = 0;
  const cis = {};
  for (const [suite, w] of Object.entries(PRIVATE_BENCH_WEIGHTS)) {
    const r = bySuite.get(suite);
    const s = r ? Number(r.score) : NaN;
    if (r && Number.isFinite(s) && s >= 0 && s <= 1) {
      num += w * s;
      den += w;
      completed++;
      cis[suite] = r.ci95 ?? null;
    } else {
      cis[suite] = (r && r.ci95) || null;
    }
  }
  return {
    siascore: den > 0 ? clamp01(num / den) * 100 : null,
    coverage_pct: (completed / 4) * 100,
    cis,
    completed,
    total: 4,
    provenance,
  };
}

const GRADER_KEYS = Object.freeze({
  plan: "gradePlan",
  retrieval: "gradeRetrieval",
  state: "gradeState",
  refusal: "gradeRefusal",
});

/**
/**
 * Resolve adapter attestation for a result digest. `attest: true` (or any
 * truthy non-function) attests directly; a function is called with the
 * digest and must return truthy. Anything else (absent, false, throwing,
 * falsy return) is unattested. Never throws.
 */
export function resolveAttestation(attest, digest) {
  try {
    if (typeof attest === "function") return !!attest(digest);
    return !!attest;
  } catch {
    return false;
  }
}

/**
 * Run the held-out suites. Fixtures come ONLY from adapters:
 * adapters = { source?: string, fixtures?: object,
 *   getFixtures?(source): object, gradePlan?, gradeRetrieval?,
 *   gradeState?, gradeRefusal?, attest?: boolean | (digest) => truthy }.
 * spec = { suites?: string[] } (subset selector; fixtures in spec are
 * ignored). Refuses with no_public_fixture when no adapter fixtures exist.
 * verified is true only when the adapter attests (see header note).
 */
export function runPrivateBench(spec = {}, adapters = {}) {
  try {
    const g = adapters && typeof adapters === "object" ? adapters : {};
    const hasFixtures =
      (g.fixtures && typeof g.fixtures === "object") || typeof g.getFixtures === "function";
    if (!hasFixtures) {
      return failPrivate(NO_PUBLIC_FIXTURE, { detail: "held-out fixtures require an injected adapter" });
    }
    const source =
      (typeof g.source === "string" && g.source) ||
      (spec && typeof spec.source === "string" && spec.source) ||
      "custom";
    const provenance = `held-out:${source}`;
    let fixtures;
    try {
      fixtures = typeof g.getFixtures === "function" ? g.getFixtures(source) : g.fixtures;
    } catch (e) {
      return failPrivate("grader_failed", { detail: String((e && e.message) || e).slice(0, 200) });
    }
    if (!fixtures || typeof fixtures !== "object" || Array.isArray(fixtures)) {
      return failPrivate(NO_PUBLIC_FIXTURE, { detail: "adapter returned no fixtures" });
    }
    const root = spec && typeof spec === "object" ? spec : {};
    let wanted = root.suites === undefined ? [...CANON_ORDER] : root.suites;
    if (!Array.isArray(wanted)) return failPrivate("bad_spec", { detail: "suites must be an array" });
    const runSet = new Set();
    for (const w of wanted) {
      const key = SUITE_ALIAS[String(w).toLowerCase()];
      if (!key) return failPrivate("unknown_suite", { suite: String(w) });
      runSet.add(key);
    }
    if (!runSet.size) return failPrivate("bad_spec", { detail: "no suites selected" });

    const results = [];
    const timings = {};
    for (const suite of CANON_ORDER) {
      if (!runSet.has(suite)) continue;
      const fixture = fixtures[suite];
      if (fixture === undefined || fixture === null) continue;
      const t0 = Date.now();
      let r;
      try {
        const grader = g[GRADER_KEYS[suite]];
        r = typeof grader === "function" ? grader(fixture) : gradePassRate(suite, fixture);
      } catch (e) {
        timings[suite] = Date.now() - t0;
        return failPrivate("grader_failed", { suite, detail: String((e && e.message) || e).slice(0, 200) });
      }
      timings[suite] = Date.now() - t0;
      if (r && r.ok === false && r.detail) {
        return failPrivate("grader_failed", { suite, detail: r.detail });
      }
      const v = validSuite(r);
      if (!v.ok) return failPrivate("grader_failed", { suite, detail: v.detail });
      results.push({ ...r, suite });
    }

    const scoring = computePrivateScore(results, { provenance });
    const digest = sha256hex(
      JSON.stringify({
        suites: results,
        siascore: scoring.siascore,
        coverage_pct: scoring.coverage_pct,
        provenance,
      })
    );
    const attested = resolveAttestation(g.attest, digest);
    return {
      ok: true,
      stage: "private-bench",
      tool: "private-bench",
      toolVersion: PRIVATE_BENCH_VERSION,
      suites: results,
      siascore: scoring.siascore,
      coverage_pct: scoring.coverage_pct,
      cis: scoring.cis,
      provenance,
      digest,
      verified: attested,
      ...(attested ? {} : { attest_reason: "no_adapter_attestation" }),
      timings,
    };
  } catch (e) {
    return failPrivate("grader_failed", { detail: String((e && e.message) || e).slice(0, 200) });
  }
}
