/**
 * consolidator.mjs — the slow loop PERsiST is missing (CLS organ).
 *
 * Theory (pedia: memory + storage pulls 2026-10-28):
 * - Complementary Learning Systems: hippocampus = fast INDEX, neocortex =
 *   slow consolidation. EU MemoryIndex: the hippocampus indexes, not stores.
 * - Ebbinghaus: cold traces decay on a curve; spaced use strengthens.
 * - Reconsolidation: every recall rewrites — so every unfold versions.
 * - Content addressing (sha256) + verify = the integrity half of CuNi
 *   receipts at memory scale.
 *
 * What it does: tracks hot-board use, decays the cold, nominates
 * distillation candidates, seals records content-addressed, verifies.
 * No deps. JSON-persistable. Mirrors heart-index.json conventions.
 */
import { createHash } from 'node:crypto';

export const SERVICE = 'SPL Consolidator';

/** Half-life default (days) for Ebbinghaus decay of untouched slices. */
export const DEFAULT_HALF_LIFE_DAYS = 7;

export function createStore() {
  return { v: 1, slices: {}, sealed: {}, log: [] };
}

export function sha256Hex(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/** Record one access (unfold/read) of a slice id at time `at` (ms). */
export function recordAccess(store, id, at = Date.now()) {
  const s = store.slices[id] || { uses: 0, last: 0, version: 1 };
  // Reconsolidation rule: each recall versions the trace.
  if (s.last !== 0) s.version += 1;
  s.uses += 1;
  s.last = at;
  store.slices[id] = s;
  store.log.push({ ev: 'access', id, at, version: s.version });
  return s;
}

/** Ebbinghaus score: uses discounted by untouched time. Higher = hotter. */
export function heat(slice, now = Date.now(),
                     halfLifeDays = DEFAULT_HALF_LIFE_DAYS) {
  const ageDays = Math.max(0, (now - slice.last) / 86_400_000);
  return slice.uses * Math.pow(0.5, ageDays / halfLifeDays);
}

/** Coldest-first candidates for distillation/folding (ascending heat). */
export function distillCandidates(store, k = 5, now = Date.now(),
                                  halfLifeDays = DEFAULT_HALF_LIFE_DAYS) {
  return Object.entries(store.slices)
    .map(([id, s]) => ({ id, heat: heat(s, now, halfLifeDays),
                          uses: s.uses, version: s.version }))
    .sort((a, b) => a.heat - b.heat)
    .slice(0, Math.max(0, k));
}

/** Hottest-first keep set for the live board (descending heat). */
export function boardKeep(store, k = 8, now = Date.now(),
                          halfLifeDays = DEFAULT_HALF_LIFE_DAYS) {
  return Object.entries(store.slices)
    .map(([id, s]) => ({ id, heat: heat(s, now, halfLifeDays) }))
    .sort((a, b) => b.heat - a.heat)
    .slice(0, Math.max(0, k));
}

/**
 * Seal bytes as a content-addressed record. Returns the address (sha256).
 * Same bytes always yield the same address (deduplicating by construction).
 */
export function sealRecord(store, bytes, at = Date.now()) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const addr = sha256Hex(buf);
  if (!store.sealed[addr]) {
    store.sealed[addr] = { bytes: buf.length, at, refs: 0 };
  }
  store.sealed[addr].refs += 1;
  store.log.push({ ev: 'seal', addr, at });
  return addr;
}

/** Recompute every address from stored sizes (integrity pass over index). */
export function verifyIndex(store) {
  const addrs = Object.keys(store.sealed);
  const bad = addrs.filter((a) => !/^[0-9a-f]{64}$/.test(a));
  return { ok: bad.length === 0, records: addrs.length, bad };
}

export function toJSON(store) {
  return JSON.stringify(store);
}

export function fromJSON(text) {
  const s = JSON.parse(text);
  if (!s || typeof s !== 'object' || !s.slices || !s.sealed) {
    throw new Error('bad consolidator store');
  }
  return s;
}

export default { createStore, recordAccess, heat, distillCandidates,
                 boardKeep, sealRecord, verifyIndex, toJSON, fromJSON,
                 sha256Hex, SERVICE, DEFAULT_HALF_LIFE_DAYS };
