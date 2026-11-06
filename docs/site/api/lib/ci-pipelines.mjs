/**
 * CI pipelines 0.1.0 — pipeline/job/run ledger with runner claiming and merge-gate checks.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Deterministic offline default: in-memory Map stores, counter-based ids
 * (run_0001, job_0001, runner_0001, art_0001), injectable nowMs() clock.
 * No disk, no network. File persistence plugs in via opts.storePath plus
 * an injectable fs surface (same shape as conductor-tasks); artifact bytes
 * plug in via an injectable artifactStore adapter ({ next, byId }).
 * Fail-closed envelopes: every entry returns { ok:true, ... } or
 * { ok:false, error } and never throws on bad input.
 */
import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const CI_VERSION = "0.1.0";

export const CI_QUEUED = "queued";
export const CI_RUNNING = "running";
export const CI_COMPLETED = "completed";

export const CI_SUCCESS = "success";
export const CI_FAILURE = "failure";
export const CI_CANCELLED = "cancelled";
export const CI_SKIPPED = "skipped";
export const CI_CONCLUSIONS = [CI_SUCCESS, CI_FAILURE, CI_CANCELLED, CI_SKIPPED];
const CONCLUSIONS = new Set(CI_CONCLUSIONS);
// Non-success conclusions that mark a check run red and qualify for rerun.
const FAILED_CONCLUSIONS = new Set([CI_FAILURE, CI_CANCELLED]);

export const CI_MAX_ARTIFACT_BYTES = 1_000_000;
export const CI_DEFAULT_STALE_AFTER_MS = 60_000;

function defaultFileFs() {
  return {
    readFile: (p) => readFileSync(p, "utf8"),
    writeFile: (p, s) => writeFileSync(p, s, "utf8"),
    rename: (a, b) => renameSync(a, b),
    mkdir: (d) => mkdirSync(d, { recursive: true }),
  };
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function copy(v) {
  return JSON.parse(JSON.stringify(v));
}

function defaultNowMs() {
  return Date.now();
}

function fail(error) {
  return { ok: false, error };
}

function text(v) {
  return v == null ? "" : String(v);
}

function validSha(v) {
  return /^[0-9a-f]{7,64}$/.test(text(v).toLowerCase()) && /^[0-9a-fA-F]{7,64}$/.test(text(v));
}

function validName(v) {
  return typeof v === "string" && v.trim() !== "" && v.length <= 128;
}

/** Default in-memory store. Injectable for tests. */
export function createMemoryStore() {
  return {
    nextRun: 1,
    nextRunner: 1,
    nextJob: 1,
    pipelines: new Map(),
    runs: new Map(),
    runners: new Map(),
    jobs: new Map(),
  };
}

/** Default in-memory artifact store ({ next, byId }). Injectable for tests. */
export function createMemoryArtifactStore() {
  return { next: 1, byId: new Map() };
}

function normalizeArtifactStore(s) {
  if (s && typeof s === "object" && Number.isSafeInteger(s.next) && s.next >= 1 && s.byId instanceof Map) return s;
  if (s && typeof s === "object" && s.byId instanceof Map) {
    if (!Number.isSafeInteger(s.next) || s.next < 1) s.next = s.byId.size + 1;
    return s;
  }
  return createMemoryArtifactStore();
}

/**
 * File-backed store option: same shape as createMemoryStore plus
 * save()/load(), persisted as one JSON file (atomic tmp + rename).
 * Deterministic offline: the fs surface ({ readFile, writeFile, rename,
 * mkdir }) is injectable so tests never touch disk. load() tolerates a
 * missing file (fresh store); save() never throws — persistence faults
 * return { ok:false } envelopes.
 */
export function createFileStore({ path, fs = null } = {}) {
  if (typeof path !== "string" || path === "") throw new Error("ci-pipelines: file store path required");
  const io = fs || defaultFileFs();
  const store = createMemoryStore();

  function load() {
    let raw;
    try {
      raw = io.readFile(path);
    } catch (err) {
      if (err && (err.code === "ENOENT" || /no such file/i.test(String(err && err.message)))) {
        return { ok: true, loaded: 0 };
      }
      return { ok: false, error: "read_error" };
    }
    let parsed;
    try {
      parsed = JSON.parse(String(raw));
    } catch {
      return { ok: false, error: "corrupt_store" };
    }
    if (!parsed || typeof parsed !== "object") return { ok: false, error: "corrupt_store" };
    for (const key of ["pipelines", "runs", "runners", "jobs"]) {
      if (!Array.isArray(parsed[key])) return { ok: false, error: "corrupt_store" };
    }
    store.pipelines = new Map(parsed.pipelines.map((p) => [p.name, p]));
    store.runs = new Map(parsed.runs.map((r) => [r.run_id, r]));
    store.runners = new Map(parsed.runners.map((r) => [r.runner_id, r]));
    store.jobs = new Map(parsed.jobs.map((j) => [j.job_id, j]));
    for (const [key, fallback] of [["nextRun", store.runs], ["nextRunner", store.runners], ["nextJob", store.jobs]]) {
      store[key] = Number.isSafeInteger(parsed[key]) && parsed[key] >= 1 ? parsed[key] : fallback.size + 1;
    }
    if (Array.isArray(parsed.artifacts)) {
      store.artifacts = { next: 1, byId: new Map(parsed.artifacts.map((a) => [a.artifact_id, a])) };
      store.artifacts.next =
        Number.isSafeInteger(parsed.nextArtifact) && parsed.nextArtifact >= 1
          ? parsed.nextArtifact
          : store.artifacts.byId.size + 1;
    }
    return { ok: true, loaded: store.runs.size };
  }

  function save() {
    try {
      try {
        io.mkdir(dirname(path));
      } catch {
        /* best-effort: parent may already exist */
      }
      const raw = JSON.stringify({
        nextRun: store.nextRun,
        nextRunner: store.nextRunner,
        nextJob: store.nextJob,
        nextArtifact: store.artifacts && Number.isSafeInteger(store.artifacts.next) ? store.artifacts.next : 1,
        pipelines: [...store.pipelines.values()],
        runs: [...store.runs.values()],
        runners: [...store.runners.values()],
        jobs: [...store.jobs.values()],
        artifacts: store.artifacts && store.artifacts.byId ? [...store.artifacts.byId.values()] : [],
      });
      const tmp = `${path}.tmp`;
      io.writeFile(tmp, raw);
      io.rename(tmp, path);
    } catch {
      return { ok: false, error: "write_error" };
    }
    return { ok: true };
  }

  store.path = path;
  store.load = load;
  store.save = save;
  return store;
}

function persist(store) {
  try {
    if (store && typeof store.save === "function") store.save();
  } catch {
    /* persistence is best-effort: the in-memory write already landed */
  }
}

function normalizeLabels(v) {
  if (typeof v === "string") v = [v];
  if (!Array.isArray(v)) return null;
  const out = [];
  for (const l of v) {
    if (typeof l !== "string" || l.trim() === "") return null;
    out.push(l);
  }
  return out;
}

function validatePipelineDef(input) {
  if (!isPlainObject(input)) return { error: "invalid_input" };
  if (!validName(input.name)) return { error: "invalid_name" };
  if (!Array.isArray(input.jobs) || input.jobs.length === 0) return { error: "invalid_jobs" };
  const seen = new Set();
  for (const j of input.jobs) {
    if (!isPlainObject(j)) return { error: "invalid_job" };
    if (typeof j.id !== "string" || j.id.trim() === "" || j.id.length > 128) return { error: "invalid_job_id" };
    if (seen.has(j.id)) return { error: "duplicate_job_id" };
    seen.add(j.id);
    const runsOn = normalizeLabels(j["runs-on"] !== undefined ? j["runs-on"] : j.runs_on);
    if (!runsOn || runsOn.length === 0) return { error: "invalid_runs_on" };
    if (!Array.isArray(j.steps) || j.steps.length === 0) return { error: "invalid_steps" };
    for (const s of j.steps) {
      if (typeof s === "string") {
        if (s.trim() === "") return { error: "invalid_steps" };
      } else if (isPlainObject(s)) {
        if (typeof s.name !== "string" || s.name.trim() === "") return { error: "invalid_steps" };
      } else {
        return { error: "invalid_steps" };
      }
    }
  }
  return null;
}

function normalizePipelineDef(input) {
  return {
    name: input.name,
    jobs: input.jobs.map((j) => ({
      id: j.id,
      "runs-on": normalizeLabels(j["runs-on"] !== undefined ? j["runs-on"] : j.runs_on),
      steps: copy(j.steps),
    })),
  };
}

function runnerRef(input) {
  if (typeof input === "string") return input;
  if (isPlainObject(input)) {
    for (const k of ["runner_id", "runner", "id"]) {
      if (typeof input[k] === "string") return input[k];
    }
  }
  return null;
}

function runRef(input) {
  if (typeof input === "string") return input;
  if (isPlainObject(input)) {
    for (const k of ["run_id", "runId", "run", "id"]) {
      if (typeof input[k] === "string") return input[k];
    }
  }
  return null;
}

function jobRef(input) {
  if (typeof input === "string") return input;
  if (isPlainObject(input)) {
    for (const k of ["job_id", "jobId", "job", "id"]) {
      if (typeof input[k] === "string") return input[k];
    }
  }
  return null;
}

/**
 * Create a CI pipeline manager (pure state machine + checks rollup).
 * @param {object} [opts]
 * @param {object} [opts.store] injectable store from createMemoryStore().
 * @param {string} [opts.storePath] file path for a file-backed store.
 * @param {object} [opts.fs] injectable fs surface for the file store.
 * @param {function} [opts.nowMs] injectable clock () => ms number.
 * @param {number} [opts.staleAfterMs] heartbeat staleness threshold.
 * @param {object} [opts.artifactStore] injectable artifact store ({ next, byId }).
 */
export function createPipelineManager(opts = {}) {
  const o = isPlainObject(opts) ? opts : {};
  const store =
    o.store || (o.storePath ? createFileStore({ path: o.storePath, fs: o.fs || null }) : createMemoryStore());
  if (typeof store.load === "function") {
    try {
      store.load();
    } catch {
      /* corrupt store surfaces on save; manager still serves memory */
    }
  }
  const nowMs = typeof o.nowMs === "function" ? o.nowMs : defaultNowMs;
  const staleAfterMs =
    Number.isSafeInteger(o.staleAfterMs) && o.staleAfterMs >= 0 ? o.staleAfterMs : CI_DEFAULT_STALE_AFTER_MS;
  if (!store.pipelines) store.pipelines = new Map();
  if (!store.runs) store.runs = new Map();
  if (!store.runners) store.runners = new Map();
  if (!store.jobs) store.jobs = new Map();
  if (!Number.isSafeInteger(store.nextRun) || store.nextRun < 1) store.nextRun = store.runs.size + 1;
  if (!Number.isSafeInteger(store.nextRunner) || store.nextRunner < 1) store.nextRunner = store.runners.size + 1;
  if (!Number.isSafeInteger(store.nextJob) || store.nextJob < 1) store.nextJob = store.jobs.size + 1;
  const artifacts = normalizeArtifactStore(o.artifactStore || store.artifacts || createMemoryArtifactStore());
  if (!store.artifacts) store.artifacts = artifacts;

  function now() {
    try {
      const n = nowMs();
      if (Number.isFinite(n)) return Math.floor(n);
    } catch {
      /* fall through to clock default */
    }
    return Date.now();
  }

  function isStale(runner) {
    return now() - runner.last_heartbeat > staleAfterMs;
  }

  function runJobs(run_id) {
    return [...store.jobs.values()].filter((j) => j.run_id === run_id).sort((a, b) => (a.job_id < b.job_id ? -1 : 1));
  }

  /** Recompute a run's status/conclusion from its jobs. Pure. */
  function rollup(run_id) {
    const run = store.runs.get(run_id);
    if (!run) return null;
    const jobs = runJobs(run_id);
    if (jobs.some((j) => j.status === CI_RUNNING)) {
      run.status = "in_progress";
      run.conclusion = null;
    } else if (jobs.some((j) => j.status === CI_QUEUED)) {
      run.status = jobs.every((j) => j.status === CI_QUEUED) ? CI_QUEUED : "in_progress";
      run.conclusion = null;
    } else {
      run.status = CI_COMPLETED;
      run.conclusion = jobs.every((j) => j.conclusion === CI_SUCCESS || j.conclusion === CI_SKIPPED)
        ? CI_SUCCESS
        : CI_FAILURE;
    }
    run.updated_at = now();
    return run;
  }

  function definePipeline(input = {}) {
    const bad = validatePipelineDef(input);
    if (bad) return fail(bad.error);
    const pipeline = normalizePipelineDef(input);
    store.pipelines.set(pipeline.name, pipeline);
    persist(store);
    return { ok: true, pipeline: copy(pipeline) };
  }

  function getPipeline(name) {
    if (typeof name !== "string" || name === "") return fail("invalid_name");
    const p = store.pipelines.get(name);
    if (!p) return fail("not_found");
    return { ok: true, pipeline: copy(p) };
  }

  function startRun(input = {}) {
    if (!isPlainObject(input)) return fail("invalid_input");
    const pRef = isPlainObject(input.pipeline) ? input.pipeline.name : input.pipeline;
    if (typeof pRef !== "string" || pRef === "") return fail("invalid_pipeline");
    const pipeline = store.pipelines.get(pRef);
    if (!pipeline) return fail("pipeline_not_found");
    if (!validSha(input.sha)) return fail("invalid_sha");
    if (typeof input.branch !== "string" || input.branch.trim() === "") return fail("invalid_branch");
    const n = store.nextRun;
    store.nextRun = n + 1;
    const run_id = `run_${String(n).padStart(4, "0")}`;
    const at = now();
    const run = {
      run_id,
      pipeline: pipeline.name,
      sha: text(input.sha),
      branch: input.branch,
      status: CI_QUEUED,
      conclusion: null,
      created_at: at,
      updated_at: at,
    };
    store.runs.set(run_id, run);
    const job_ids = [];
    for (const def of pipeline.jobs) {
      const m = store.nextJob;
      store.nextJob = m + 1;
      const job_id = `job_${String(m).padStart(4, "0")}`;
      store.jobs.set(job_id, {
        job_id,
        run_id,
        job: def.id,
        runs_on: [...def["runs-on"]],
        steps: copy(def.steps),
        status: CI_QUEUED,
        conclusion: null,
        runner_id: null,
        attempts: 0,
        created_at: at,
        started_at: null,
        completed_at: null,
      });
      job_ids.push(job_id);
    }
    persist(store);
    return { ok: true, run_id, status: run.status, jobs: job_ids };
  }

  function registerRunner(input = {}) {
    if (!isPlainObject(input)) return fail("invalid_input");
    if (!validName(input.name)) return fail("invalid_name");
    if (!Array.isArray(input.labels)) return fail("invalid_labels");
    const labels = [];
    for (const l of input.labels) {
      if (typeof l !== "string" || l.trim() === "") return fail("invalid_labels");
      labels.push(l);
    }
    for (const r of store.runners.values()) {
      if (r.name === input.name) return fail("already_exists");
    }
    const n = store.nextRunner;
    store.nextRunner = n + 1;
    const runner_id = `runner_${String(n).padStart(4, "0")}`;
    const at = now();
    const runner = { runner_id, name: input.name, labels, registered_at: at, last_heartbeat: at };
    store.runners.set(runner_id, runner);
    persist(store);
    return { ok: true, runner_id, runner: copy(runner) };
  }

  function heartbeat(input) {
    const id = runnerRef(input);
    if (typeof id !== "string" || id === "") return fail("invalid_runner_id");
    const runner = store.runners.get(id);
    if (!runner) return fail("not_found");
    runner.last_heartbeat = now();
    persist(store);
    return { ok: true, runner: copy(runner) };
  }

  function getRunner(input) {
    const id = runnerRef(input);
    if (typeof id !== "string" || id === "") return fail("invalid_runner_id");
    const runner = store.runners.get(id);
    if (!runner) return fail("not_found");
    return { ok: true, runner: copy(runner) };
  }

  function listRunners() {
    return [...store.runners.values()].map(copy);
  }

  function claimJob(input) {
    const id = runnerRef(input);
    if (typeof id !== "string" || id === "") return fail("invalid_runner_id");
    const runner = store.runners.get(id);
    if (!runner) return fail("not_found");
    if (isStale(runner)) return fail("stale_runner");
    const have = new Set(runner.labels);
    const candidate = [...store.jobs.values()]
      .filter((j) => j.status === CI_QUEUED)
      .sort((a, b) => (a.job_id < b.job_id ? -1 : a.job_id > b.job_id ? 1 : 0))
      .find((j) => j.runs_on.every((l) => have.has(l)));
    if (!candidate) return fail("no_jobs");
    candidate.status = CI_RUNNING;
    candidate.runner_id = runner.runner_id;
    candidate.attempts += 1;
    candidate.started_at = now();
    rollup(candidate.run_id);
    persist(store);
    return { ok: true, job: copy(candidate) };
  }

  function validateArtifactFields(a) {
    if (!isPlainObject(a)) return "invalid_artifact";
    if (typeof a.name !== "string" || a.name.trim() === "" || a.name.length > 256) return "invalid_artifact";
    if (typeof a.content !== "string") return "invalid_artifact";
    if (a.content.length > CI_MAX_ARTIFACT_BYTES) return "artifact_too_large";
    return null;
  }

  function putArtifact({ run_id, job_id, name, content }) {
    const n = artifacts.next;
    artifacts.next = n + 1;
    const artifact_id = `art_${String(n).padStart(4, "0")}`;
    const record = { artifact_id, run_id, job_id, name, content, size: content.length, created_at: now() };
    artifacts.byId.set(artifact_id, record);
    return record;
  }

  function completeJob(input = {}) {
    if (!isPlainObject(input)) return fail("invalid_input");
    const id = jobRef(input.jobId !== undefined ? input.jobId : input.job_id);
    if (typeof id !== "string" || id === "") return fail("invalid_job_id");
    const job = store.jobs.get(id);
    if (!job) return fail("not_found");
    if (job.status === CI_COMPLETED) return fail("already_terminal");
    if (job.status !== CI_RUNNING) return fail("not_claimed");
    if (typeof input.conclusion !== "string" || !CONCLUSIONS.has(input.conclusion)) return fail("invalid_conclusion");
    const list = input.artifacts === undefined ? [] : input.artifacts;
    if (!Array.isArray(list)) return fail("invalid_artifact");
    for (const a of list) {
      const bad = validateArtifactFields(a);
      if (bad) return fail(bad);
    }
    const stored = list.map((a) => putArtifact({ run_id: job.run_id, job_id: job.job_id, name: a.name, content: a.content }));
    job.status = CI_COMPLETED;
    job.conclusion = input.conclusion;
    job.completed_at = now();
    const run = rollup(job.run_id);
    persist(store);
    return {
      ok: true,
      job: copy(job),
      run: run ? { run_id: run.run_id, status: run.status, conclusion: run.conclusion } : null,
      artifacts: stored.map((a) => a.artifact_id),
    };
  }

  function getRun(input) {
    const id = runRef(input);
    if (typeof id !== "string" || id === "") return fail("invalid_run_id");
    const run = store.runs.get(id);
    if (!run) return fail("not_found");
    return { ok: true, run: copy(run), jobs: runJobs(id).map(copy) };
  }

  function getJob(input) {
    const id = jobRef(input);
    if (typeof id !== "string" || id === "") return fail("invalid_job_id");
    const job = store.jobs.get(id);
    if (!job) return fail("not_found");
    return { ok: true, job: copy(job) };
  }

  function listRuns() {
    return [...store.runs.values()].map(copy);
  }

  function listJobs(input) {
    if (input === undefined) return [...store.jobs.values()].map(copy);
    const id = runRef(input);
    if (typeof id !== "string" || id === "") return fail("invalid_run_id");
    if (!store.runs.has(id)) return fail("not_found");
    return { ok: true, jobs: runJobs(id).map(copy) };
  }

  function storeArtifact(input = {}) {
    if (!isPlainObject(input)) return fail("invalid_input");
    const bad = validateArtifactFields(input);
    if (bad) return fail(bad);
    const run_id = input.run_id !== undefined ? input.run_id : input.runId !== undefined ? input.runId : null;
    const job_id = input.job_id !== undefined ? input.job_id : input.jobId !== undefined ? input.jobId : null;
    if (run_id !== null) {
      if (typeof run_id !== "string" || !store.runs.has(run_id)) return fail("not_found");
    }
    if (job_id !== null) {
      if (typeof job_id !== "string" || !store.jobs.has(job_id)) return fail("not_found");
    }
    if (run_id === null && job_id === null) return fail("invalid_target");
    const record = putArtifact({ run_id, job_id, name: input.name, content: input.content });
    persist(store);
    return { ok: true, artifact: copy(record) };
  }

  function listArtifacts(input = {}) {
    if (input === null || typeof input !== "object" || Array.isArray(input)) return fail("invalid_input");
    const run_id = input.run_id !== undefined ? input.run_id : input.runId !== undefined ? input.runId : undefined;
    const job_id = input.job_id !== undefined ? input.job_id : input.jobId !== undefined ? input.jobId : undefined;
    if (run_id !== undefined && (typeof run_id !== "string" || run_id === "")) return fail("invalid_run_id");
    if (job_id !== undefined && (typeof job_id !== "string" || job_id === "")) return fail("invalid_job_id");
    const out = [...artifacts.byId.values()]
      .filter((a) => (run_id === undefined || a.run_id === run_id) && (job_id === undefined || a.job_id === job_id))
      .map(copy);
    return { ok: true, artifacts: out };
  }

  /**
   * Merge-gate rollup for one commit sha across every run.
   * pending while any job is queued/running; success only when every job
   * completed success/skipped; otherwise failure.
   */
  function statusChecks(input = {}) {
    if (!isPlainObject(input)) return fail("invalid_input");
    if (!validSha(input.sha)) return fail("invalid_sha");
    const runs = [...store.runs.values()].filter((r) => r.sha === text(input.sha));
    if (runs.length === 0) return fail("not_found");
    const checks = [];
    for (const run of runs) {
      for (const job of runJobs(run.run_id)) {
        checks.push({ run_id: run.run_id, job_id: job.job_id, job: job.job, status: job.status, conclusion: job.conclusion });
      }
    }
    let state = CI_SUCCESS;
    if (checks.length === 0 || checks.some((c) => c.status !== CI_COMPLETED)) {
      state = "pending";
    } else if (checks.some((c) => c.conclusion !== CI_SUCCESS && c.conclusion !== CI_SKIPPED)) {
      state = CI_FAILURE;
    }
    const completed = checks.filter((c) => c.status === CI_COMPLETED).length;
    return {
      ok: true,
      sha: text(input.sha),
      state,
      total: checks.length,
      completed,
      success: checks.filter((c) => c.conclusion === CI_SUCCESS || c.conclusion === CI_SKIPPED).length,
      failure: checks.filter((c) => c.conclusion !== null && c.conclusion !== CI_SUCCESS && c.conclusion !== CI_SKIPPED).length,
      checks,
    };
  }

  function rerunFailed(input) {
    const id = runRef(input);
    if (typeof id !== "string" || id === "") return fail("invalid_run_id");
    const run = store.runs.get(id);
    if (!run) return fail("not_found");
    const failed = runJobs(id).filter((j) => j.status === CI_COMPLETED && FAILED_CONCLUSIONS.has(j.conclusion));
    if (failed.length === 0) return fail("no_failed_jobs");
    for (const job of failed) {
      job.status = CI_QUEUED;
      job.conclusion = null;
      job.runner_id = null;
      job.started_at = null;
      job.completed_at = null;
    }
    rollup(id);
    persist(store);
    return { ok: true, run_id: id, status: run.status, rerun: failed.map((j) => j.job_id) };
  }

  return {
    definePipeline,
    getPipeline,
    startRun,
    registerRunner,
    heartbeat,
    getRunner,
    listRunners,
    claimJob,
    completeJob,
    getRun,
    getJob,
    listRuns,
    listJobs,
    storeArtifact,
    listArtifacts,
    statusChecks,
    rerunFailed,
    store,
  };
}

const DEFAULT_MANAGER = createPipelineManager();

/** Singleton-backed shortcuts over the default in-memory store. */
export function definePipeline(input) {
  return DEFAULT_MANAGER.definePipeline(input);
}

export function getPipeline(name) {
  return DEFAULT_MANAGER.getPipeline(name);
}

export function startRun(input) {
  return DEFAULT_MANAGER.startRun(input);
}

export function registerRunner(input) {
  return DEFAULT_MANAGER.registerRunner(input);
}

export function heartbeat(input) {
  return DEFAULT_MANAGER.heartbeat(input);
}

export function claimJob(input) {
  return DEFAULT_MANAGER.claimJob(input);
}

export function completeJob(input) {
  return DEFAULT_MANAGER.completeJob(input);
}

export function getRun(input) {
  return DEFAULT_MANAGER.getRun(input);
}

export function getJob(input) {
  return DEFAULT_MANAGER.getJob(input);
}

export function listRuns() {
  return DEFAULT_MANAGER.listRuns();
}

export function statusChecks(input) {
  return DEFAULT_MANAGER.statusChecks(input);
}

export function rerunFailed(input) {
  return DEFAULT_MANAGER.rerunFailed(input);
}

export function storeArtifact(input) {
  return DEFAULT_MANAGER.storeArtifact(input);
}

export function listArtifacts(input) {
  return DEFAULT_MANAGER.listArtifacts(input);
}
