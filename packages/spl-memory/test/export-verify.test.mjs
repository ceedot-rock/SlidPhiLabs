import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportMemory, verifyMemoryExport, revokeKeyFromPolicy, generateKeyPair } from '../src/index.mjs';
import { CODES, MemoryError } from '../src/errors.mjs';
import { makeEnvelope, sampleItems, testKey } from './helpers.mjs';

test('round trip: all four kinds verify', () => {
  const { envelope, trustPolicy } = makeEnvelope();
  const v = verifyMemoryExport(envelope, trustPolicy);
  assert.equal(v.authentic, true);
  assert.equal(v.key_id, 'test-key-1');
  assert.equal(v.alg, 'ES256');
  assert.equal(typeof v.ageMs, 'number');
  assert.equal(v.payload.items.length, 4);
});

test('one-byte tamper in payload -> INVALID_SIGNATURE', () => {
  const { envelope, trustPolicy } = makeEnvelope();
  const tampered = JSON.parse(JSON.stringify(envelope));
  tampered.payload.items[0].content.text = 'hellp world'; // one byte
  const v = verifyMemoryExport(tampered, trustPolicy);
  assert.equal(v.authentic, false);
  assert.equal(v.reason, CODES.INVALID_SIGNATURE);
});

test('one-byte tamper in signature -> INVALID_SIGNATURE', () => {
  const { envelope, trustPolicy } = makeEnvelope();
  const tampered = JSON.parse(JSON.stringify(envelope));
  const sig = tampered.proof.signature;
  tampered.proof.signature = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1);
  const v = verifyMemoryExport(tampered, trustPolicy);
  assert.equal(v.authentic, false);
  assert.equal(v.reason, CODES.INVALID_SIGNATURE);
});

test('wrong signing key -> INVALID_SIGNATURE', () => {
  const { envelope } = makeEnvelope({ keyId: 'test-key-1' });
  const other = testKey('test-key-1'); // same key_id, different key material
  const v = verifyMemoryExport(envelope, other.trustPolicy);
  assert.equal(v.authentic, false);
  assert.equal(v.reason, CODES.INVALID_SIGNATURE);
});

test('wrong alg -> UNSUPPORTED_ALG (no downgrade)', () => {
  const { envelope, trustPolicy } = makeEnvelope();
  const bad = JSON.parse(JSON.stringify(envelope));
  bad.proof.alg = 'RS256';
  const v = verifyMemoryExport(bad, trustPolicy);
  assert.equal(v.reason, CODES.UNSUPPORTED_ALG);
});

test('unknown key_id -> UNKNOWN_KEY', () => {
  const { envelope } = makeEnvelope();
  const v = verifyMemoryExport(envelope, [{ key_id: 'nope', publicKey: testKey('nope').kp.publicJwk }]);
  assert.equal(v.reason, CODES.UNKNOWN_KEY);
});

test('unknown format/version refused', () => {
  const { envelope, trustPolicy } = makeEnvelope();
  const b1 = JSON.parse(JSON.stringify(envelope));
  b1.payload.version = '2.0';
  assert.equal(verifyMemoryExport(b1, trustPolicy).reason, CODES.UNKNOWN_VERSION);
  const b2 = JSON.parse(JSON.stringify(envelope));
  b2.payload.format = 'evil.format';
  assert.equal(verifyMemoryExport(b2, trustPolicy).reason, CODES.UNKNOWN_FORMAT);
});

test('malformed envelopes', () => {
  assert.equal(verifyMemoryExport(null, []).reason, CODES.MALFORMED);
  assert.equal(verifyMemoryExport({ payload: {} }, []).reason, CODES.MALFORMED);
  assert.equal(verifyMemoryExport({ payload: { format: 'slidphi.memory', version: '1.0' }, proof: null }, []).reason, CODES.MALFORMED);
});

test('invalid trust policy -> INVALID_TRUST_POLICY', () => {
  const { envelope } = makeEnvelope();
  assert.equal(verifyMemoryExport(envelope, 'junk').reason, CODES.INVALID_TRUST_POLICY);
  assert.equal(verifyMemoryExport(envelope, 42).reason, CODES.INVALID_TRUST_POLICY);
});

test('trust policy map form works', () => {
  const { envelope, trustPolicy } = makeEnvelope();
  const v = verifyMemoryExport(envelope, { 'slidphi.memory/v1': trustPolicy });
  assert.equal(v.authentic, true);
});

test('key rotation: old key verifies history; revoked key -> KEY_NOT_TRUSTED', () => {
  const oldK = testKey('mem-2026-08-a');
  const newK = testKey('mem-2026-10-a');
  const { envelope } = (() => {
    const { kp } = oldK;
    const e = exportMemory({
      issuer: 'agent_x', subject: { agent_id: 'a', operator_id: 'o' },
      source: { platform: 't', adapter_version: '1.0.0' },
      items: [{ id: 'i1', kind: 'fact', content: { statement: 'old' } }],
    }, { key_id: 'mem-2026-08-a', privateKey: kp.privateKey });
    return e;
  })();
  const policy = {
    'slidphi.memory/v1': [
      { key_id: 'mem-2026-10-a', publicKey: newK.kp.publicJwk },
      { key_id: 'mem-2026-08-a', publicKey: oldK.kp.publicJwk },
    ],
  };
  assert.equal(verifyMemoryExport(envelope, policy).authentic, true);
  const revoked = revokeKeyFromPolicy(policy, 'mem-2026-08-a');
  const v = verifyMemoryExport(envelope, revoked);
  assert.equal(v.authentic, false);
  assert.equal(v.reason, CODES.KEY_NOT_TRUSTED);
});

test('authenticity is separate from freshness', () => {
  const { envelope, trustPolicy } = makeEnvelope();
  const old = JSON.parse(JSON.stringify(envelope));
  old.proof.signed_at = '2020-01-01T00:00:00.000Z'; // archival export
  // Note: signed_at is descriptive, not signed — signature still verifies.
  const v = verifyMemoryExport(old, trustPolicy);
  assert.equal(v.authentic, true);
  assert.ok(v.ageMs > 1000 * 60 * 60 * 24 * 365, 'age reflects years');
});

test('redaction: secrets dropped and counted, never in envelope', () => {
  const { kp } = testKey();
  const t = new Date().toISOString();
  const { envelope, redacted_count, item_count } = exportMemory({
    issuer: 'agent_x', subject: { agent_id: 'a', operator_id: 'o' },
    source: { platform: 't', adapter_version: '1.0.0' },
    items: [
      { id: 'ok1', kind: 'preference', created_at: t, content: { key: 'timezone', value: 'UTC' } },
      { id: 'bad1', kind: 'preference', created_at: t, content: { key: 'api_key', value: 'sk-secret-123' } },
      { id: 'bad2', kind: 'fact', created_at: t, content: { statement: 'deployed', confidence: 1 } },
      { id: 'bad3', kind: 'message', created_at: t, content: { role: 'user', text: 'here is -----BEGIN RSA PRIVATE KEY----- MIIB...' } },
    ],
  }, { key_id: 'k', privateKey: kp.privateKey });
  assert.equal(redacted_count, 2);
  assert.equal(item_count, 2);
  const s = JSON.stringify(envelope);
  assert.ok(!s.includes('sk-secret-123'));
  assert.ok(!s.includes('PRIVATE KEY'));
  assert.ok(envelope.payload.items.every((i) => i.id !== 'bad1' && i.id !== 'bad3'));
});

test('redact:false keeps secrets (caller takes responsibility)', () => {
  const { kp } = testKey();
  const t = new Date().toISOString();
  const { redacted_count } = exportMemory({
    issuer: 'a', subject: { agent_id: 'a', operator_id: 'o' },
    source: { platform: 't', adapter_version: '1.0.0' },
    items: [{ id: 's1', kind: 'preference', created_at: t, content: { key: 'api_key', value: 'x' }, }],
    redact: false,
  }, { key_id: 'k', privateKey: kp.privateKey });
  assert.equal(redacted_count, 0);
});

test('complex formats refused with UNSUPPORTED_CONTENT', () => {
  const { kp } = testKey();
  const t = new Date().toISOString();
  assert.throws(() => exportMemory({
    issuer: 'a', subject: { agent_id: 'a', operator_id: 'o' },
    source: { platform: 't', adapter_version: '1.0.0' },
    items: [{ id: 'v1', kind: 'preference', created_at: t, content: { key: 'embedding', value: { vector: [0.1, 0.2] } } }],
  }, { key_id: 'k', privateKey: kp.privateKey }), (e) => e instanceof MemoryError && e.code === CODES.UNSUPPORTED_CONTENT);
});

test('exportMemory rejects invalid input', () => {
  const { kp } = testKey();
  assert.throws(() => exportMemory(null, { key_id: 'k', privateKey: kp.privateKey }), (e) => e.code === CODES.INVALID_INPUT);
  assert.throws(() => exportMemory({ items: [] }, { key_id: 'k', privateKey: kp.privateKey }), (e) => e.code === CODES.INVALID_INPUT); // no issuer/subject/source
  assert.throws(() => exportMemory({
    issuer: 'a', subject: { agent_id: 'a', operator_id: 'o' },
    source: { platform: 't', adapter_version: '1.0.0' },
    items: [{ id: 'x', kind: 'nope', content: {} }],
  }, { key_id: 'k', privateKey: kp.privateKey }), (e) => e.code === CODES.INVALID_INPUT);
});

test('proof binds issuer/subject/export_id: swapping payload breaks signature', () => {
  const { envelope, trustPolicy } = makeEnvelope();
  const swapped = JSON.parse(JSON.stringify(envelope));
  swapped.payload.subject.agent_id = 'agent_evil';
  const v = verifyMemoryExport(swapped, trustPolicy);
  assert.equal(v.authentic, false);
  assert.equal(v.reason, CODES.INVALID_SIGNATURE);
});
