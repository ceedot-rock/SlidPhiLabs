/**
 * Run executor 0.1.0 — real local executor adapter for async-runs.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Runs staged functions from a registry map with per-run timeout_ms,
 * retries, and exponential backoff. The returned executor matches the
 * async-runs adapter contract: (spec) => ({ receipts }) on success or
 * ({ error, receipts }) on failure, and never throws on bad input.
 *
 * Deterministic offline default: no disk, no network. Timing (sleep) is
 * injectable so tests never wait on a real clock. Backoff delay before
 * retry N (1-based) is backoffMs * 2^(N-1).
 */

export const RUN_EXECUTOR_VERSION = "0.1.0";
export const DEFAULT_TIMEOUT_MS = 5000;
export const DEFAULT_RETRIES = 1;
export const DEFAULT_BACKOFF_MS = 50;
export const MAX_RETRIES = 5;

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toTimeoutMs(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function toRetries(v, fallback) {
  if (v === undefined || v === null) return fallback;
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_RETRIES, Math.max(0, n));
}

function toBackoffMs(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

function lookupFn(registry, name) {
  if (registry instanceof Map) {
    const fn = registry.get(name);
    return typeof fn === "function" ? fn : null;
  }
  if (isPlainObject(registry)) {
    const fn = Object.prototype.hasOwnProperty.call(registry, name)
      ? registry[name]
      : null;
    return typeof fn === "function" ? fn : null;
  }
  return null;
}

/** Normalize a staged-function return into a receipts array. */
function normalizeReceipts(value) {
  if (value === undefined) return [];
  if (Array.isArray(value)) return value;
  if (isPlainObject(value) && Array.isArray(value.receipts)) return value.receipts;
  return [{ result: value }];
}

/**
 * Call fn(args) with a timeout. The waiter always resolves (never
 * rejects) so a slow function that settles late cannot cause an
 * unhandled rejection; its late result is dropped. Timeout scheduling
 * uses the injectable setTimer/clearTimer pair (real setTimeout by
 * default), NOT the backoff sleep, so recording sleeps only ever see
 * backoff delays.
 */
function callWithTimeout(fn, args, timeoutMs, setTimer, clearTimer) {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimer(() => {
      if (done) return;
      done = true;
      resolve({ ok: false, error: "timeout", timedOut: true });
    }, timeoutMs);
    (async () => {
      let out;
      try {
        out = { ok: true, value: await fn(args) };
      } catch (err) {
        out = { ok: false, error: String((err && err.message) || err) };
      }
      if (done) return;
      done = true;
      try {
        clearTimer(timer);
      } catch {
        // A broken timer adapter must not lose a completed result.
      }
      resolve(out);
    })();
  });
}

/**
 * Create a local executor for async-runs createRunManager({ executor }).
 * @param {object} [opts]
 * @param {Map|object} [opts.registry] fn name -> (args) => receipts|value.
 *   May return [{...}] receipts, { receipts:[...] }, a plain value
 *   (wrapped as [{ result }]), or { error } for a soft failure.
 * @param {number} [opts.defaultTimeoutMs] per-attempt timeout (default 5000).
 * @param {number} [opts.defaultRetries] retries after the first attempt (default 1).
 * @param {number} [opts.backoffMs] base backoff between attempts (default 50).
 * @param {function} [opts.sleep] injectable backoff clock (ms) => Promise.
 *   Defaults to a real setTimeout sleep.
 * @param {function} [opts.setTimer] injectable timeout scheduler
 *   (fn, ms) => handle. Defaults to setTimeout.
 * @param {function} [opts.clearTimer] injectable timeout canceller.
 *   Defaults to clearTimeout.
 */
export function createRunExecutor(opts = {}) {
  const o = isPlainObject(opts) ? opts : {};
  const registry = o.registry !== undefined ? o.registry : {};
  const defaultTimeoutMs = toTimeoutMs(
    o.defaultTimeoutMs !== undefined ? o.defaultTimeoutMs : o.timeoutMs,
    DEFAULT_TIMEOUT_MS,
  );
  const defaultRetries = toRetries(
    o.defaultRetries !== undefined ? o.defaultRetries : o.retries,
    DEFAULT_RETRIES,
  );
  const backoffMs = toBackoffMs(o.backoffMs, DEFAULT_BACKOFF_MS);
  const sleep = typeof o.sleep === "function" ? o.sleep : defaultSleep;
  const setTimer =
    typeof o.setTimer === "function" ? o.setTimer : (fn, ms) => setTimeout(fn, ms);
  const clearTimer =
    typeof o.clearTimer === "function" ? o.clearTimer : (h) => clearTimeout(h);

  async function executor(spec) {
    try {
      if (!isPlainObject(spec) || typeof spec.fn !== "string" || spec.fn === "") {
        return { error: "invalid_spec", receipts: [] };
      }
      const fn = lookupFn(registry, spec.fn);
      if (!fn) return { error: "unknown_fn", receipts: [] };
      const timeoutMs = toTimeoutMs(spec.timeout_ms, defaultTimeoutMs);
      const retries = toRetries(spec.retries, defaultRetries);
      const args = "args" in spec ? spec.args : {};
      let lastError = "executor_failed";
      for (let attempt = 0; attempt <= retries; attempt += 1) {
        if (attempt > 0) {
          try {
            await sleep(backoffMs * 2 ** (attempt - 1));
          } catch {
            // A broken sleep adapter must not cancel the retry itself.
          }
        }
        const out = await callWithTimeout(fn, args, timeoutMs, setTimer, clearTimer);
        if (out.ok) {
          const v = out.value;
          if (isPlainObject(v) && typeof v.error === "string" && v.error !== "") {
            lastError = v.error;
            continue;
          }
          return { receipts: normalizeReceipts(v) };
        }
        lastError = out.error;
      }
      return { error: lastError, receipts: [] };
    } catch {
      return { error: "executor_internal", receipts: [] };
    }
  }

  executor.executorVersion = RUN_EXECUTOR_VERSION;
  return executor;
}
