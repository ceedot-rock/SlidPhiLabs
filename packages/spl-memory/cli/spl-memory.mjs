#!/usr/bin/env node
// spl-memory — CLI example for @slidphi/memory.
//
//   spl-memory export <input.json> <envelope-out.json>
//   spl-memory verify <envelope.json> --trust <trust.json>
//   spl-memory plan   <envelope.json> --dir <data-dir> [--adapter json-file|sqlite]
//   spl-memory apply  <envelope.json> --dir <data-dir> [--adapter json-file|sqlite]
//
// Demo only: export generates an ephemeral keypair and prints a loud
// warning. Never use demo keys for real exports — bring your own key_id +
// private key via the library API.

import { readFileSync, writeFileSync } from 'node:fs';
import {
  exportMemory, verifyMemoryExport, planImport, applyImport,
  jsonFileAdapter, sqliteAdapter, generateKeyPair, getStatus,
} from '../src/index.mjs';

const DEMO_WARN = 'WARNING: demo key generated for this run only — do not use for real exports.';

function usage() {
  console.error(`usage:
  spl-memory export <input.json> <envelope-out.json>
  spl-memory verify <envelope.json> --trust <trust.json>
  spl-memory plan   <envelope.json> --dir <data-dir> [--adapter json-file|sqlite]
  spl-memory apply  <envelope.json> --dir <data-dir> [--adapter json-file|sqlite]
  spl-memory status`);
  process.exit(2);
}

function arg(flag, dflt) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

function makeAdapter() {
  const kind = arg('--adapter', 'json-file');
  const dir = arg('--dir', null);
  if (!dir) { console.error('missing --dir <data-dir>'); process.exit(2); }
  return kind === 'sqlite' ? sqliteAdapter(dir + '/memory.db') : jsonFileAdapter(dir);
}

// Demo identity: a self-vouched claims object (test seam). Real deployments
// pass a Rider JWT string and a verifier.
const demoAuth = (agent, operator) => ({
  rider: { agent_id: agent, operator_id: operator },
  claims: true,
});

async function main() {
  const cmd = process.argv[2];
  if (cmd === 'export') {
    const [inputPath, outPath] = [process.argv[3], process.argv[4]];
    if (!inputPath || !outPath) usage();
    const input = JSON.parse(readFileSync(inputPath, 'utf8'));
    const kp = generateKeyPair();
    console.error(DEMO_WARN);
    const { envelope, redacted_count, item_count } = exportMemory(input, {
      key_id: 'demo-' + Date.now().toString(36),
      privateKey: kp.privateKey,
    });
    writeFileSync(outPath, JSON.stringify(envelope, null, 2));
    writeFileSync(outPath + '.trust.json', JSON.stringify({
      'slidphi.memory/v1': [{ key_id: envelope.proof.key_id, publicKey: kp.publicJwk }],
    }, null, 2));
    console.log(JSON.stringify({ out: outPath, trust: outPath + '.trust.json', redacted_count, item_count }));
  } else if (cmd === 'verify') {
    const envPath = process.argv[3];
    const trustPath = arg('--trust', null);
    if (!envPath || !trustPath) usage();
    const envelope = JSON.parse(readFileSync(envPath, 'utf8'));
    const trust = JSON.parse(readFileSync(trustPath, 'utf8'));
    const v = verifyMemoryExport(envelope, trust);
    console.log(JSON.stringify(v, null, 2));
    process.exit(v.authentic ? 0 : 1);
  } else if (cmd === 'plan' || cmd === 'apply') {
    const envPath = process.argv[3];
    if (!envPath) usage();
    const envelope = JSON.parse(readFileSync(envPath, 'utf8'));
    const adapter = makeAdapter();
    await adapter.probe();
    const plan = await planImport(envelope, {
      adapter,
      subject: envelope.payload.subject,
      conflict: 'skip',
    });
    if (cmd === 'plan') {
      const { envelope: _e, adapter: _a, destinationPolicy: _d, ...serial } = plan;
      console.log(JSON.stringify(serial, null, 2));
      process.exit(plan.ok ? 0 : 1);
    }
    if (!plan.ok) { console.error('plan failed:', plan.reason); process.exit(1); }
    console.error(DEMO_WARN.replace('key', 'identity') + ' (self-vouched demo rider)');
    const res = await applyImport(plan, demoAuth(envelope.payload.subject.agent_id, envelope.payload.subject.operator_id));
    console.log(JSON.stringify(res, null, 2));
    process.exit(res.errors.length ? 1 : 0);
  } else if (cmd === 'status') {
    console.log(JSON.stringify(getStatus(), null, 2));
  } else {
    usage();
  }
}

main().catch((e) => { console.error(`error [${e.code || 'UNKNOWN'}]: ${e.message}`); process.exit(1); });
