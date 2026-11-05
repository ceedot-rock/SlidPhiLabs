/**
 * Fail-closed JSON store loader — shared by every file-backed ledger.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * loadJson(path, fallback) reads and parses one JSON store file.
 * Missing file -> fallback (used as-is, or called when it is a function,
 * so callers can pass a blank-store factory). Anything else wrong —
 * unreadable bytes or unparseable JSON — throws CorruptStoreError.
 * Callers MUST fail closed on it: return { ok:false, error:"corrupt_store" }
 * and NEVER save over the file, so a corrupt ledger can never be silently
 * replaced by a blank one.
 *
 * checkAmountCents(value, { min }) validates integer money amounts in
 * cents with floor semantics and safe integers only, as a fail-closed
 * envelope { ok, cents } / { ok:false, error:"bad_amount" }.
 *
 * Deterministic offline defaults: no network, no models. The only I/O is
 * the single read — directories, adapters, and envelopes stay with the
 * callers.
 */
import { existsSync, readFileSync } from "node:fs";

export const CORRUPT_STORE = "corrupt_store";

export class CorruptStoreError extends Error {
  constructor(path, cause) {
    const detail = cause && (cause.message || cause) ? String(cause.message || cause) : "unparseable";
    super(`corrupt store: ${String(path)}: ${detail}`);
    this.name = "CorruptStoreError";
    this.code = "CORRUPT_STORE";
    this.path = String(path);
    if (cause !== undefined) this.cause = cause;
  }
}

export function isCorruptStoreError(e) {
  return !!e && (e instanceof CorruptStoreError || e.code === "CORRUPT_STORE" || e.name === "CorruptStoreError");
}

/**
 * Read and parse a JSON store file. Missing file yields the fallback;
 * corrupt content throws CorruptStoreError (never a blank store).
 */
export function loadJson(path, fallback) {
  const f = String(path);
  if (!existsSync(f)) return typeof fallback === "function" ? fallback() : fallback;
  let raw;
  try {
    raw = readFileSync(f, "utf8");
  } catch (e) {
    throw new CorruptStoreError(f, e);
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new CorruptStoreError(f, e);
  }
}

/**
 * Validate an integer money amount in cents. Floor semantics, safe
 * integers only; amounts below min fail closed with "bad_amount".
 */
export function checkAmountCents(value, { min = 1 } = {}) {
  const n = Math.floor(Number(value));
  if (!Number.isSafeInteger(n)) return { ok: false, error: "bad_amount" };
  const lo = Math.floor(Number(min));
  if (!Number.isSafeInteger(lo)) return { ok: false, error: "bad_amount" };
  if (n < lo) return { ok: false, error: "bad_amount" };
  return { ok: true, cents: n };
}
