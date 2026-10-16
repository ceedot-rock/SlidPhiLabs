// Warrant validation seam + atomic cap enforcement.
//
// Validates delegated-authority warrants through the existing warrant verify
// path (default: network call to the site verifier; inject `verify` for
// tests/offline). Cap decrements (max_calls) are atomic via a lockfile-
// guarded JSON ledger — unlike the site's warrant.mjs read-modify-write,
// which the audit flags as racy.
//
// validateWarrant(warrant, { action, verify?, now? }) -> { ok, code?, detail?, warrant? }
// consumeWarrantCap(warrantId, ledgerDir, { maxCalls }) -> { ok, code?, remaining? }

import { mkdirSync, openSync, closeSync, readFileSync, writeFileSync, renameSync, unlinkSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { CODES } from './errors.mjs';

const DEFAULT_VERIFY_URL = 'https://www.slidphilabs.com/api/warrant/verify';

async function defaultVerify(warrant) {
  let res;
  try {
    res = await fetch(DEFAULT_VERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ warrant }),
    });
  } catch (e) {
    return { ok: false, code: CODES.WARRANT_INVALID, detail: `verifier unreachable: ${e.message}` };
  }
  let body;
  try {
    body = await res.json();
  } catch {
    return { ok: false, code: CODES.WARRANT_INVALID, detail: 'verifier returned non-JSON' };
  }
  if (!body || typeof body !== 'object' || typeof body.ok !== 'boolean') {
    return { ok: false, code: CODES.WARRANT_INVALID, detail: 'bad verifier response' };
  }
  return body;
}

function actionAllowed(warrant, action) {
  const list = warrant.actions ?? warrant.action ?? warrant.scope;
  if (list === '*' || action === '*') return true;
  if (Array.isArray(list)) return list.includes(action) || list.includes('*');
  if (typeof list === 'string') return list === action;
  return false;
}

export async function validateWarrant(warrant, opts = {}) {
  const now = opts.now ?? Date.now();
  const action = opts.action ?? 'memory.import';
  if (!warrant || typeof warrant !== 'object') {
    return { ok: false, code: CODES.WARRANT_INVALID, detail: 'missing warrant' };
  }
  const verify = opts.verify ?? defaultVerify;
  let v;
  try {
    v = await verify(warrant, action);
  } catch (e) {
    return { ok: false, code: CODES.WARRANT_INVALID, detail: `verifier threw: ${e.message}` };
  }
  if (!v || typeof v !== 'object' || v.ok !== true) {
    const code = v && v.code === 'WARRANT_EXPIRED' ? CODES.WARRANT_EXPIRED : CODES.WARRANT_INVALID;
    return { ok: false, code, detail: (v && (v.detail || v.error)) || 'warrant rejected' };
  }
  const w = v.warrant ?? warrant;
  const expMs = w.expires_at ? Date.parse(w.expires_at) : (typeof w.exp === 'number' ? w.exp * 1000 : NaN);
  if (Number.isFinite(expMs) && expMs <= now) {
    return { ok: false, code: CODES.WARRANT_EXPIRED, detail: 'warrant expired' };
  }
  if (!actionAllowed(w, action)) {
    return { ok: false, code: CODES.WARRANT_SCOPE, detail: `warrant does not allow action ${action}` };
  }
  return { ok: true, warrant: { id: w.id ?? w.warrant_id, max_calls: w.max_calls ?? w.maxCalls, max_usd: w.max_usd ?? w.maxUsd, actions: w.actions ?? w.action } };
}

// ---------- atomic file lock ----------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Run fn() while holding an exclusive lockfile. Stale locks (older than
 * 30s, or owned by a dead pid) are stolen. Used for all read-modify-write
 * sequences that must be atomic under concurrency.
 */
export async function withFileLock(lockPath, fn, opts = {}) {
  const retries = opts.retries ?? 200;
  const delayMs = opts.delayMs ?? 10;
  mkdirSync(dirname(lockPath), { recursive: true });
  let fd;
  for (let i = 0; i < retries; i++) {
    try {
      fd = openSync(lockPath, 'wx');
      writeFileSync(lockPath, JSON.stringify({ pid: process.pid, at: Date.now() }));
      break;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      if (tryStealStaleLock(lockPath)) continue;
      await sleep(delayMs);
    }
  }
  if (fd === undefined) {
    const err = new Error(`lock timeout: ${lockPath}`);
    err.code = CODES.LOCK_TIMEOUT;
    throw err;
  }
  try {
    return await fn();
  } finally {
    try { closeSync(fd); } catch { /* ignore */ }
    try { unlinkSync(lockPath); } catch { /* ignore */ }
  }
}

function tryStealStaleLock(lockPath) {
  try {
    const raw = readFileSync(lockPath, 'utf8');
    const info = JSON.parse(raw);
    const age = Date.now() - (info.at || 0);
    if (age > 30000) {
      unlinkSync(lockPath);
      return true;
    }
    // Dead owner pid -> steal.
    try {
      process.kill(info.pid, 0);
    } catch {
      unlinkSync(lockPath);
      return true;
    }
  } catch {
    // Unreadable or unparseable (e.g. crashed between create and write):
    // steal only if the file itself is old, judged by mtime.
    try {
      const age = Date.now() - statSync(lockPath).mtimeMs;
      if (age > 30000) {
        unlinkSync(lockPath);
        return true;
      }
    } catch { /* leave it */ }
  }
  return false;
}

/** Atomic write: temp file + rename. */
export function atomicWriteFile(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp.${process.pid}.${Date.now()}`;
  writeFileSync(tmp, data);
  renameSync(tmp, path);
}

/**
 * Atomically consume one unit of a warrant's max_calls cap.
 * ledgerDir/<warrantId>.json holds { used }. Returns { ok:true, remaining }
 * or { ok:false, code:'CAP_EXCEEDED' }. Unlimited when maxCalls is null/undefined.
 */
export async function consumeWarrantCap(warrantId, ledgerDir, maxCalls) {
  if (maxCalls === undefined || maxCalls === null) return { ok: true, remaining: Infinity };
  if (!warrantId) return { ok: false, code: CODES.WARRANT_INVALID, detail: 'warrant has a cap but no id' };
  const ledgerPath = join(ledgerDir, `${warrantId}.json`);
  const lockPath = join(ledgerDir, `${warrantId}.lock`);
  return withFileLock(lockPath, () => {
    let used = 0;
    if (existsSync(ledgerPath)) {
      try {
        used = Number(JSON.parse(readFileSync(ledgerPath, 'utf8')).used) || 0;
      } catch { used = 0; }
    }
    if (used >= maxCalls) {
      return { ok: false, code: CODES.CAP_EXCEEDED, detail: `warrant ${warrantId} exhausted ${used}/${maxCalls} calls` };
    }
    used += 1;
    atomicWriteFile(ledgerPath, JSON.stringify({ used, max_calls: maxCalls, updated_at: new Date().toISOString() }));
    return { ok: true, remaining: maxCalls - used };
  });
}
