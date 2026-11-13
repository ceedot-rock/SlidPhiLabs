/**
 * Conductor tasks 0.1.0 — Worker lifecycle mirrored as receipts.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Pure deterministic state machine: intent -> pushed -> in_review ->
 * approved | rejected. Every transition appends a receipt carrying a
 * sha256 digest, so the full lifecycle is auditable offline.
 *
 * Deterministic offline default: in-memory Map store, counter-based task
 * ids (task_0001, ...), slug branches (conductor/task-0001), injectable
 * now() clock. No disk, no network. Real executors/branches plug in via
 * adapters on createTaskManager. Fail-closed envelopes: every entry
 * returns { ok:true, ... } or { ok:false, error } and never throws on
 * bad input.
 */
import { createHash } from "node:crypto";
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

export const TASK_INTENT = "intent";
export const TASK_PUSHED = "pushed";
export const TASK_IN_REVIEW = "in_review";
export const TASK_APPROVED = "approved";
export const TASK_REJECTED = "rejected";

export const TASK_VERSION = "0.1.0";

const TERMINAL = new Set([TASK_APPROVED, TASK_REJECTED]);
const REVIEW_VERDICTS = new Set(["approve", "review", "block"]);

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function copy(v) {
  return JSON.parse(JSON.stringify(v));
}

function defaultNow() {
  return new Date().toISOString();
}

export function sha256hex(text) {
  return createHash("sha256").update(String(text ?? ""), "utf8").digest("hex");
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
  if (typeof path !== "string" || path === "") throw new Error("conductor-tasks: file store path required");
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
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.tasks)) {
      return { ok: false, error: "corrupt_store" };
    }
    store.byId = new Map(parsed.tasks.map((t) => [t.task_id, t]));
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
      const raw = JSON.stringify({ next: store.next, tasks: [...store.byId.values()] });
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

function slugBranch(taskId) {
  const n = String(taskId || "").replace(/^task_/, "");
  return `conductor/task-${n}`;
}

/** Digest binding one receipt to its transition. Deterministic. */
export function transitionDigest({ task_id, from, to, seq, detail }) {
  return sha256hex([task_id, from, to, String(seq), JSON.stringify(detail ?? null)].join("|"));
}

/**
 * Create a task manager (pure state machine + receipts).
 * @param {object} [opts]
 * @param {object} [opts.store] injectable store from createMemoryStore().
 * @param {function} [opts.now] injectable clock () => ISO string.
 * @param {function} [opts.branchFor] injectable adapter (task_id) => branch.
 */
export function createTaskManager(opts = {}) {
  const store = opts.store || (opts.storePath ? createFileStore({ path: opts.storePath, fs: opts.fs || null }) : createMemoryStore());
  if (typeof store.load === "function") {
    try {
      store.load();
    } catch {
      /* corrupt store surfaces on save; manager still serves memory */
    }
  }
  const now = opts.now || defaultNow;
  const branchFor = opts.branchFor || slugBranch;
  if (!store.byId) store.byId = new Map();
  if (!Number.isSafeInteger(store.next) || store.next < 1) store.next = 1;

  function appendReceipt(task, from, to, detail) {
    const seq = task.receipts.length + 1;
    const digest = transitionDigest({ task_id: task.task_id, from, to, seq, detail });
    const receipt = { seq, from, to, at: now(), digest, detail: copy(detail ?? {}) };
    task.receipts.push(receipt);
    task.digest = digest;
    task.updated_at = receipt.at;
    return receipt;
  }

  function get(task_id) {
    if (typeof task_id !== "string" || task_id === "") return null;
    return store.byId.get(task_id) || null;
  }

  function intentTask(input = {}) {
    if (!isPlainObject(input)) return fail("invalid_input");
    const prompt = input.prompt;
    if (typeof prompt !== "string" || prompt.trim() === "") return fail("invalid_prompt");
    const n = store.next;
    store.next = n + 1;
    const task_id = `task_${String(n).padStart(4, "0")}`;
    let branch;
    try {
      branch = String(branchFor(task_id) ?? "");
    } catch {
      return fail("branch_adapter_failed");
    }
    if (branch === "") return fail("branch_adapter_failed");
    const at = now();
    const task = {
      task_id,
      branch,
      status: TASK_INTENT,
      prompt,
      receipts: [],
      digest: "",
      created_at: at,
      updated_at: at,
    };
    appendReceipt(task, "none", TASK_INTENT, { prompt });
    store.byId.set(task_id, task);
    persist(store);
    return { ok: true, task_id, branch, status: task.status, digest: task.digest };
  }

  function pushTask(task_id, detail = {}) {
    const task = get(task_id);
    if (!task) return fail(typeof task_id === "string" && task_id !== "" ? "not_found" : "invalid_task_id");
    if (!isPlainObject(detail)) return fail("invalid_detail");
    if (TERMINAL.has(task.status)) return fail("already_terminal");
    if (task.status !== TASK_INTENT) return fail("invalid_transition");
    const receipt = appendReceipt(task, task.status, TASK_PUSHED, detail);
    task.status = TASK_PUSHED;
    persist(store);
    void receipt;
    return { ok: true, task_id: task.task_id, status: task.status, digest: task.digest };
  }

  function reviewTask(task_id, input = {}) {
    const task = get(task_id);
    if (!task) return fail(typeof task_id === "string" && task_id !== "" ? "not_found" : "invalid_task_id");
    if (!isPlainObject(input)) return fail("invalid_input");
    const verdict = input.verdict;
    if (typeof verdict !== "string" || !REVIEW_VERDICTS.has(verdict)) return fail("invalid_verdict");
    if (TERMINAL.has(task.status)) return fail("already_terminal");
    if (task.status !== TASK_PUSHED) return fail("invalid_transition");
    const detail = { verdict, notes: input.notes === undefined ? "" : String(input.notes) };
    appendReceipt(task, task.status, TASK_IN_REVIEW, detail);
    task.status = TASK_IN_REVIEW;
    persist(store);
    task.review_verdict = verdict;
    return { ok: true, task_id: task.task_id, status: task.status, verdict, digest: task.digest };
  }

  function approveTask(task_id, detail = {}) {
    const task = get(task_id);
    if (!task) return fail(typeof task_id === "string" && task_id !== "" ? "not_found" : "invalid_task_id");
    if (!isPlainObject(detail)) return fail("invalid_detail");
    if (TERMINAL.has(task.status)) return fail("already_terminal");
    if (task.status !== TASK_IN_REVIEW) return fail("invalid_transition");
    if (typeof task.review_verdict !== "string" || task.review_verdict === "") return fail("not_reviewed");
    appendReceipt(task, task.status, TASK_APPROVED, detail);
    task.status = TASK_APPROVED;
    persist(store);
    return { ok: true, task_id: task.task_id, status: task.status, digest: task.digest };
  }

  function rejectTask(task_id, input = {}) {
    const task = get(task_id);
    if (!task) return fail(typeof task_id === "string" && task_id !== "" ? "not_found" : "invalid_task_id");
    if (!isPlainObject(input)) return fail("invalid_input");
    if (TERMINAL.has(task.status)) return fail("already_terminal");
    if (task.status !== TASK_IN_REVIEW) return fail("invalid_transition");
    const detail = { reason: input.reason === undefined ? "" : String(input.reason) };
    appendReceipt(task, task.status, TASK_REJECTED, detail);
    task.status = TASK_REJECTED;
    persist(store);
    return { ok: true, task_id: task.task_id, status: task.status, digest: task.digest };
  }

  function getTask(task_id) {
    const task = get(task_id);
    if (!task) return fail(typeof task_id === "string" && task_id !== "" ? "not_found" : "invalid_task_id");
    return { ok: true, task: copy(task) };
  }

  function listTasks() {
    return [...store.byId.values()].map(copy);
  }

  function verifyTask(task_id) {
    const task = get(task_id);
    if (!task) return fail(typeof task_id === "string" && task_id !== "" ? "not_found" : "invalid_task_id");
    const checks = [];
    let prev = "";
    task.receipts.forEach((r, idx) => {
      const expected = transitionDigest({
        task_id: task.task_id,
        from: r.from,
        to: r.to,
        seq: r.seq,
        detail: r.detail,
      });
      const seqOk = r.seq === idx + 1;
      const digestOk = r.digest === expected;
      checks.push({ seq: r.seq, ok: seqOk && digestOk });
      if (idx === task.receipts.length - 1) prev = r.digest;
    });
    const ok = checks.length > 0 && checks.every((c) => c.ok) && task.digest === prev;
    return { ok, checks, digest: task.digest };
  }

  return { intentTask, pushTask, reviewTask, approveTask, rejectTask, getTask, listTasks, verifyTask, store };
}

const DEFAULT_MANAGER = createTaskManager();

/** Singleton-backed shortcuts over the default in-memory store. */
export function intentTask(input) {
  return DEFAULT_MANAGER.intentTask(input);
}

export function pushTask(task_id, detail) {
  return DEFAULT_MANAGER.pushTask(task_id, detail);
}

export function reviewTask(task_id, input) {
  return DEFAULT_MANAGER.reviewTask(task_id, input);
}

export function approveTask(task_id, detail) {
  return DEFAULT_MANAGER.approveTask(task_id, detail);
}

export function rejectTask(task_id, input) {
  return DEFAULT_MANAGER.rejectTask(task_id, input);
}

export function getTask(task_id) {
  return DEFAULT_MANAGER.getTask(task_id);
}

export function listTasks() {
  return DEFAULT_MANAGER.listTasks();
}
