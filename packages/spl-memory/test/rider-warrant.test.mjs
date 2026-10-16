import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyRiderCredential } from '../src/rider.mjs';
import { validateWarrant, consumeWarrantCap } from '../src/warrant.mjs';
import { CODES } from '../src/errors.mjs';
import { tempDir, mockRiderVerify, mockWarrantVerify } from './helpers.mjs';
import { join } from 'node:path';

test('rider: claims test seam accepts valid claims', async () => {
  const r = await verifyRiderCredential({ agent_id: 'a', operator_id: 'o' }, { claims: true });
  assert.equal(r.ok, true);
  assert.equal(r.agent_id, 'a');
});

test('rider: expired/revoked claims rejected', async () => {
  const exp = await verifyRiderCredential({ agent_id: 'a', operator_id: 'o', exp: 1 }, { claims: true });
  assert.equal(exp.code, CODES.RIDER_EXPIRED);
  const rev = await verifyRiderCredential({ agent_id: 'a', operator_id: 'o', revoked: true }, { claims: true });
  assert.equal(rev.code, CODES.RIDER_REVOKED);
});

test('rider: injected verifier honored; malformed verifier fails closed', async () => {
  const ok = await verifyRiderCredential('tok', { verify: mockRiderVerify({ ok: true, agent_id: 'a', operator_id: 'o' }) });
  assert.equal(ok.ok, true);
  const bad = await verifyRiderCredential('tok', { verify: async () => ({}) });
  assert.equal(bad.ok, false);
  assert.equal(bad.code, CODES.RIDER_INVALID);
  const throwing = await verifyRiderCredential('tok', { verify: async () => { throw new Error('boom'); } });
  assert.equal(throwing.ok, false);
});

test('rider: missing credential rejected', async () => {
  const r = await verifyRiderCredential('', {});
  assert.equal(r.code, CODES.RIDER_INVALID);
});

test('warrant: scope enforcement', async () => {
  const w = { id: 'w1', actions: ['memory.import'], expires_at: new Date(Date.now() + 60000).toISOString() };
  const ok = await validateWarrant(w, { action: 'memory.import', verify: mockWarrantVerify({ ok: true, warrant: w }) });
  assert.equal(ok.ok, true);
  const scoped = await validateWarrant(
    { ...w, actions: ['memory.read'] },
    { action: 'memory.import', verify: mockWarrantVerify({ ok: true, warrant: { ...w, actions: ['memory.read'] } }) },
  );
  assert.equal(scoped.code, CODES.WARRANT_SCOPE);
});

test('warrant: expired rejected', async () => {
  const w = { id: 'w1', actions: ['*'], expires_at: new Date(Date.now() - 1000).toISOString() };
  const r = await validateWarrant(w, { verify: mockWarrantVerify({ ok: true, warrant: w }) });
  assert.equal(r.code, CODES.WARRANT_EXPIRED);
});

test('warrant: rejected by verifier', async () => {
  const r = await validateWarrant({ id: 'w1' }, { verify: mockWarrantVerify({ ok: false, code: 'WARRANT_INVALID' }) });
  assert.equal(r.code, CODES.WARRANT_INVALID);
});

test('cap: sequential consumption decrements to zero then CAP_EXCEEDED', async () => {
  const dir = tempDir();
  for (let i = 0; i < 3; i++) {
    const r = await consumeWarrantCap('wcap1', dir, 3);
    assert.equal(r.ok, true);
    assert.equal(r.remaining, 2 - i);
  }
  const over = await consumeWarrantCap('wcap1', dir, 3);
  assert.equal(over.ok, false);
  assert.equal(over.code, CODES.CAP_EXCEEDED);
});

test('cap: concurrent consumption is atomic — exactly max succeed', async () => {
  const dir = tempDir();
  const N = 20, MAX = 5;
  const results = await Promise.all(
    Array.from({ length: N }, () => consumeWarrantCap('wcapRace', join(dir, 'caps'), MAX)),
  );
  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.filter((r) => !r.ok && r.code === CODES.CAP_EXCEEDED).length;
  assert.equal(okCount, MAX, `exactly ${MAX} succeed, got ${okCount}`);
  assert.equal(failCount, N - MAX);
});

test('cap: unlimited when maxCalls absent', async () => {
  const dir = tempDir();
  const r = await consumeWarrantCap('wfree', dir, undefined);
  assert.equal(r.ok, true);
  assert.equal(r.remaining, Infinity);
});
