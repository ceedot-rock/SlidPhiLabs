/**
 * Scheduled runs 0.1.0 — cron-ish schedule store (memory default, file option).
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Schedules are { schedule_id, run_id, spec, every_ms, next_at,
 * created_at }. No timers live in this lib: dueSchedules(nowMs) is a
 * pure, non-mutating listing of what is due, and the driver executes
 * then advances the schedule with ackSchedule(id, nowMs), which
 * catch-ups past missed periods and reports how many were skipped.
 * Deterministic offline default: counter ids, injectable clock, in-memory
 * Map (nothing persists unless the caller opts in). Pass { file } for a
 * file-backed store: the book loads from file at creation (missing file =
 * empty; corrupt file fails every mutating call closed with
 * "ledger_corrupt" until the operator repairs it) and every mutation
 * persists atomically (tmp + rename). The fs surface ({ readFile,
 * writeFile, rename, exists }) is injectable for hermetic tests; the
 * default uses node:fs sync calls, no network.
 * Fail-closed envelopes everywhere; nothing here throws on bad input.
 */
import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";

export const SCHEDULED_RUNS_VERSION = "0.1.0";
export const MAX_CATCHUP_STEPS = 100000;

function defaultFs() {
  return {
    exists: (p) => existsSync(p),
    readFile: (p) => readFileSync(p, "utf8"),
    writeFile: (p, s) => writeFileSync(p, s, "utf8"),
    rename: (a, b) => renameSync(a, b),
  };
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function copy(v) {
  return JSON.parse(JSON.stringify(v));
}

function defaultClock() {
  return Date.now();
}

function byDue(a, b) {
  if (a.next_at !== b.next_at) return a.next_at - b.next_at;
  return a.schedule_id < b.schedule_id ? -1 : a.schedule_id > b.schedule_id ? 1 : 0;
}

/**
 * Create a schedule store.
 * @param {object} [opts] { nowMs?: () => number, file?: string, fs?: adapter }
 *   injectable clock; optional file path for the file-backed store; optional
 *   fs adapter ({ exists, readFile, writeFile, rename }).
 */
export function createScheduleStore(opts = {}) {
  const o = isPlainObject(opts) ? opts : {};
  const clock = typeof o.nowMs === "function" ? o.nowMs : defaultClock;
  const fs = isPlainObject(o.fs) ? { ...defaultFs(), ...o.fs } : defaultFs();
  const file = typeof o.file === "string" && o.file ? o.file : null;
  let next = 1;
  const byId = new Map();
  let corrupt = null;

  function snapshot() {
    return { version: SCHEDULED_RUNS_VERSION, next, schedules: [...byId.values()].map(copy) };
  }

  // File-backed boot: missing file = empty book; corrupt file = every
  // mutating call fails closed with ledger_corrupt (reads still serve).
  if (file) {
    try {
      if (fs.exists(file)) {
        const raw = fs.readFile(file);
        const book = JSON.parse(String(raw));
        if (!book || typeof book !== "object" || !Array.isArray(book.schedules)) {
          throw new Error("bad_book");
        }
        for (const s of book.schedules) {
          if (s && typeof s.schedule_id === "string") byId.set(s.schedule_id, copy(s));
        }
        if (Number.isSafeInteger(book.next) && book.next > next) next = Math.floor(book.next);
      }
    } catch (e) {
      corrupt = String((e && e.message) || e).slice(0, 200);
    }
  }

  function persist() {
    if (!file) return { ok: true };
    try {
      const tmp = `${file}.tmp`;
      fs.writeFile(tmp, JSON.stringify(snapshot()));
      fs.rename(tmp, file);
    } catch (e) {
      return { ok: false, error: "ledger_write_failed", detail: String((e && e.message) || e).slice(0, 200) };
    }
    return { ok: true };
  }

  function guardCorrupt() {
    if (corrupt !== null) return { ok: false, error: "ledger_corrupt", detail: corrupt };
    return null;
  }

  function nowDefaulted(v) {
    const n = v === undefined ? clock() : Number(v);
    return Number.isFinite(n) ? n : NaN;
  }

  function addSchedule(entry) {
    const blocked = guardCorrupt();
    if (blocked) return blocked;
    if (!isPlainObject(entry)) return { ok: false, error: "invalid_schedule" };
    const everyMs = Math.floor(Number(entry.every_ms));
    if (!Number.isSafeInteger(everyMs) || everyMs < 1) {
      return { ok: false, error: "invalid_every_ms" };
    }
    let schedule_id = entry.schedule_id;
    if (schedule_id === undefined) {
      schedule_id = `sched_${String(next).padStart(4, "0")}`;
      next += 1;
    }
    if (typeof schedule_id !== "string" || schedule_id === "") {
      return { ok: false, error: "invalid_schedule_id" };
    }
    if (byId.has(schedule_id)) return { ok: false, error: "already_exists" };
    const now = nowDefaulted(undefined);
    const rawNext =
      entry.next_at !== undefined
        ? Number(entry.next_at)
        : entry.start_at !== undefined
          ? Number(entry.start_at)
          : now + everyMs;
    if (!Number.isFinite(rawNext)) return { ok: false, error: "invalid_next_at" };
    const schedule = {
      schedule_id,
      run_id: typeof entry.run_id === "string" ? entry.run_id : "",
      spec: isPlainObject(entry.spec) ? copy(entry.spec) : {},
      every_ms: everyMs,
      next_at: rawNext,
      created_at: now,
    };
    byId.set(schedule_id, schedule);
    const saved = persist();
    if (!saved.ok) {
      byId.delete(schedule_id);
      return saved;
    }
    return { ok: true, schedule: copy(schedule) };
  }

  function getSchedule(schedule_id) {
    if (typeof schedule_id !== "string" || schedule_id === "") {
      return { ok: false, error: "invalid_schedule_id" };
    }
    const s = byId.get(schedule_id);
    if (!s) return { ok: false, error: "not_found" };
    return { ok: true, schedule: copy(s) };
  }

  function removeSchedule(schedule_id) {
    const blocked = guardCorrupt();
    if (blocked) return blocked;
    if (typeof schedule_id !== "string" || schedule_id === "") {
      return { ok: false, error: "invalid_schedule_id" };
    }
    if (!byId.has(schedule_id)) return { ok: false, error: "not_found" };
    const dropped = byId.get(schedule_id);
    byId.delete(schedule_id);
    const saved = persist();
    if (!saved.ok) {
      byId.set(schedule_id, dropped);
      return saved;
    }
    return { ok: true, schedule_id };
  }

  function listSchedules() {
    return [...byId.values()].map(copy).sort(byDue);
  }

  /** Pure listing of schedules with next_at <= nowMs. Never mutates. */
  function dueSchedules(nowMs) {
    const n = nowDefaulted(nowMs);
    if (!Number.isFinite(n)) return [];
    return [...byId.values()]
      .filter((s) => s.next_at <= n)
      .map(copy)
      .sort(byDue);
  }

  /**
   * Advance a schedule past nowMs (catch-up for missed periods).
   * Returns { ok:true, schedule, skipped } where skipped counts the
   * periods advanced past.
   */
  function ackSchedule(schedule_id, nowMs) {
    const blocked = guardCorrupt();
    if (blocked) return blocked;
    if (typeof schedule_id !== "string" || schedule_id === "") {
      return { ok: false, error: "invalid_schedule_id" };
    }
    const s = byId.get(schedule_id);
    if (!s) return { ok: false, error: "not_found" };
    const n = nowDefaulted(nowMs);
    if (!Number.isFinite(n)) return { ok: false, error: "invalid_now" };
    const prevNext = s.next_at;
    let skipped = 0;
    while (s.next_at <= n) {
      s.next_at += s.every_ms;
      skipped += 1;
      if (skipped > MAX_CATCHUP_STEPS) {
        s.next_at = n + s.every_ms;
        break;
      }
    }
    const saved = persist();
    if (!saved.ok) {
      s.next_at = prevNext;
      return saved;
    }
    return { ok: true, schedule: copy(s), skipped };
  }

  return { addSchedule, getSchedule, removeSchedule, listSchedules, dueSchedules, ackSchedule };
}
