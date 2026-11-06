/** CI pipelines tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createPipelineManager,
  createMemoryStore,
  createMemoryArtifactStore,
  createFileStore,
  definePipeline,
  startRun,
  registerRunner,
  heartbeat,
  claimJob,
  completeJob,
  getRun,
  statusChecks,
  rerunFailed,
  storeArtifact,
  listArtifacts,
  CI_VERSION,
  CI_QUEUED,
  CI_RUNNING,
  CI_COMPLETED,
  CI_CONCLUSIONS,
} from "./ci-pipelines.mjs";

const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);

function fixedClock() {
  let t = 1_000_000;
  return { nowMs: () => t, advance: (ms) => { t += ms; } };
}

function CI(clock, extra = {}) {
  return createPipelineManager({ nowMs: clock.nowMs, ...extra });
}

const PIPE = {
  name: "web",
  jobs: [
    { id: "lint", "runs-on": "linux", steps: ["npm run lint"] },
    { id: "test", "runs-on": ["linux", "x64"], steps: [{ name: "test" }] },
  ],
};

function withRun(clock) {
  const m = CI(clock);
  assert.equal(m.definePipeline(PIPE).ok, true);
  const started = m.startRun({ pipeline: "web", sha: SHA_A, branch: "main" });
  assert.equal(started.ok, true);
  return { m, started };
}

test("version pinned", () => assert.equal(CI_VERSION, "0.1.0"));

test("conclusion enum pinned", () => {
  assert.deepEqual([...CI_CONCLUSIONS].sort(), ["cancelled", "failure", "skipped", "success"]);
});

test("definePipeline validates every shape", () => {
  const c = fixedClock();
  const m = CI(c);
  const ok = m.definePipeline(PIPE);
  assert.equal(ok.ok, true);
  assert.equal(ok.pipeline.jobs.length, 2);
  for (const bad of [
    null, "x", {},
    { name: "", jobs: PIPE.jobs },
    { name: "web", jobs: [] },
    { name: "web", jobs: "nope" },
    { name: "web", jobs: [null] },
    { name: "web", jobs: [{ "runs-on": "linux", steps: ["s"] }] },
    { name: "web", jobs: [{ id: "a", "runs-on": "linux", steps: ["s"] }, { id: "a", "runs-on": "linux", steps: ["s"] }] },
    { name: "web", jobs: [{ id: "a", "runs-on": "", steps: ["s"] }] },
    { name: "web", jobs: [{ id: "a", "runs-on": [], steps: ["s"] }] },
    { name: "web", jobs: [{ id: "a", steps: ["s"] }] },
    { name: "web", jobs: [{ id: "a", "runs-on": "linux", steps: [] }] },
    { name: "web", jobs: [{ id: "a", "runs-on": "linux", steps: ["  "] }] },
    { name: "web", jobs: [{ id: "a", "runs-on": "linux", steps: [42] }] },
  ]) {
    assert.equal(m.definePipeline(bad).ok, false, JSON.stringify(bad));
  }
});

test("startRun queues one job per pipeline job", () => {
  const c = fixedClock();
  const { m, started } = withRun(c);
  assert.equal(started.run_id, "run_0001");
  assert.equal(started.status, CI_QUEUED);
  assert.deepEqual(started.jobs, ["job_0001", "job_0002"]);
  const got = m.getRun("run_0001");
  assert.equal(got.ok, true);
  assert.ok(got.jobs.every((j) => j.status === CI_QUEUED));
});

test("startRun rejects bad pipeline/sha/branch", () => {
  const c = fixedClock();
  const m = CI(c);
  m.definePipeline(PIPE);
  assert.equal(m.startRun(null).ok, false);
  assert.equal(m.startRun({ pipeline: "missing", sha: SHA_A, branch: "main" }).ok, false);
  assert.equal(m.startRun({ pipeline: "", sha: SHA_A, branch: "main" }).ok, false);
  for (const sha of [undefined, "", "xyz", "a".repeat(6), "a".repeat(65), 42]) {
    assert.equal(m.startRun({ pipeline: "web", sha, branch: "main" }).ok, false, String(sha));
  }
  for (const branch of [undefined, "", "   ", 42]) {
    assert.equal(m.startRun({ pipeline: "web", sha: SHA_A, branch }).ok, false, String(branch));
  }
});

test("startRun accepts a pipeline object by name", () => {
  const c = fixedClock();
  const m = CI(c);
  const def = m.definePipeline(PIPE);
  const r = m.startRun({ pipeline: def.pipeline, sha: SHA_A, branch: "main" });
  assert.equal(r.ok, true);
});

test("registerRunner validates and dedupes names", () => {
  const c = fixedClock();
  const m = CI(c);
  const ok = m.registerRunner({ name: "r1", labels: ["linux", "x64"] });
  assert.equal(ok.ok, true);
  assert.equal(ok.runner_id, "runner_0001");
  assert.equal(m.registerRunner({ name: "r1", labels: [] }).ok, false);
  for (const bad of [null, {}, { name: "", labels: [] }, { name: "r2" }, { name: "r2", labels: "linux" }, { name: "r2", labels: [""] }, { name: "r2", labels: [42] }]) {
    assert.equal(m.registerRunner(bad).ok, false, JSON.stringify(bad));
  }
});

test("heartbeat refreshes and rejects unknown runners", () => {
  const c = fixedClock();
  const m = CI(c);
  const { runner_id } = m.registerRunner({ name: "r1", labels: ["linux"] });
  c.advance(5000);
  const hb = m.heartbeat(runner_id);
  assert.equal(hb.ok, true);
  assert.equal(hb.runner.last_heartbeat, c.nowMs());
  assert.equal(m.heartbeat("runner_9999").ok, false);
  assert.equal(m.heartbeat("").ok, false);
  assert.equal(m.heartbeat(null).ok, false);
});

test("claimJob matches labels and reports empty queues", () => {
  const c = fixedClock();
  const { m } = withRun(c);
  const linux = m.registerRunner({ name: "tiny", labels: ["linux"] });
  const big = m.registerRunner({ name: "big", labels: ["linux", "x64"] });
  const first = m.claimJob(linux.runner_id);
  assert.equal(first.ok, true);
  assert.equal(first.job.job, "lint");
  assert.equal(first.job.status, CI_RUNNING);
  assert.equal(first.job.attempts, 1);
  // tiny lacks x64, so the remaining job must wait for big.
  assert.equal(m.claimJob(linux.runner_id).ok, false);
  const second = m.claimJob(big.runner_id);
  assert.equal(second.ok, true);
  assert.equal(second.job.job, "test");
  assert.equal(m.claimJob(big.runner_id).ok, false); // no_jobs
  assert.equal(m.claimJob("runner_9999").ok, false);
  assert.equal(m.claimJob("").ok, false);
  assert.equal(m.claimJob(null).ok, false);
});

test("claimJob fails closed on stale runners until heartbeat", () => {
  const c = fixedClock();
  const { m } = withRun(c);
  const { runner_id } = m.registerRunner({ name: "r1", labels: ["linux", "x64"] });
  c.advance(61_000);
  assert.equal(m.claimJob(runner_id).error, "stale_runner");
  assert.equal(m.heartbeat(runner_id).ok, true);
  assert.equal(m.claimJob(runner_id).ok, true);
});

test("completeJob records conclusions and rolls the run up", () => {
  const c = fixedClock();
  const { m, started } = withRun(c);
  const { runner_id } = m.registerRunner({ name: "r1", labels: ["linux", "x64"] });
  const a = m.claimJob(runner_id);
  const done = m.completeJob({ jobId: a.job.job_id, conclusion: "success" });
  assert.equal(done.ok, true);
  assert.equal(done.job.status, CI_COMPLETED);
  assert.equal(done.run.status, "in_progress");
  const b = m.claimJob(runner_id);
  const last = m.completeJob({ jobId: b.job.job_id, conclusion: "success" });
  assert.equal(last.run.status, CI_COMPLETED);
  assert.equal(last.run.conclusion, "success");
  void started;
});

test("completeJob rejects every bad path", () => {
  const c = fixedClock();
  const { m } = withRun(c);
  const { runner_id } = m.registerRunner({ name: "r1", labels: ["linux", "x64"] });
  assert.equal(m.completeJob(null).ok, false);
  assert.equal(m.completeJob({}).ok, false);
  assert.equal(m.completeJob({ jobId: "", conclusion: "success" }).ok, false);
  assert.equal(m.completeJob({ jobId: "job_9999", conclusion: "success" }).ok, false);
  // Queued job is not claimable-yet: must claim first.
  assert.equal(m.completeJob({ jobId: "job_0001", conclusion: "success" }).error, "not_claimed");
  const claimed = m.claimJob(runner_id);
  assert.equal(m.completeJob({ jobId: claimed.job.job_id, conclusion: "bogus" }).ok, false);
  assert.equal(m.completeJob({ jobId: claimed.job.job_id, conclusion: "success", artifacts: "x" }).ok, false);
  assert.equal(m.completeJob({ jobId: claimed.job.job_id, conclusion: "success", artifacts: [{}] }).ok, false);
  assert.equal(m.completeJob({ jobId: claimed.job.job_id, conclusion: "success" }).ok, true);
  assert.equal(m.completeJob({ jobId: claimed.job.job_id, conclusion: "success" }).error, "already_terminal");
});

test("completeJob stores inline artifacts", () => {
  const c = fixedClock();
  const { m } = withRun(c);
  const { runner_id } = m.registerRunner({ name: "r1", labels: ["linux", "x64"] });
  const claimed = m.claimJob(runner_id);
  const out = m.completeJob({
    jobId: claimed.job.job_id,
    conclusion: "success",
    artifacts: [{ name: "log.txt", content: "ok" }],
  });
  assert.equal(out.ok, true);
  assert.deepEqual(out.artifacts, ["art_0001"]);
  const listed = m.listArtifacts({ job_id: claimed.job.job_id });
  assert.equal(listed.artifacts.length, 1);
  assert.equal(listed.artifacts[0].name, "log.txt");
});

test("storeArtifact/listArtifacts validate targets and filter", () => {
  const c = fixedClock();
  const { m, started } = withRun(c);
  assert.equal(m.storeArtifact(null).ok, false);
  assert.equal(m.storeArtifact({ name: "a", content: "x" }).error, "invalid_target");
  assert.equal(m.storeArtifact({ runId: "run_9999", name: "a", content: "x" }).ok, false);
  assert.equal(m.storeArtifact({ runId: started.run_id, name: "", content: "x" }).ok, false);
  assert.equal(m.storeArtifact({ runId: started.run_id, name: "a", content: 42 }).ok, false);
  const ok = m.storeArtifact({ runId: started.run_id, jobId: started.jobs[0], name: "a.txt", content: "hi" });
  assert.equal(ok.ok, true);
  assert.equal(ok.artifact.artifact_id, "art_0001");
  assert.equal(m.listArtifacts({ run_id: started.run_id }).artifacts.length, 1);
  assert.equal(m.listArtifacts({ run_id: SHA_A }).artifacts.length, 0);
  assert.equal(m.listArtifacts({ job_id: started.jobs[1] }).artifacts.length, 0);
  assert.equal(m.listArtifacts(null).ok, false);
  assert.equal(m.listArtifacts({ run_id: "" }).ok, false);
});

test("artifact store adapter is injectable", () => {
  const c = fixedClock();
  const injected = createMemoryArtifactStore();
  const m = CI(c, { artifactStore: injected });
  m.definePipeline(PIPE);
  const started = m.startRun({ pipeline: "web", sha: SHA_A, branch: "main" });
  const saved = m.storeArtifact({ runId: started.run_id, name: "n", content: "c" });
  assert.equal(saved.ok, true);
  assert.equal(injected.byId.size, 1);
});

test("oversized artifacts fail closed", () => {
  const c = fixedClock();
  const m = CI(c, { store: createMemoryStore() });
  m.definePipeline(PIPE);
  const started = m.startRun({ pipeline: "web", sha: SHA_A, branch: "main" });
  const big = "x".repeat(1_000_001);
  assert.equal(m.storeArtifact({ runId: started.run_id, name: "big", content: big }).error, "artifact_too_large");
});

test("statusChecks rollup: pending then success", () => {
  const c = fixedClock();
  const { m } = withRun(c);
  const { runner_id } = m.registerRunner({ name: "r1", labels: ["linux", "x64"] });
  const pending = m.statusChecks({ sha: SHA_A });
  assert.equal(pending.ok, true);
  assert.equal(pending.state, "pending");
  assert.equal(pending.total, 2);
  assert.equal(pending.completed, 0);
  for (const job of [m.claimJob(runner_id).job, m.claimJob(runner_id).job]) {
    m.completeJob({ jobId: job.job_id, conclusion: "success" });
  }
  const green = m.statusChecks({ sha: SHA_A });
  assert.equal(green.state, "success");
  assert.equal(green.completed, 2);
  assert.equal(green.success, 2);
  assert.equal(green.failure, 0);
});

test("statusChecks reports failure on any failed job", () => {
  const c = fixedClock();
  const { m } = withRun(c);
  const { runner_id } = m.registerRunner({ name: "r1", labels: ["linux", "x64"] });
  const a = m.claimJob(runner_id);
  m.completeJob({ jobId: a.job.job_id, conclusion: "failure" });
  const b = m.claimJob(runner_id);
  m.completeJob({ jobId: b.job.job_id, conclusion: "success" });
  assert.equal(m.statusChecks({ sha: SHA_A }).state, "failure");
});

test("statusChecks rejects unknown shas", () => {
  const c = fixedClock();
  const { m } = withRun(c);
  assert.equal(m.statusChecks(null).ok, false);
  assert.equal(m.statusChecks({}).ok, false);
  assert.equal(m.statusChecks({ sha: "zzz" }).ok, false);
  assert.equal(m.statusChecks({ sha: SHA_B }).error, "not_found");
  void m;
});

test("rerunFailed requeues only failed jobs", () => {
  const c = fixedClock();
  const { m, started } = withRun(c);
  const { runner_id } = m.registerRunner({ name: "r1", labels: ["linux", "x64"] });
  const a = m.claimJob(runner_id);
  m.completeJob({ jobId: a.job.job_id, conclusion: "failure" });
  const b = m.claimJob(runner_id);
  m.completeJob({ jobId: b.job.job_id, conclusion: "success" });
  const rerun = m.rerunFailed(started.run_id);
  assert.equal(rerun.ok, true);
  assert.deepEqual(rerun.rerun, [started.jobs[0]]);
  const job = m.getJob(started.jobs[0]);
  assert.equal(job.job.status, CI_QUEUED);
  assert.equal(job.job.conclusion, null);
  // Reclaimed, fixed, and green.
  const retry = m.claimJob(runner_id);
  assert.equal(retry.job.attempts, 2);
  m.completeJob({ jobId: retry.job.job_id, conclusion: "success" });
  assert.equal(m.statusChecks({ sha: SHA_A }).state, "success");
});

test("rerunFailed fails closed without failures", () => {
  const c = fixedClock();
  const { m, started } = withRun(c);
  assert.equal(m.rerunFailed(started.run_id).error, "no_failed_jobs");
  assert.equal(m.rerunFailed("run_9999").ok, false);
  assert.equal(m.rerunFailed("").ok, false);
  assert.equal(m.rerunFailed(null).ok, false);
});

test("getters fail closed on bad ids", () => {
  const c = fixedClock();
  const { m } = withRun(c);
  assert.equal(m.getRun("run_9999").ok, false);
  assert.equal(m.getRun("").ok, false);
  assert.equal(m.getJob("job_9999").ok, false);
  assert.equal(m.getJob("").ok, false);
  assert.equal(m.getPipeline("missing").ok, false);
  assert.equal(m.getRunner("runner_9999").ok, false);
  assert.equal(m.listJobs("run_9999").ok, false);
});

test("ids are deterministic for the same clock and ops", () => {
  const a = fixedClock();
  const b = fixedClock();
  const ma = withRun(a);
  const mb = withRun(b);
  assert.equal(ma.started.run_id, mb.started.run_id);
  assert.deepEqual(ma.started.jobs, mb.started.jobs);
});

test("file-backed store survives a manager restart via injectable fs", () => {
  const files = new Map();
  const fs = {
    readFile: (p) => {
      if (!files.has(p)) {
        const err = new Error(`ENOENT: ${p}`);
        err.code = "ENOENT";
        throw err;
      }
      return files.get(p);
    },
    writeFile: (p, s) => { files.set(p, String(s)); },
    rename: (a, b) => { files.set(b, files.get(a)); files.delete(a); },
    mkdir: () => {},
  };
  const mk = () => createPipelineManager({
    store: createFileStore({ path: "ci/ci.json", fs }),
    nowMs: fixedClock().nowMs,
  });
  const a = mk();
  assert.equal(a.definePipeline(PIPE).ok, true);
  const started = a.startRun({ pipeline: "web", sha: SHA_A, branch: "main" });
  const { runner_id } = a.registerRunner({ name: "r1", labels: ["linux", "x64"] });
  const claimed = a.claimJob(runner_id);
  a.completeJob({ jobId: claimed.job.job_id, conclusion: "success", artifacts: [{ name: "log", content: "x" }] });
  const b = mk();
  const got = b.getRun(started.run_id);
  assert.equal(got.ok, true);
  assert.equal(got.jobs.length, 2);
  assert.equal(b.statusChecks({ sha: SHA_A }).state, "pending");
  assert.equal(b.listArtifacts({}).artifacts.length, 1);
  const next = b.startRun({ pipeline: "web", sha: SHA_B, branch: "main" });
  assert.equal(next.run_id, "run_0002"); // counter survived the restart
});

test("singleton shortcuts share the default store", () => {
  const def = definePipeline({ name: "singleton-probe", jobs: [{ id: "j", "runs-on": "solo", steps: ["s"] }] });
  assert.equal(def.ok, true);
  const started = startRun({ pipeline: "singleton-probe", sha: SHA_A, branch: "main" });
  assert.equal(started.ok, true);
  const reg = registerRunner({ name: "singleton-runner", labels: ["solo"] });
  assert.equal(reg.ok, true);
  assert.equal(heartbeat(reg.runner_id).ok, true);
  const claimed = claimJob(reg.runner_id);
  assert.equal(claimed.ok, true);
  assert.equal(completeJob({ jobId: claimed.job.job_id, conclusion: "skipped" }).ok, true);
  assert.equal(getRun(started.run_id).ok, true);
  assert.equal(statusChecks({ sha: SHA_A }).ok, true);
  assert.equal(rerunFailed(started.run_id).ok, false); // skipped is not a failure
  assert.equal(storeArtifact({ runId: started.run_id, name: "s", content: "c" }).ok, true);
  assert.equal(listArtifacts({ run_id: started.run_id }).ok, true);
  void CI_QUEUED;
  void CI_RUNNING;
  void CI_COMPLETED;
});
