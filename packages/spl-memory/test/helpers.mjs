// Shared fixtures for the @slidphi/memory test suite (not a test file itself).
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  generateKeyPair, exportMemory, jsonFileAdapter, sqliteAdapter,
} from '../src/index.mjs';

export function testKey(keyId = 'test-key-1') {
  const kp = generateKeyPair();
  const trustPolicy = [{ key_id: keyId, publicKey: kp.publicJwk }];
  return { kp, keyId, trustPolicy };
}

export function sampleItems() {
  const t = new Date().toISOString();
  return [
    { id: 'msg1', kind: 'message', created_at: t, content: { role: 'user', text: 'hello world' }, provenance: { source_id: 'chat:main:1' } },
    { id: 'pref1', kind: 'preference', created_at: t, content: { key: 'timezone', value: 'America/New_York' } },
    { id: 'fact1', kind: 'fact', created_at: t, content: { statement: 'the lab is in Cherry Hill', confidence: 0.9 } },
    { id: 'task1', kind: 'task_state', created_at: t, content: { task: 'write tests', state: 'open', detail: 'comprehensive' } },
  ];
}

export function makeEnvelope({ keyId = 'test-key-1', items = sampleItems(), subject, issuer = 'agent_test', exportId } = {}) {
  const { kp, trustPolicy } = testKey(keyId);
  const { envelope } = exportMemory({
    issuer,
    subject: subject ?? { agent_id: 'agent_a', operator_id: 'op_a' },
    source: { platform: 'test', adapter_version: '1.0.0' },
    items,
    ...(exportId ? { export_id: exportId } : {}),
  }, { key_id: keyId, privateKey: kp.privateKey });
  return { envelope, kp, keyId, trustPolicy };
}

export function tempDir(prefix = 'spl-mem-test-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

// Demo rider auth: self-vouched claims (test seam). Real deployments pass a
// Rider JWT string plus a verifier.
export const demoRider = (agent_id = 'agent_a', operator_id = 'op_a') => ({
  rider: { agent_id, operator_id },
  claims: true,
});

// Mock rider verifier: async (credential) -> { ok, agent_id, operator_id, ... }
export const mockRiderVerify = (result) => async () => result;
export const mockWarrantVerify = (result) => async () => result;

export function adapters(dir) {
  return {
    'json-file': jsonFileAdapter(join(dir, 'json')),
    'sqlite': sqliteAdapter(join(dir, 'sqlite.db')),
  };
}
