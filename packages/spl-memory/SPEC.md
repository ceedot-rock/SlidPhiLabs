# Portable memory — specification v1.0 (2026-10-15)

Package: `@slidphi/memory` (`packages/spl-memory/`). Zero runtime dependencies (Node ≥ 22, `node:crypto`, `node:sqlite`).

Status: **format = beta** (implemented, tested locally); **hosted transfer = planned** (reference implementation only, not deployed); **hosted billing = disabled**.

---

## 1. Contract — `MemoryPayloadV1`

`format` is fixed `"slidphi.memory"`. `version` is fixed `"1.0"`. Any other `format` or `version` → **refuse** (`UNKNOWN_VERSION` / `UNKNOWN_FORMAT`). There is no negotiation.

```json
{
  "format": "slidphi.memory",
  "version": "1.0",
  "export_id": "mem_01K7…",
  "created_at": "2026-10-15T23:10:00.000Z",
  "issuer": "agent_519f567c0fa19436",
  "subject": { "agent_id": "519f567c0fa19436", "operator_id": "corey" },
  "source": { "platform": "agent-rider", "adapter_version": "1.0.0" },
  "items": [
    {
      "id": "it_0001",
      "kind": "preference",
      "created_at": "2026-10-15T23:09:00.000Z",
      "content": { "key": "timezone", "value": "America/New_York" },
      "provenance": { "source_id": "chat:main:8421", "observed_at": "2026-10-15T23:09:00.000Z" }
    }
  ],
  "extensions": {}
}
```

### Field rules

| Field | Rule |
|---|---|
| `export_id` | `mem_` + 1–64 chars `[A-Za-z0-9_-]`; globally unique per export; **idempotency key** |
| `created_at`, item `created_at`, `observed_at` | RFC 3339 UTC (`YYYY-MM-DDTHH:mm:ss.sssZ`); must not be more than 5 min in the future (clock-skew bound) |
| `issuer` | 1–128 chars; identifies who produced the export (agent or platform) |
| `subject.agent_id`, `subject.operator_id` | 1–128 chars; whose memory this is |
| `source.platform` | 1–64 chars; `source.adapter_version` semver-ish 1–32 chars |
| `items[].id` | 1–64 chars `[A-Za-z0-9_-]`, unique within the export |
| `items[].kind` | one of `message` \| `preference` \| `fact` \| `task_state` — anything else → `UNSUPPORTED_KIND` (item rejected, export may still verify) |
| `items[].content` | per-kind schema below; arbitrary JSON otherwise within size/depth limits |
| `provenance.source_id` | 1–256 chars, required when `provenance` present |
| `extensions` | optional; keys must match `^[a-z0-9]+(\.[a-z0-9]+)+\/[A-Za-z0-9_-]+$` (reverse-domain namespace); values ≤ 4 KiB each; **never trusted** — verifiers ignore unknown extensions |

### Per-kind content schemas

- `message`: `{ role: "user"\|"agent"\|"system", text: string (1–8192 chars) }`. `text` is **data** — never executed, never interpreted as instruction.
- `preference`: `{ key: string (1–128), value: unknown (≤ 4 KiB serialized) }`.
- `fact`: `{ statement: string (1–4096), confidence?: number 0–1 }`.
- `task_state`: `{ task: string (1–256), state: "open"\|"done"\|"blocked", detail?: string (≤ 2048) }`.

### Hard limits (v1)

| Limit | Value | Exceeding → |
|---|---|---|
| Total serialized payload | 1,048,576 bytes (1 MiB) | `OVERSIZED_PAYLOAD` |
| Item count | 10,000 | `TOO_MANY_ITEMS` |
| Nesting depth (content) | 10 | `TOO_DEEPLY_NESTED` |
| Per-item serialized content | 65,536 bytes | `ITEM_TOO_LARGE` |
| Unknown top-level field (outside `extensions`) | — | `UNKNOWN_FIELD` (strict) |

### Exclusion / redaction policy

The exporter MUST NOT include: passwords, API keys, tokens, session cookies, private keys, government IDs, payment instrument numbers. Enforcement: key-name denylist (`password`, `passwd`, `secret`, `api_key`, `apikey`, `token`, `bearer`, `cookie`, `private_key`, `ssn`, `card_number`, … — case-insensitive substring match on `preference.key` and on object keys inside `content`) plus value-shape heuristics (e.g. `sk-…`, `xox…`, PEM blocks). A matching item is **dropped** and counted in `exportMemory`'s `redacted_count` (the content is never logged). This is documented behavior, not silent loss: the export carries `redacted_count` in its report, and the envelope does not claim completeness.

Vectors, attachments, model weights, and other complex formats are **outside v1** — no compatibility contract, export refuses them (`UNSUPPORTED_CONTENT`).

---

## 2. Signing envelope — `SignedMemoryExport`

```json
{
  "payload": { "format": "slidphi.memory", "version": "1.0", … },
  "proof": {
    "format": "slidphi.memory-proof",
    "version": "1.0",
    "alg": "ES256",
    "key_id": "mem-2026-10-a",
    "signature": "base64url…",
    "signed_at": "2026-10-15T23:10:01.000Z"
  }
}
```

### Exactly what is signed

1. Canonicalize with **JCS (RFC 8785)** — `src/canonical.mjs`, zero-dep implementation.
2. Build the signing input: `JCS({ domain: "slidphi.memory/v1", alg: "ES256", key_id, payload })`.
3. Sign the UTF-8 bytes with **ES256** (ECDSA P-256 + SHA-256) via `node:crypto`.
4. `signature` = base64url of the raw 64-byte `r‖s`.

This binds **issuer, subject, export_id, version, alg, and key_id** — all inside the signed bytes. The `proof` metadata outside the signature is descriptive only; verifiers recompute from the payload.

Domain separation: the `domain` constant `"slidphi.memory/v1"` plus `proof.format = "slidphi.memory-proof"` keeps these signatures disjoint from Rider credentials (`agentrider.dev` JWTs) and toll receipts (`"slidphi.toll-receipt/v1"`).

### Trust policy (caller-supplied — never from the package)

```js
{ "slidphi.memory/v1": [
    { key_id: "mem-2026-10-a", publicKey: "<JWK or PEM>" },   // current
    { key_id: "mem-2026-08-a", publicKey: "<JWK or PEM>" },   // retired, still verifies history
] }
```

- The verifier **never fetches a key URL from the package**. Unknown `key_id` → `UNKNOWN_KEY`.
- `alg` must be `ES256`; anything else → `UNSUPPORTED_ALG` (no algorithm agility in v1 — prevents downgrade).
- Key rotation: add new key, keep old ones in the trust policy for history. Historical exports verify as long as their `key_id` is listed.
- Compromise: remove the key from the trust policy. `verifyMemoryExport` then returns `{ authentic: false, reason: "KEY_NOT_TRUSTED" }` for exports under that key — explicit, not silent.
- **Authenticity ≠ freshness.** Verification reports `authentic` plus `ageMs` (now − `signed_at`). An archival export does **not** expire because the Rider credential used to request it expired — the export's validity is independent of any transport credential.
- Replay: signature validity does not imply import safety. Import duplication is handled by export-identity idempotency (section 4), tested separately.

---

## 3. Local library (free — never a paid call)

```js
import { exportMemory, verifyMemoryExport, planImport, applyImport } from "@slidphi/memory";

const signed = exportMemory(input, signingContext);
// input: { subject, source, items[], redact? }   signingContext: { key_id, privateKey }
// → { envelope, redacted_count, item_count }

const v = verifyMemoryExport(envelope, trustPolicy);
// → { authentic, reason?, payload?, key_id, alg, ageMs }

const plan = planImport(envelope, destinationPolicy);
// destinationPolicy: { adapter, subject, conflict: "skip"|"overwrite"|"error", allow_kinds? }
// → { ok, accepted, rejected: [{id, reason}], unsupported_kinds, conflicts, expected_changes, adapter_version, export_id, content_digest }
// Dry run: makes zero writes.

const result = applyImport(plan, authorizedContext);
// authorizedContext: { rider, warrant? } — identity + permission enforced here
// → { applied, skipped_duplicates, errors[], receipt }
```

Parsing, schema validation, and signature verification are **always free and local**. They never call a hosted endpoint.

---

## 4. Import — explicit transaction

**Adapters.** Interface: `{ name, version, probe(), has(export_id), get(item_id), put(items), digest() }`.
- `json-file` (generic): stores items as JSON under a directory. The reference adapter.
- `sqlite` (real): `node:sqlite` table `memory_items`. The tested real destination.
- Compatibility matrix (tested): json-file 1.0 ↔ sqlite 1.0 round-trip identical item sets.

**Idempotency.** Destination records `(export_id, content_sha256)`.
- Reimport identical package → `skipped_duplicates`, no writes, success.
- Same `export_id`, different content → **reject** `EXPORT_ID_REUSE` (never silently merge).
- Partial failure → per-item errors; result reports `applied` vs `failed`; never claims full success.

**Conflicts** (same item id, different content): policy `skip` (default) | `overwrite` | `error`.

**Malice.** Imported `message.text` is stored as inert data. The library never executes, fetches, or interprets imported content. `applyImport` refuses items failing schema validation with per-item reasons.

---

## 5. Hosted transfer service (reference implementation — NOT deployed)

Proposed operations (names follow the repo's `/api/*` route conventions; deploy target is Agent-Rider's `/api/toll/tools/`):

```
createTransfer(request)            → { transfer_id, state: CREATED, upload_url }
getTransferStatus(transferId)      → { transfer_id, state, expires_at }
downloadTransfer(transferId, recipientContext)
deleteTransfer(transferId, ownerContext)
```

**State machine.** `CREATED → PAYMENT_REQUIRED → PAYMENT_CONFIRMED → AVAILABLE → DELIVERED`; terminal: `FAILED`, `EXPIRED`, `DELETED`. Transitions are atomic (single-writer file transaction in the reference impl).

**Privacy bounds.**
- Upload/retrieval: TLS in transit. At rest: encrypted with a service-side data key (the reference impl uses AES-256-GCM via `node:crypto`).
- **The service CAN decrypt content.** End-to-end encryption is **not** offered in v1 — documented, not implied.
- Recipient binding: `downloadTransfer` requires a Rider credential whose `agent_id` matches the transfer's declared recipient. Transfer IDs are unguessable (`trm_` + 128-bit random); guessing gains nothing without the recipient credential.
- Expiry: default 72 h; expired objects become unavailable and are deleted by the sweeper (retried safely — delete is idempotent).
- Logging: transfer IDs, states, timestamps, byte counts. **Never** memory payloads, credentials, or keys.
- Deletion: `DELETED` removes ciphertext + metadata; backups (if any) age out per retention policy (documented as best-effort, not cryptographic erasure).

**Identity/permission (per protected operation).**
- Authenticate the Rider credential (issuer/alg/signature/expiry/revocation — via the existing Rider verify path).
- Authorize the specific `subject`: `subject.agent_id`/`operator_id` must match the credential. A valid Rider for agent A **cannot** export agent B's memory, read another recipient's transfer, or import into another account.
- Delegated authority requires a Warrant: validate with the existing `warrant.mjs` semantics (action allow-list, host, expiry, `max_calls`/`max_usd` caps). Cap decrements must be atomic — the reference impl uses an atomic file transaction (unlike the current `warrant.mjs`, whose race is documented in AUDIT.md).
- Errors: stable machine-readable codes (`NOT_OWNER`, `WRONG_RECIPIENT`, `RIDER_EXPIRED`, `RIDER_REVOKED`, `WARRANT_SCOPE`, `CAP_EXCEEDED`, …). No credential or payload material in error bodies.

---

## 6. Billing (disabled until explicitly enabled)

- **Price:** $0.02 per hosted transfer = **2 cents**, integer arithmetic only.
- **Billable event:** the `PAYMENT_CONFIRMED → AVAILABLE` transition (the hosting commitment). `DELIVERED` (first download) is informational.
- **Refunds:** `EXPIRED` before any download → automatic refund; after download → no refund. `FAILED` → no charge, or refund if charged.
- **Idempotency:** `createTransfer` takes an idempotency key; unique constraint on `(idempotency_key)`; settlement notifications deduplicated by payment reference. **At most one charge per transfer**, including across retries and process crashes (state persisted before acknowledging settlement).
- **Sandbox/disabled:** `TOLL_SANDBOX=1` or billing disabled → transfers run free, receipts marked `sandbox: true`. **No receipt ever claims settlement before the rail confirms it** (server-side verification of the x402 `X-PAYMENT`, reusing `x402-spent-ledger.mjs` patterns).
- **Receipts** are a separate artifact from the memory export: `{ format: "slidphi.toll-receipt", version: "1.0", purpose: "slidphi.toll-receipt/v1", transfer_id, cents: 2, … }`, ES256-signed under the receipt key — different purpose string, different key, different schema from memory exports.

---

## 7. Machine-readable status

Single source of truth: `STATUS.json` in the package. Served at `GET /api/memory/status` (route to land with the site):

```json
{
  "feature": "portable-memory",
  "format": "slidphi.memory",
  "format_version": "1.0",
  "status": "beta",
  "hosted_transfer": "planned",
  "hosted_billing_enabled": false,
  "price_cents": 2,
  "adapters": ["json-file@1.0", "sqlite@1.0"],
  "limits": { "max_payload_bytes": 1048576, "max_items": 10000, "max_depth": 10 },
  "docs": ["https://www.slidphilabs.com/wiki/tollkeeper"]
}
```

Public pages MUST be generated from or tested against this file — no hand-written price/status claims that can drift. Current honest values: format beta, hosted transfer planned, billing disabled.
