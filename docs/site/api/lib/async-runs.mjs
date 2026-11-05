/**
 * Async runs 0.1.0 — submit/poll/complete ledger for background work.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Deterministic offline default: in-memory Map store, counter-based run
 * ids (run_0001, ...), injectable now() clock. No disk, no network.
 * I/O (real executors) plugs in via the executor adapter on
 * createRunManager; completeRun only records receipt objects, never runs them.
 * Fail-closed envelopes: every entry returns { ok:true, ... } or
 * { ok:false, error } and never throws on bad input.
 */

export const RUN_QUEUED = "queued";
export const RUN_RUNNING = "running";
export const RUN_COMPLETED = "completed";
export const RUN_FAILED = "failed";

const TERMINAL = new Set([RUN_COMPLETED, RUN_FAILED]);

import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

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

function defaultNow() {
  return new Date().toISOString();
}

/** Default in-memory store: { next, byId: Map }. Injectable for tests. */
export function createMemoryStore() {
  return { next: 1, byId: new Map() };
}

/**
 * File-backed store option: same { next, byId } shape plus save()/load(),
 * persisted as one JSON file (atomic tmp + rename). Deterministic offline:
 * the fs surface ({ readFile, writeFile, rename, mkdir }) is injectable so
 * tests never touch disk. load() tolerates a missing file (fresh store);
 * save() never throws — persistence faults return { ok:false } envelopes.
 */
export function createFileStore({ path, fs = null } = {}) {
  if (typeof path !== "string" || path === "") throw new Error("async-runs: file store path required");
  const io = fs || defaultFileFs();
  const store = { next: 1, byId: new Map() };

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
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.runs)) {
      return { ok: false, error: "corrupt_store" };
    }
    store.byId = new Map(parsed.runs.map((r) => [r.run_id, r]));
    store.next = Number.isSafeInteger(parsed.next) && parsed.next >= 1
      ? parsed.next
      : store.byId.size + 1;
    return { ok: true, loaded: store.byId.size };
  }

  function save() {
    try {
      try {
        io.mkdir(dirname(path));
      } catch {
        /* best-effort: parent may already exist */
      }
      const raw = JSON.stringify({ next: store.next, runs: [...store.byId.values()] });
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

function fail(error) {
  return { ok: false, error };
}

/**
 * Create a run manager.
 * @param {object} [opts]
 * @param {object} [opts.store] injectable store from createMemoryStore().
 * @param {function} [opts.now] injectable clock () => ISO string.
 * @param {function} [opts.executor] injectable async/sync adapter
 *   (spec) => ({ receipts?: array, error?: string }).
 */
export function createRunManager(opts = {}) {
  const store = opts.store || (opts.storePath ? createFileStore({ path: opts.storePath, fs: opts.fs || null }) : createMemoryStore());
  if (typeof store.load === "function") {
    try {
      store.load();
    } catch {
      /* corrupt store surfaces on save; manager still serves memory */
    }
  }
  const now = opts.now || defaultNow;
  const executor = opts.executor || null;
  if (!store.byId) store.byId = new Map();
  if (!Number.isSafeInteger(store.next) || store.next < 1) store.next = 1;

  function submitRun(spec) {
    if (!isPlainObject(spec)) return fail("invalid_spec");
    const n = store.next;
    store.next = n + 1;
    const run = {
      run_id: `run_${String(n).padStart(4, "0")}`,
      status: RUN_QUEUED,
      spec: copy(spec),
      receipts: [],
      submitted_at: now(),
      updated_at: now(),
    };
    store.byId.set(run.run_id, run);
    persist(store);
    return { ok: true, run_id: run.run_id, status: run.status };
  }

  function pollRun(run_id) {
    if (typeof run_id !== "string" || run_id === "") return fail("invalid_run_id");
    const run = store.byId.get(run_id);
    if (!run) return fail("not_found");
    return { ok: true, run: copy(run) };
  }

  function completeRun(run_id, result = {}) {
    if (typeof run_id !== "string" || run_id === "") return fail("invalid_run_id");
    const run = store.byId.get(run_id);
    if (!run) return fail("not_found");
    if (TERMINAL.has(run.status)) return fail("already_terminal");
    if (!isPlainObject(result)) return fail("invalid_result");
    const { receipts = [], status = RUN_COMPLETED, error = "" } = result;
    if (!Array.isArray(receipts)) return fail("invalid_receipts");
    if (status !== RUN_COMPLETED && status !== RUN_FAILED) return fail("invalid_status");
    run.status = status;
    run.receipts = copy(receipts);
    if (error !== "") run.error = String(error);
    run.updated_at = now();
    persist(store);
    return { ok: true, run: copy(run) };
  }

  function listRuns() {
    return [...store.byId.values()].map(copy);
  }

  /**
   * Run the injected executor for one queued run and record its outcome.
   * No executor injected -> fail-closed { ok:false }. The executor's
   * return value is data only: { receipts } completes, { error } fails.
   */
  async function executeRun(run_id) {
    if (!executor) return fail("no_executor");
    if (typeof run_id !== "string" || run_id === "") return fail("invalid_run_id");
    const run = store.byId.get(run_id);
    if (!run) return fail("not_found");
    if (run.status !== RUN_QUEUED) return fail("not_queued");
    run.status = RUN_RUNNING;
    run.updated_at = now();
    persist(store);
    let out;
    try {
      out = await executor(copy(run.spec));
    } catch (err) {
      return completeRun(run_id, { status: RUN_FAILED, error: String((err && err.message) || err) });
    }
    if (!isPlainObject(out)) {
      return completeRun(run_id, { status: RUN_FAILED, error: "executor_bad_return" });
    }
    if (out.error != null && out.error !== "") {
      return completeRun(run_id, {
        status: RUN_FAILED,
        receipts: Array.isArray(out.receipts) ? out.receipts : [],
        error: String(out.error),
      });
    }
    if (out.receipts != null && !Array.isArray(out.receipts)) {
      return completeRun(run_id, { status: RUN_FAILED, error: "executor_bad_receipts" });
    }
    return completeRun(run_id, { receipts: out.receipts || [] });
  }

  return { submitRun, pollRun, completeRun, executeRun, listRuns, store };
}

const DEFAULT_MANAGER = createRunManager();

/** Singleton-backed shortcuts over the default in-memory store. */
export function submitRun(spec) {
  return DEFAULT_MANAGER.submitRun(spec);
}

export function pollRun(run_id) {
  return DEFAULT_MANAGER.pollRun(run_id);
}

export function completeRun(run_id, result) {
  return DEFAULT_MANAGER.completeRun(run_id, result);
}

export function listRuns() {
  return DEFAULT_MANAGER.listRuns();
}
