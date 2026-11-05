/**
 * Scheduled runs 0.1.0 — cron-ish in-memory schedule store.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Schedules are { schedule_id, run_id, spec, every_ms, next_at,
 * created_at }. No timers live in this lib: dueSchedules(nowMs) is a
 * pure, non-mutating listing of what is due, and the driver executes
 * then advances the schedule with ackSchedule(id, nowMs), which
 * catch-ups past missed periods and reports how many were skipped.
 * Deterministic offline default: counter ids, injectable clock.
 * Fail-closed envelopes everywhere; nothing here throws on bad input.
 */

export const SCHEDULED_RUNS_VERSION = "0.1.0";
export const MAX_CATCHUP_STEPS = 100000;

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
 * @param {object} [opts] { nowMs?: () => number } injectable clock.
 */
export function createScheduleStore(opts = {}) {
  const o = isPlainObject(opts) ? opts : {};
  const clock = typeof o.nowMs === "function" ? o.nowMs : defaultClock;
  let next = 1;
  const byId = new Map();

  function nowDefaulted(v) {
    const n = v === undefined ? clock() : Number(v);
    return Number.isFinite(n) ? n : NaN;
  }

  function addSchedule(entry) {
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
    if (typeof schedule_id !== "string" || schedule_id === "") {
      return { ok: false, error: "invalid_schedule_id" };
    }
    if (!byId.has(schedule_id)) return { ok: false, error: "not_found" };
    byId.delete(schedule_id);
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
    if (typeof schedule_id !== "string" || schedule_id === "") {
      return { ok: false, error: "invalid_schedule_id" };
    }
    const s = byId.get(schedule_id);
    if (!s) return { ok: false, error: "not_found" };
    const n = nowDefaulted(nowMs);
    if (!Number.isFinite(n)) return { ok: false, error: "invalid_now" };
    let skipped = 0;
    while (s.next_at <= n) {
      s.next_at += s.every_ms;
      skipped += 1;
      if (skipped > MAX_CATCHUP_STEPS) {
        s.next_at = n + s.every_ms;
        break;
      }
    }
    return { ok: true, schedule: copy(s), skipped };
  }

  return { addSchedule, getSchedule, removeSchedule, listSchedules, dueSchedules, ackSchedule };
}
