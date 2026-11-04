/**
 * spl-model-pay — model-based dynamic pricing engine.
 *
 * op cost = model rates x measured tokens; customer price = op x 1.19,
 * rounded DOWN to the cent so the margin can never exceed 19%.
 * Every quote names the card (id + version) that priced it, so a price
 * always changing with the models stays auditable.
 */
import { MARKUP, PINNED_CARD, rateFor, resolveCard } from './rates.mjs';

export { MARKUP, PINNED_CARD, rateFor, resolveCard };
export const SERVICE_NAME = 'SPL Model Pay';

const M = 1_000_000;

function toks(v, name) {
  const n = Number(v) || 0;
  if (n < 0 || !Number.isFinite(n)) throw new Error(`bad ${name}: ${v}`);
  return n;
}

/** Operating cost in USD for measured tokens under a resolved card. */
export function computeOp({ model, input = 0, cached = 0, output = 0 },
                          card = PINNED_CARD) {
  const row = rateFor(card, model);
  const inp = toks(input, 'input');
  const cac = Math.min(toks(cached, 'cached'), inp); // cached ⊆ input
  const out = toks(output, 'output');
  const fresh = inp - cac;
  const parts = {
    fresh: (fresh / M) * row.input,
    cached: (cac / M) * row.cachedInput,
    output: (out / M) * row.output,
  };
  return { opUsd: parts.fresh + parts.cached + parts.output, parts };
}

/** Full quote: op cost + capped customer price + provenance. */
export async function priceUsage(usage, opts = {}) {
  const card = opts.card || (await resolveCard(opts.at));
  const { opUsd, parts } = computeOp(usage, card);
  // Floor to the cent: margin is then provably <= MARKUP by construction.
  const priceUsd = Math.floor(opUsd * (1 + MARKUP) * 100) / 100;
  const at = opts.at instanceof Date ? opts.at.toISOString()
    : new Date(opts.at || Date.now()).toISOString();
  return {
    ok: true, service: SERVICE_NAME, model: usage.model, at,
    tokens: { input: usage.input || 0, cached: usage.cached || 0,
              output: usage.output || 0 },
    opUsd: +opUsd.toFixed(6), priceUsd: +priceUsd.toFixed(2),
    margin: opUsd > 0 ? +(priceUsd / opUsd - 1).toFixed(4) : 0,
    card: { id: card.id || 'remote', version: card.version || 'unversioned' },
    parts: Object.fromEntries(
      Object.entries(parts).map(([k, v]) => [k, +v.toFixed(6)])),
  };
}

/** Sum a session list into one quote (one card for the whole batch). */
export async function quoteSessions(sessions, opts = {}) {
  const card = opts.card || (await resolveCard(opts.at));
  const tot = { input: 0, cached: 0, output: 0 };
  for (const s of sessions) {
    tot.input += s.input || 0;
    tot.cached += s.cached || 0;
    tot.output += s.output || 0;
  }
  const q = await priceUsage({ model: opts.model, ...tot }, { ...opts, card });
  q.sessions = sessions.length;
  return q;
}

export function listModels(card = PINNED_CARD) {
  return Object.keys(card.models || {});
}

export default { priceUsage, quoteSessions, computeOp, listModels,
                 resolveCard, MARKUP, SERVICE_NAME };
