/**
 * Ops feed 0.1.0 — append-only operator event feed with in-memory tail.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Events: run_completed, cap_tripped, payout_sent, dispute_opened.
 * Deterministic offline default: memory only. Pass { file } to also append
 * JSON lines to disk; pass { append } to inject the writer adapter.
 * Swallow, never throw: unknown event types and persistence failures are
 * reported in the envelope ({ ok:false, swallowed:true } /
 * { ok:true, persisted:false }) so a feed fault can never break a caller.
 */
import { appendFileSync } from "node:fs";

export const OPS_EVENTS = Object.freeze([
  "run_completed",
  "cap_tripped",
  "payout_sent",
  "dispute_opened",
]);

export const OPS_DEFAULT_TAIL = 10;

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function defaultNow() {
  return new Date().toISOString();
}

/**
 * Create an ops feed.
 * @param {object} [opts]
 * @param {string|null} [opts.file] append-only JSONL path; null = memory only.
 * @param {function} [opts.append] injectable writer (path, line) => void.
 * @param {function} [opts.now] injectable clock () => ISO string.
 */
export function createOpsFeed(opts = {}) {
  const file = opts.file || null;
  const append = opts.append || ((path, line) => appendFileSync(path, line, "utf8"));
  const now = opts.now || defaultNow;
  let seq = 0;
  const events = [];

  function emit(type, detail = {}) {
    if (!OPS_EVENTS.includes(type)) {
      return { ok: false, swallowed: true, error: "unknown_event" };
    }
    if (detail !== undefined && !isPlainObject(detail)) {
      return { ok: false, swallowed: true, error: "invalid_detail" };
    }
    seq += 1;
    const event = {
      seq,
      type,
      at: now(),
      detail: JSON.parse(JSON.stringify(detail || {})),
    };
    events.push(event);
    if (file) {
      try {
        append(file, `${JSON.stringify(event)}\n`);
        return { ok: true, event: { ...event }, persisted: true };
      } catch {
        return { ok: true, event: { ...event }, persisted: false, error: "persist_failed" };
      }
    }
    return { ok: true, event: { ...event }, persisted: false };
  }

  function tail(n = OPS_DEFAULT_TAIL) {
    const count = Math.floor(Number(n));
    if (!Number.isSafeInteger(count) || count <= 0) return [];
    return events.slice(-count).map((e) => ({ ...e, detail: { ...e.detail } }));
  }

  function clear() {
    events.length = 0;
    seq = 0;
    return { ok: true };
  }

  return { emit, tail, clear, types: OPS_EVENTS };
}
