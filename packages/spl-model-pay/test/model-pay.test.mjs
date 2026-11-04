/**
 * spl-model-pay tests — deterministic: every expected value is computed
 * in-code below, never hand-figured. Run: npm test (node --test test/).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceUsage, quoteSessions, computeOp, listModels, MARKUP,
         PINNED_CARD } from '../src/index.mjs';
import { fetchRemoteCard, rateFor } from '../src/rates.mjs';

const card = { ...PINNED_CARD, id: 'test' };

test('heavy psi session prices from rates, not from memory', async () => {
  const usage = { model: 'frontier', input: 63881820, cached: 61173893,
                  output: 622759 };
  const q = await priceUsage(usage, { card, at: '2026-10-28T00:00:00Z' });
  const row = PINNED_CARD.models.frontier;
  const fresh = usage.input - usage.cached;
  const op = (fresh / 1e6) * row.input + (usage.cached / 1e6) * row.cachedInput
    + (usage.output / 1e6) * row.output;
  assert.ok(Math.abs(q.opUsd - op) < 1e-6, `op ${q.opUsd} vs ${op}`);
  assert.equal(q.card.id, 'test');
  assert.equal(q.model, 'frontier');
});

test('margin never exceeds 19% on any model or shape', async () => {
  const shapes = [
    { input: 0, cached: 0, output: 0 },
    { input: 1200000, cached: 1100000, output: 10000 },
    { input: 451518997, cached: 431856941, output: 3622121 },
    { input: 100, cached: 0, output: 100000 },
    { input: 1e9, cached: 9.5e8, output: 1e7 },
  ];
  for (const model of listModels(card)) {
    for (const s of shapes) {
      const q = await priceUsage({ model, ...s }, { card });
      assert.ok(q.margin <= MARKUP + 1e-9, `${model} margin ${q.margin}`);
      assert.ok(q.priceUsd <= q.opUsd * (1 + MARKUP) + 1e-9);
    }
  }
});

test('unknown model fails closed', async () => {
  await assert.rejects(priceUsage({ model: 'nope', input: 10 }, { card }),
                       /unknown model/);
});

test('cached clamps to input (cached is a subset)', () => {
  const a = computeOp({ model: 'frontier', input: 100, cached: 500,
                        output: 0 }, card);
  const b = computeOp({ model: 'frontier', input: 100, cached: 100,
                        output: 0 }, card);
  assert.equal(a.opUsd, b.opUsd);
});

test('unreachable remote card falls back (null, never throws)', async () => {
  const got = await fetchRemoteCard('http://127.0.0.1:9/nope');
  assert.equal(got, null);
});

test('bad rate rows rejected', () => {
  const bad = { models: { x: { input: -1, cachedInput: 0, output: 0 } } };
  assert.throws(() => rateFor(bad, 'x'), /bad rate/);
});

test('session batch sums tokens under one card', async () => {
  const q = await quoteSessions([
    { input: 1186508, cached: 1023540, output: 26780 },
    { input: 4770049, cached: 4087662, output: 75474 },
  ], { model: 'frontier', card });
  assert.equal(q.sessions, 2);
  assert.equal(q.tokens.input, 1186508 + 4770049);
  assert.ok(q.margin <= MARKUP + 1e-9);
});
