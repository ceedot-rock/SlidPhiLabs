import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, sign, verify, publicKeyFrom } from '../src/keys.mjs';

test('sign/verify round trip', () => {
  const kp = generateKeyPair();
  const sig = sign(kp.privateKey, Buffer.from('hello'));
  assert.equal(typeof sig, 'string');
  assert.equal(Buffer.from(sig, 'base64url').length, 64, 'raw r||s is 64 bytes');
  assert.equal(verify(kp.publicKey, Buffer.from('hello'), sig), true);
});

test('wrong key fails', () => {
  const a = generateKeyPair();
  const b = generateKeyPair();
  const sig = sign(a.privateKey, Buffer.from('hello'));
  assert.equal(verify(b.publicKey, Buffer.from('hello'), sig), false);
});

test('tampered bytes fail', () => {
  const kp = generateKeyPair();
  const sig = sign(kp.privateKey, Buffer.from('hello'));
  assert.equal(verify(kp.publicKey, Buffer.from('hellp'), sig), false);
});

test('JWK and PEM public keys accepted', () => {
  const kp = generateKeyPair();
  const sig = sign(kp.privateKey, Buffer.from('data'));
  assert.equal(verify(kp.publicJwk, Buffer.from('data'), sig), true);
  assert.equal(verify(JSON.stringify(kp.publicJwk), Buffer.from('data'), sig), true);
  const pem = kp.publicKey.export({ format: 'pem', type: 'spki' });
  assert.equal(verify(pem, Buffer.from('data'), sig), true);
  // JWK private key also accepted for signing
  const sig2 = sign(kp.privateJwk, Buffer.from('data'));
  assert.equal(verify(kp.publicKey, Buffer.from('data'), sig2), true);
});

test('malformed signature returns false, never throws', () => {
  const kp = generateKeyPair();
  assert.equal(verify(kp.publicKey, Buffer.from('data'), '!!!not-base64!!!'), false);
  assert.equal(verify(kp.publicKey, Buffer.from('data'), Buffer.from('short').toString('base64url')), false);
  assert.equal(verify('garbage-key', Buffer.from('data'), 'abcd'), false);
});

test('publicKeyFrom rejects junk', () => {
  assert.throws(() => publicKeyFrom(42), /unrecognized/);
});
