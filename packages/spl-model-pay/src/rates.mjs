/**
 * spl-model-pay — pinned rate-card table (USD per 1M tokens).
 *
 * These are OPERATOR-CONFIGURED seed values with explicit effective dates,
 * not vendor quotes. Update them when provider pricing moves, or publish a
 * remote card (see RATES_URL below) which always wins over this table.
 * Every quote records the card id + version that priced it.
 */

export const MARKUP = 0.19; // customer price never exceeds 1.19x op cost

export const RATES_URL =
  process.env.SPL_MODEL_RATES_URL ||
  'https://www.slidphilabs.com/api/model-rates';

export const PINNED_CARD = {
  id: 'pinned',
  version: '2026-10-28.1',
  // effectiveFrom is ISO UTC; the engine picks the newest card whose
  // effectiveFrom is at or before the usage timestamp.
  effectiveFrom: '2026-10-28T00:00:00Z',
  models: {
    // Assumption profile used for psi operating-cost estimates 2026-10-28.
    frontier: { input: 3.0, cachedInput: 0.3, output: 15.0 },
    // Operator placeholders — replace with real contracted rates.
    standard: { input: 0.8, cachedInput: 0.08, output: 2.4 },
    economy: { input: 0.15, cachedInput: 0.015, output: 0.6 },
  },
};

/** Pick the rate row for a model, throwing on unknown models (fail closed). */
export function rateFor(card, model) {
  const row = card?.models?.[model];
  if (!row) {
    const known = card?.models ? Object.keys(card.models).join(', ') : '(none)';
    throw new Error(`unknown model '${model}' (known: ${known})`);
  }
  for (const k of ['input', 'cachedInput', 'output']) {
    if (typeof row[k] !== 'number' || !(row[k] >= 0)) {
      throw new Error(`bad rate ${k} for model '${model}'`);
    }
  }
  return row;
}

/** Fetch the remote card; null when unreachable (caller falls back). */
export async function fetchRemoteCard(url = RATES_URL) {
  try {
    const r = await fetch(url, { headers: { accept: 'application/json' } });
    if (!r.ok) return null;
    const card = await r.json();
    if (!card?.models || typeof card.models !== 'object') return null;
    return card;
  } catch {
    return null;
  }
}

/** Resolve which card prices a usage timestamp (remote wins, else pinned). */
export async function resolveCard(at = new Date()) {
  const remote = await fetchRemoteCard();
  const stamp = at instanceof Date ? at : new Date(at);
  const ok = (c) => c && new Date(c.effectiveFrom || 0) <= stamp && c.models;
  if (ok(remote)) return { ...remote, id: remote.id || 'remote' };
  return PINNED_CARD;
}
