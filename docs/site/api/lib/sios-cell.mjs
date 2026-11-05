/**
 * SiOS cell 0.1.0 — minimal job-file mapping stamp.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Deterministic, offline, dependency-free pure functions: maps a job path
 * (`ppp:<id>`) to a SHA-256 stamp binding { kind, bytes, ok, path }, and
 * resolves the file slot for that path. No network, no clock, no storage;
 * the only injectable is an optional hashFn for tests.
 * Fail-closed envelopes: { ok:false, reason }.
 */
import { createHash } from "node:crypto";

export const SIOS_CELL_VERSION = "0.1.0";

export function sha256hex(text) {
  return createHash("sha256").update(String(text ?? ""), "utf8").digest("hex");
}

function digestOf(body, hashFn) {
  if (typeof hashFn === "function") return hashFn(body);
  return sha256hex(body);
}

function isNonEmptyString(x) {
  return typeof x === "string" && x.trim().length > 0;
}

/**
 * Resolve the deterministic file slot for a job path.
 * Adapters (all optional): { hashFn(body): string }.
 */
export function siosFile(path, adapters = {}) {
  if (!isNonEmptyString(path)) {
    return { ok: false, reason: "missing_path" };
  }
  const p = path.trim().slice(0, 200);
  const hashFn = adapters && typeof adapters.hashFn === "function" ? adapters.hashFn : undefined;
  return {
    ok: true,
    file: {
      path: p,
      slot: digestOf(`sios-file-v1|${p}`, hashFn).slice(0, 16),
    },
  };
}

/**
 * Stamp a job intake. Returns the stamp (with its file mapping) so callers
 * can attach it to receipts; the return value MUST be used, not ignored.
 * Adapters (all optional): { hashFn(body): string }.
 */
export function siosJob(input = {}, adapters = {}) {
  const root = input && typeof input === "object" ? input : {};
  const kind = isNonEmptyString(root.kind) ? root.kind.trim().slice(0, 40) : null;
  if (!kind) {
    return { ok: false, reason: "missing_kind" };
  }
  if (!isNonEmptyString(root.path)) {
    return { ok: false, reason: "missing_path" };
  }
  const bytes = Number(root.bytes);
  if (!Number.isFinite(bytes) || bytes < 0) {
    return { ok: false, reason: "bad_bytes", detail: "bytes must be a number >= 0" };
  }
  const p = root.path.trim().slice(0, 200);
  const ok = root.ok === true;
  const hashFn = adapters && typeof adapters.hashFn === "function" ? adapters.hashFn : undefined;
  const file = siosFile(p, adapters);
  const stamp = Object.freeze({
    kind,
    bytes,
    ok,
    path: p,
    file: file.file,
    digest: digestOf(`sios-cell-v1|${kind}|${bytes}|${ok ? 1 : 0}|${p}`, hashFn),
  });
  return { ok: true, stamp };
}
