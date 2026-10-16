# @slidphi/memory — portable signed memory

A free, dependency-free local library for exporting, verifying, and importing
**portable signed memory** (`slidphi.memory` v1.0), plus a **reference
(non-deployed)** hosted-transfer implementation.

- **Format: beta** — implemented and tested locally.
- **Hosted transfer: planned** — reference implementation only, not deployed.
- **Hosted billing: disabled** — transfers run free in sandbox mode; no charges possible.

Single source of truth for rollout status: [`STATUS.json`](./STATUS.json).
Public pages must be generated from or tested against it — no hand-written
price/status claims that can drift.

## Install

Zero runtime dependencies. Node.js ≥ 22 (`node:crypto`, `node:sqlite`).

```bash
npm install @slidphi/memory   # when published
# local dev:
node --test test/*.test.mjs   # or: npm test
```

## Quickstart

```js
import {
  exportMemory, verifyMemoryExport, planImport, applyImport,
  jsonFileAdapter, generateKeyPair,
} from '@slidphi/memory';

// 1. Export (free, local). Secrets are dropped and counted — never logged.
const kp = generateKeyPair();
const { envelope, redacted_count, item_count } = exportMemory(
  {
    issuer: 'agent_abc',
    subject: { agent_id: 'agent_abc', operator_id: 'corey' },
    source: { platform: 'agent-rider', adapter_version: '1.0.0' },
    items: [
      { id: 'it_1', kind: 'preference', content: { key: 'timezone', value: 'America/New_York' } },
    ],
  },
  { key_id: 'mem-2026-10-a', privateKey: kp.privateKey },
);

// 2. Verify (free, local). Trust policy is caller-supplied — never fetched.
const v = verifyMemoryExport(envelope, [{ key_id: 'mem-2026-10-a', publicKey: kp.publicJwk }]);
// -> { authentic: true, payload, key_id, alg: 'ES256', ageMs }

// 3. Plan an import (dry run — zero writes).
const adapter = jsonFileAdapter('./my-memory');
await adapter.probe();
const plan = await planImport(envelope, { adapter, subject: { agent_id: 'agent_abc', operator_id: 'corey' } });
// -> { ok, accepted, rejected, unsupported_kinds, conflicts, expected_changes, ... }

// 4. Apply (identity enforced via Rider credential; optional Warrant).
const result = await applyImport(plan, {
  rider: '<rider JWT>',                       // verified via the Rider verify path
  // warrant, riderVerify, warrantVerify,      // inject verifiers for tests/offline
});
```

## API

| Function | Description |
|---|---|
| `exportMemory(input, signingContext)` | Validate → redact → sign. Returns `{ envelope, redacted_count, item_count }`. |
| `verifyMemoryExport(envelope, trustPolicy)` | ES256/JCS verification. Returns `{ authentic, reason?, payload?, key_id, alg, ageMs }`. Never fetches keys. |
| `planImport(envelope, destinationPolicy)` | Dry run, zero writes. Per-item accept/reject, conflicts, idempotency preview. |
| `applyImport(plan, authorizedContext)` | Rider-authenticated apply. Export-identity idempotency, conflict policy, per-item errors. |
| `jsonFileAdapter(dir)` / `sqliteAdapter(dbPath)` | Destination adapters (`{ name, version, probe, has, get, put, digest }`). |
| `TransferService` | Reference hosted-transfer service (not deployed). See below. |
| `getStatus()` | Returns the `STATUS.json` document. |
| `generateKeyPair()` / `sign()` / `verify()` | ES256 helpers (also used internally). |
| `canonicalize()` | JCS (RFC 8785) canonicalization. |
| `validatePayload()` / `validateItem()` | Zero-dep contract validation → `{ ok, errors: [{ path, code, message }] }`. |

Error codes are stable strings (`CODES.*`): `UNKNOWN_VERSION`,
`UNKNOWN_FORMAT`, `OVERSIZED_PAYLOAD`, `TOO_MANY_ITEMS`, `TOO_DEEPLY_NESTED`,
`ITEM_TOO_LARGE`, `UNSUPPORTED_KIND`, `UNSUPPORTED_CONTENT`, `UNKNOWN_KEY`,
`UNSUPPORTED_ALG`, `KEY_NOT_TRUSTED`, `INVALID_SIGNATURE`, `EXPORT_ID_REUSE`,
`NOT_OWNER`, `WRONG_RECIPIENT`, `RIDER_EXPIRED`, `RIDER_REVOKED`,
`WARRANT_SCOPE`, `CAP_EXCEEDED`, and more — see `src/errors.mjs`.

## Limits (v1, enforced)

| Limit | Value |
|---|---|
| Total serialized payload | 1 MiB (`OVERSIZED_PAYLOAD`) |
| Item count | 10,000 (`TOO_MANY_ITEMS`) |
| Content nesting depth | 10 (`TOO_DEEPLY_NESTED`) |
| Per-item serialized content | 64 KiB (`ITEM_TOO_LARGE`) |
| Preference value / extension value | 4 KiB each |
| Timestamps | RFC 3339 UTC with millis; ≤ 5 min in the future |

Unknown top-level fields (outside `extensions`) are rejected (`UNKNOWN_FIELD`).
Extension keys must be reverse-domain namespaced (`com.example/app`).

## Security notes

- **Signing:** ES256 over `JCS({ domain: "slidphi.memory/v1", alg: "ES256",
  key_id, payload })`. The `proof` metadata is descriptive; verifiers recompute
  the signed bytes. Domain-separated from Rider credentials and toll receipts.
- **Trust:** the verifier never fetches key URLs. Unknown `key_id` →
  `UNKNOWN_KEY`; compromised keys are listed in `revoked_key_ids` →
  `KEY_NOT_TRUSTED`. Key rotation = add new key, keep old ones for history.
- **Authenticity ≠ freshness.** An archival export does not expire because a
  transport credential did. `ageMs` is reported; expiry policy is the caller's.
- **Redaction:** key-name denylist + secret-shape heuristics drop matching
  items (counted, never logged). Vectors/attachments/model weights are refused
  (`UNSUPPORTED_CONTENT`) — outside v1.
- **Import is inert.** Imported content is stored as data and never executed,
  fetched, or interpreted. Idempotency is by `(export_id, content_sha256)`:
  same export + same content → skipped duplicates; same export ID + different
  content → `EXPORT_ID_REUSE` reject.
- **Hosted transfer (reference):** AES-256-GCM at rest; **the service CAN
  decrypt content** — end-to-end encryption is not offered in v1. Recipient
  binding by Rider `agent_id`; 72 h expiry with idempotent sweeper; logs carry
  IDs/states/byte counts only. Billing is disabled: receipts are marked
  `{ sandbox: true, settled: false }` and never claim a settlement.

## CLI example

```bash
node cli/spl-memory.mjs export input.json envelope.json   # demo key! warning printed
node cli/spl-memory.mjs verify envelope.json --trust envelope.json.trust.json
node cli/spl-memory.mjs plan  envelope.json --dir ./data
node cli/spl-memory.mjs apply envelope.json --dir ./data
node cli/spl-memory.mjs status
```

The CLI generates an ephemeral demo key and says so loudly. Real deployments
use the library API with their own keys.

## Status honesty

| Surface | Value |
|---|---|
| Format | `beta` — implemented, tested locally (94 tests) |
| Hosted transfer | `planned` — reference implementation only, **not deployed** |
| Hosted billing | **disabled** — `TOLL_SANDBOX` behavior; receipts never claim settlement |
| Price | 2¢ per hosted transfer (integer cents; not charged while disabled) |

Do not call the hosted transfer "live" because a marketing page lists its price.
