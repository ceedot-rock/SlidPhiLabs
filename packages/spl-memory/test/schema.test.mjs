import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePayload, validateItem, LIMITS, MemoryPayloadV1Schema } from '../src/schema.mjs';
import { CODES } from '../src/errors.mjs';
import { makeEnvelope } from './helpers.mjs';

const good = () => makeEnvelope().envelope.payload;
const codes = (errors) => errors.map((e) => e.code);

test('valid payload passes', () => {
  const v = validatePayload(good());
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  assert.deepEqual(v.errors, []);
});

test('schema object is draft 2020-12 style', () => {
  assert.equal(MemoryPayloadV1Schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(MemoryPayloadV1Schema.properties.format.const, 'slidphi.memory');
  assert.deepEqual(MemoryPayloadV1Schema.properties.items.items.properties.kind.enum,
    ['message', 'preference', 'fact', 'task_state']);
});

test('wrong format/version refused', () => {
  const p = good();
  p.format = 'other.format';
  assert.ok(codes(validatePayload(p).errors).includes(CODES.UNKNOWN_FORMAT));
  const p2 = good();
  p2.version = '2.0';
  assert.ok(codes(validatePayload(p2).errors).includes(CODES.UNKNOWN_VERSION));
});

test('unknown top-level field is strict', () => {
  const p = good();
  p.surprise = 1;
  const v = validatePayload(p);
  assert.equal(v.ok, false);
  assert.ok(codes(v.errors).includes(CODES.UNKNOWN_FIELD));
});

test('export_id shape enforced', () => {
  const p = good();
  p.export_id = 'nope';
  assert.ok(codes(validatePayload(p).errors).includes(CODES.INVALID_INPUT));
});

test('timestamps: strict UTC-ms shape, real calendar, 5-min future bound', () => {
  const p = good();
  p.created_at = '2026-10-15T23:10:00+00:00'; // offset form rejected
  assert.ok(codes(validatePayload(p).errors).includes(CODES.INVALID_TIMESTAMP));
  const p2 = good();
  p2.created_at = '2026-13-45T99:99:99.000Z'; // impossible date
  assert.ok(codes(validatePayload(p2).errors).includes(CODES.INVALID_TIMESTAMP));
  const p3 = good();
  p3.created_at = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min future
  assert.ok(codes(validatePayload(p3).errors).includes(CODES.FUTURE_TIMESTAMP));
  const p4 = good();
  p4.created_at = new Date(Date.now() + 4 * 60 * 1000).toISOString(); // 4 min future ok
  assert.ok(!codes(validatePayload(p4).errors).includes(CODES.FUTURE_TIMESTAMP));
});

test('duplicate item ids rejected', () => {
  const p = good();
  p.items.push({ ...p.items[0] });
  const v = validatePayload(p);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => e.message.includes('duplicate item id')));
});

test('per-kind content schemas enforced', () => {
  const t = new Date().toISOString();
  const item = (kind, content) => ({ id: 'x', kind, created_at: t, content });
  assert.ok(validateItem(item('message', { role: 'bogus', text: 'hi' })).length > 0);
  assert.ok(validateItem(item('message', { role: 'user', text: '' })).length > 0); // empty text
  assert.ok(validateItem(item('message', { role: 'user', text: 'x'.repeat(8193) })).length > 0);
  assert.ok(validateItem(item('message', { role: 'user', text: 'ok', extra: 1 })).some((e) => e.code === CODES.UNKNOWN_FIELD));
  assert.equal(validateItem(item('message', { role: 'user', text: 'ok' })).length, 0);
  assert.ok(validateItem(item('fact', { statement: 's', confidence: 1.5 })).length > 0);
  assert.ok(validateItem(item('task_state', { task: 't', state: 'maybe' })).length > 0);
  assert.ok(validateItem(item('preference', { key: 'k', value: 'x'.repeat(5000) })).some((e) => e.code === CODES.ITEM_TOO_LARGE));
});

test('unsupported kind reported per item', () => {
  const t = new Date().toISOString();
  const errs = validateItem({ id: 'x', kind: 'embedding', created_at: t, content: {} });
  assert.ok(errs.some((e) => e.code === CODES.UNSUPPORTED_KIND));
});

test('too many items', () => {
  const p = good();
  const t = new Date().toISOString();
  p.items = Array.from({ length: 10001 }, (_, i) => ({ id: `i${i}`, kind: 'fact', created_at: t, content: { statement: 's' } }));
  const v = validatePayload(p);
  assert.equal(v.ok, false);
  assert.ok(codes(v.errors).includes(CODES.TOO_MANY_ITEMS));
});

test('nesting depth limit: 10 ok, 11 rejected', () => {
  const t = new Date().toISOString();
  const nest = (n) => { let v = { leaf: 1 }; for (let i = 0; i < n; i++) v = { n: v }; return v; };
  // depth(content): 10 nested objects -> depth 11? content={n:{n:...}} top = 1...
  const okItem = { id: 'd', kind: 'preference', created_at: t, content: { key: 'k', value: nest(8) } };
  assert.equal(validateItem(okItem).filter((e) => e.code === CODES.TOO_DEEPLY_NESTED).length, 0);
  const deepItem = { id: 'd', kind: 'preference', created_at: t, content: { key: 'k', value: nest(9) } };
  assert.ok(validateItem(deepItem).some((e) => e.code === CODES.TOO_DEEPLY_NESTED));
});

test('per-item content size limit', () => {
  const t = new Date().toISOString();
  const item = { id: 'big', kind: 'message', created_at: t, content: { role: 'user', text: 'x'.repeat(70000) } };
  const errs = validateItem(item);
  assert.ok(errs.some((e) => e.code === CODES.ITEM_TOO_LARGE));
});

test('oversized total payload', () => {
  const p = good();
  const t = new Date().toISOString();
  // 130 valid message items x ~8.2KiB text: each item valid, total > 1MiB.
  p.items = Array.from({ length: 130 }, (_, i) => ({
    id: `big${i}`, kind: 'message', created_at: t, content: { role: 'user', text: 'y'.repeat(8192) },
  }));
  const v = validatePayload(p);
  assert.equal(v.ok, false);
  assert.ok(codes(v.errors).includes(CODES.OVERSIZED_PAYLOAD));
  assert.ok(!codes(v.errors).includes(CODES.ITEM_TOO_LARGE));
});

test('extensions: namespaced keys, 4KiB value cap', () => {
  const p = good();
  p.extensions = { 'badkey': 1 };
  assert.ok(codes(validatePayload(p).errors).includes(CODES.INVALID_INPUT));
  const p2 = good();
  p2.extensions = { 'com.example/app': 'x'.repeat(5000) };
  assert.ok(validatePayload(p2).errors.some((e) => e.code === CODES.ITEM_TOO_LARGE));
  const p3 = good();
  p3.extensions = { 'com.example/app': { v: 1 } };
  assert.equal(validatePayload(p3).ok, true);
});

test('provenance rules', () => {
  const t = new Date().toISOString();
  assert.ok(validateItem({ id: 'x', kind: 'fact', created_at: t, content: { statement: 's' }, provenance: {} }).length > 0);
  assert.ok(validateItem({ id: 'x', kind: 'fact', created_at: t, content: { statement: 's' }, provenance: { source_id: 's', observed_at: 'not-a-date' } })
    .some((e) => e.code === CODES.INVALID_TIMESTAMP));
  assert.equal(validateItem({ id: 'x', kind: 'fact', created_at: t, content: { statement: 's' }, provenance: { source_id: 's', observed_at: t } }).length, 0);
});

test('limits constants match SPEC', () => {
  assert.equal(LIMITS.maxPayloadBytes, 1048576);
  assert.equal(LIMITS.maxItems, 10000);
  assert.equal(LIMITS.maxDepth, 10);
  assert.equal(LIMITS.maxItemContentBytes, 65536);
});
