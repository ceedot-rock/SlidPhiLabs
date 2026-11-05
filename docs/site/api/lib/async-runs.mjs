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
  const store = opts.store || createMemoryStore();
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
