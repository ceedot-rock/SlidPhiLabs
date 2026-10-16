import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { TransferService, TRANSFER_TTL_MS, PRICE_CENTS } from '../src/index.mjs';
import { CODES } from '../src/errors.mjs';
import { tempDir, demoRider, mockRiderVerify } from './helpers.mjs';

function svc(dir, opts = {}) {
  return new TransferService({ dir, ...opts });
}
const owner = () => demoRider('agent_owner', 'op_owner');
const recip = () => demoRider('agent_recip', 'op_recip');
const stranger = () => demoRider('agent_stranger', 'op_stranger');

async function createUploaded(t, recipient = 'agent_recip') {
  const c = await t.createTransfer({ recipient_agent_id: recipient, idempotency_key: 'k-' + Math.random() }, owner());
  await t.uploadTransfer(c.transfer_id, Buffer.from(JSON.stringify({ hello: 'world' })), owner());
  return c;
}

test('lifecycle: create -> upload -> status -> download -> DELIVERED', async () => {
  const t = svc(tempDir());
  const c = await t.createTransfer({ recipient_agent_id: 'agent_recip', idempotency_key: 'k1' }, owner());
  assert.equal(c.state, 'AVAILABLE', 'sandbox: free, immediately available');
  assert.ok(c.transfer_id.startsWith('trm_'));
  assert.equal(c.receipt.sandbox, true);
  assert.equal(c.receipt.settled, false, 'sandbox receipt never claims settlement');
  assert.equal(c.receipt.cents, 0);

  const up = await t.uploadTransfer(c.transfer_id, Buffer.from('payload-bytes'), owner());
  assert.equal(up.bytes, 13);

  const st = await t.getTransferStatus(c.transfer_id, recip());
  assert.equal(st.state, 'AVAILABLE');
  assert.equal(st.bytes, 13);

  const dl = await t.downloadTransfer(c.transfer_id, recip());
  assert.equal(dl.bytes.toString(), 'payload-bytes');
  assert.equal(dl.state, 'DELIVERED');
  const st2 = await t.getTransferStatus(c.transfer_id, recip());
  assert.equal(st2.state, 'DELIVERED');
});

test('ciphertext at rest is encrypted (not plaintext)', async () => {
  const t = svc(tempDir());
  const c = await createUploaded(t);
  const raw = readFileSync(join(t.dir, 'ciphertext', c.transfer_id + '.json'), 'utf8');
  assert.ok(!raw.includes('hello'), 'no plaintext in stored ciphertext');
  assert.ok(raw.includes('"iv"') && raw.includes('"tag"') && raw.includes('"data"'));
});

test('wrong recipient download denied', async () => {
  const t = svc(tempDir());
  const c = await createUploaded(t);
  await assert.rejects(t.downloadTransfer(c.transfer_id, stranger()), (e) => e.code === CODES.WRONG_RECIPIENT);
});

test('non-party learns nothing: status/delete -> TRANSFER_NOT_FOUND', async () => {
  const t = svc(tempDir());
  const c = await createUploaded(t);
  await assert.rejects(t.getTransferStatus(c.transfer_id, stranger()), (e) => e.code === CODES.TRANSFER_NOT_FOUND);
  await assert.rejects(t.deleteTransfer(c.transfer_id, stranger()), (e) => e.code === CODES.TRANSFER_NOT_FOUND);
  await assert.rejects(t.getTransferStatus('trm_doesnotexist', stranger()), (e) => e.code === CODES.TRANSFER_NOT_FOUND);
});

test('owner delete removes ciphertext; delete is idempotent', async () => {
  const t = svc(tempDir());
  const c = await createUploaded(t);
  const r = await t.deleteTransfer(c.transfer_id, owner());
  assert.equal(r.state, 'DELETED');
  assert.equal(existsSync(join(t.dir, 'ciphertext', c.transfer_id + '.json')), false);
  const r2 = await t.deleteTransfer(c.transfer_id, owner());
  assert.equal(r2.state, 'DELETED');
});

test('expiry: download after 72h fails; sweeper deletes idempotently', async () => {
  let now = Date.now();
  const t = svc(tempDir(), { now: () => now });
  const c = await createUploaded(t);
  now += TRANSFER_TTL_MS + 1000;
  await assert.rejects(t.downloadTransfer(c.transfer_id, recip()), (e) => e.code === CODES.TRANSFER_EXPIRED);
  const s1 = await t.sweep();
  assert.ok(s1.swept.includes(c.transfer_id));
  const s2 = await t.sweep();
  assert.deepEqual(s2.swept, [], 'second sweep is a no-op');
  assert.deepEqual(s2.errors, []);
});

test('logs contain no payloads or credentials', async () => {
  const t = svc(tempDir());
  const secret = 'sk-fake-secret-abcdef-12345';
  const c = await t.createTransfer({ recipient_agent_id: 'agent_recip', idempotency_key: 'klog' }, owner());
  await t.uploadTransfer(c.transfer_id, Buffer.from(JSON.stringify({ api_key: secret })), owner());
  await t.downloadTransfer(c.transfer_id, recip());
  const logRaw = readFileSync(join(t.dir, 'transfers.log.jsonl'), 'utf8');
  assert.ok(!logRaw.includes(secret), 'secret must not appear in logs');
  assert.ok(!logRaw.includes('api_key'));
  const lines = logRaw.trim().split('\n').map((l) => JSON.parse(l));
  assert.ok(lines.every((l) => l.transfer_id && l.ts && l.event));
});

test('billing disabled: recordSettlement -> BILLING_DISABLED', async () => {
  const t = svc(tempDir()); // billingEnabled defaults false
  const c = await createUploaded(t);
  await assert.rejects(
    t.recordSettlement(c.transfer_id, 'pay_123', { verifyPayment: async () => ({ verified: true }) }),
    (e) => e.code === CODES.BILLING_DISABLED,
  );
});

test('idempotent create: same key replays same transfer', async () => {
  const t = svc(tempDir());
  const a = await t.createTransfer({ recipient_agent_id: 'agent_recip', idempotency_key: 'idem-1' }, owner());
  const b = await t.createTransfer({ recipient_agent_id: 'agent_recip', idempotency_key: 'idem-1' }, owner());
  assert.equal(a.transfer_id, b.transfer_id);
  assert.equal(b.idempotent_replay, true);
});

test('idempotency key reuse with different params -> DUPLICATE_REQUEST', async () => {
  const t = svc(tempDir());
  await t.createTransfer({ recipient_agent_id: 'agent_recip', idempotency_key: 'idem-2' }, owner());
  await assert.rejects(
    t.createTransfer({ recipient_agent_id: 'agent_other', idempotency_key: 'idem-2' }, owner()),
    (e) => e.code === CODES.DUPLICATE_REQUEST,
  );
});

test('concurrent creates with same idempotency key -> exactly one transfer', async () => {
  const t = svc(tempDir());
  const rs = await Promise.all(Array.from({ length: 10 }, () =>
    t.createTransfer({ recipient_agent_id: 'agent_recip', idempotency_key: 'idem-race' }, owner())));
  const ids = new Set(rs.map((r) => r.transfer_id));
  assert.equal(ids.size, 1);
});

test('paid path (reference): settlement verified -> AVAILABLE, receipt settled', async () => {
  const dir = tempDir();
  const t = svc(dir, { billingEnabled: true }); // reference only; never enable in prod without approval
  const c = await t.createTransfer({ recipient_agent_id: 'agent_recip', idempotency_key: 'pay-k1' }, owner());
  assert.equal(c.state, 'PAYMENT_REQUIRED');
  assert.equal(c.price_cents, PRICE_CENTS);
  await t.uploadTransfer(c.transfer_id, Buffer.from('data'), owner());
  const s = await t.recordSettlement(c.transfer_id, 'pay_ref_1', { verifyPayment: async () => ({ verified: true }) });
  assert.equal(s.state, 'AVAILABLE');
  assert.equal(s.receipt.settled, true);
  assert.equal(s.receipt.sandbox, false);
  assert.equal(s.receipt.cents, 2);
  assert.equal(s.receipt.purpose, 'slidphi.toll-receipt/v1');
  assert.notEqual(s.receipt.format, 'slidphi.memory', 'receipt is a separate artifact from the memory export');

  // Crash recovery: state was persisted before the receipt returned.
  const t2 = svc(dir, { billingEnabled: true });
  const st = await t2.getTransferStatus(c.transfer_id, recip());
  assert.equal(st.state, 'AVAILABLE');
});

test('duplicate settlement notification is idempotent', async () => {
  const t = svc(tempDir(), { billingEnabled: true });
  const c = await t.createTransfer({ recipient_agent_id: 'agent_recip', idempotency_key: 'pay-k2' }, owner());
  const v = { verifyPayment: async () => ({ verified: true }) };
  const s1 = await t.recordSettlement(c.transfer_id, 'pay_ref_2', v);
  const s2 = await t.recordSettlement(c.transfer_id, 'pay_ref_2', v);
  assert.equal(s2.duplicate, true);
  assert.deepEqual(s2.receipt, s1.receipt, 'exactly one receipt');
});

test('settlement verification failure -> SETTLEMENT_FAILED, transfer FAILED', async () => {
  const t = svc(tempDir(), { billingEnabled: true });
  const c = await t.createTransfer({ recipient_agent_id: 'agent_recip', idempotency_key: 'pay-k3' }, owner());
  await assert.rejects(
    t.recordSettlement(c.transfer_id, 'pay_ref_3', { verifyPayment: async () => ({ verified: false, detail: 'no funds' }) }),
    (e) => e.code === CODES.SETTLEMENT_FAILED,
  );
  const t2 = svc(t.dir, { billingEnabled: true });
  const st = await t2.getTransferStatus(c.transfer_id, owner());
  assert.equal(st.state, 'FAILED');
});

test('unauthenticated create rejected', async () => {
  const t = svc(tempDir());
  await assert.rejects(
    t.createTransfer({ recipient_agent_id: 'x', idempotency_key: 'k' }, {
      rider: 'bogus',
      riderVerify: mockRiderVerify({ ok: false, code: CODES.RIDER_INVALID }),
    }),
    (e) => e.code === CODES.RIDER_INVALID,
  );
});

test('receipt signature verifies under the service receipt key', async () => {
  const t = svc(tempDir());
  const c = await t.createTransfer({ recipient_agent_id: 'agent_recip', idempotency_key: 'krc' }, owner());
  const { signature, ...body } = c.receipt;
  const { verify } = await import('../src/index.mjs');
  const ok = verify(t.serviceKey.receiptPublicJwk, Buffer.from(JSON.stringify(body), 'utf8'), signature);
  assert.equal(ok, true);
});
