import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalize } from '../src/canonical.mjs';

test('sorts object keys in UTF-16 code unit order, nested', () => {
  assert.equal(canonicalize({ b: 1, a: { d: 4, c: 3 } }), '{"a":{"c":3,"d":4},"b":1}');
  // UTF-16 order: 'Z' (0x5A) < 'a' (0x61); 'é' (0xE9) after 'z' (0x7A)
  assert.equal(canonicalize({ a: 1, Z: 2 }), '{"Z":2,"a":1}');
  assert.equal(canonicalize({ é: 1, z: 2 }), '{"z":2,"é":1}');
});

test('no whitespace; arrays preserved in order', () => {
  assert.equal(canonicalize([3, 2, { y: 1, x: 0 }]), '[3,2,{"x":0,"y":1}]');
  assert.equal(canonicalize({}), '{}');
  assert.equal(canonicalize([]), '[]');
  assert.equal(canonicalize(null), 'null');
});

test('string escapes per JCS', () => {
  assert.equal(canonicalize('a"b\\c'), '"a\\"b\\\\c"');
  assert.equal(canonicalize('\b\f\n\r\t'), '"\\b\\f\\n\\r\\t"');
  assert.equal(canonicalize('\u0001\u0002\u001f\u007f'), '"\\u0001\\u0002\\u001f\u007f"');
  // '/' is never escaped; DEL and non-ASCII pass through
  assert.equal(canonicalize('a/b\u007fÿ'), '"a/b\u007fÿ"');
  // lone surrogates escaped, pairs literal
  assert.equal(canonicalize('\ud800'), '"\\ud800"');
  assert.equal(canonicalize('😀'), '"😀"');
});

test('numbers: shortest round-trip, -0, exponential expansion', () => {
  assert.equal(canonicalize(42), '42');
  assert.equal(canonicalize(-7), '-7');
  assert.equal(canonicalize(0.5), '0.5');
  assert.equal(canonicalize(-0), '0');
  assert.equal(canonicalize(1e21), '1000000000000000000000');
  assert.equal(canonicalize(1.23e-7), '0.000000123');
  assert.equal(canonicalize(-2.5e-3), '-0.0025');
  assert.equal(canonicalize(1.5e3), '1500');
  assert.equal(canonicalize(123456789), '123456789');
});

test('canonical form round-trips through JSON.parse', () => {
  const v = { z: [1, 'x"', -0, 1e21, null, true], a: { nested: { deep: [0.1] } } };
  const canon = canonicalize(v);
  assert.deepEqual(JSON.parse(canon), { z: [1, 'x"', 0, 1e21, null, true], a: { nested: { deep: [0.1] } } });
});

test('rejects non-JSON values', () => {
  assert.throws(() => canonicalize(undefined), /cannot canonicalize/);
  assert.throws(() => canonicalize(() => {}), /cannot canonicalize/);
  assert.throws(() => canonicalize(10n), /cannot canonicalize/);
  assert.throws(() => canonicalize(NaN), /non-finite/);
  assert.throws(() => canonicalize(Infinity), /non-finite/);
  assert.throws(() => canonicalize({ a: undefined }), /cannot canonicalize/);
});

test('RFC 8785 example vectors', () => {
  // Key ordering is by UTF-16 code units: "" < "1" < "10".
  assert.equal(
    canonicalize({ 10: {}, 1: { f: { d: 4, c: 3 } }, '': 'empty' }),
    '{"":"empty","1":{"f":{"c":3,"d":4}},"10":{}}',
  );
});
