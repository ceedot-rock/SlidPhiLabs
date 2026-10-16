// Machine-readable rollout status. Single source of truth is STATUS.json
// at the package root; public pages MUST be generated from or tested
// against it — no hand-written price/status claims that can drift.

import { readFileSync } from 'node:fs';

let cached = null;

/** Load and return the STATUS.json document (parsed, frozen). */
export function getStatus() {
  if (!cached) {
    const raw = readFileSync(new URL('../STATUS.json', import.meta.url), 'utf8');
    cached = Object.freeze(JSON.parse(raw));
  }
  return cached;
}

/** Test seam: clear the cache (picks up STATUS.json edits). */
export function clearStatusCache() {
  cached = null;
}
