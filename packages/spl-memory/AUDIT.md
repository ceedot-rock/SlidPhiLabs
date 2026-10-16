# Portable memory — evidence-backed audit (2026-10-15)

Repo: `ceedot-rock/slidphilabs` (cloned to `~/workspace/slidphilabs-audit`, commit `43d71f7`).
Runtime: Node.js ESM (`"type": "module"`), npm, `node:crypto` only — **no JWT/JWKS library, no `createSign`/`createVerify` anywhere**.
Tests: `npm test` = `node --test test/` (only `test/pccz.test.mjs`; co-located `*.test.mjs` under `docs/site/api/lib/` run individually).
Deploy: Fly app `slidphilabs` (`docs/site/fly.toml`), `docs/site/server.mjs` serves static + `docs/site/api/*.js` handlers. Vercel is dead.

## Evidence table

| Capability | Actual file/symbol | Tests | Public claim | Gap | Proposed change | Classification |
|---|---|---|---|---|---|---|
| Memory export format (`slidphi.memory`) | — (zero hits: `exportMemory`, `MemoryPayload`, `slidphi.memory` absent) | none | tollkeeper.html: "open signed format you can carry anywhere — free forever" | Format unpublished: no schema, no canonicalization, no signing spec | Define `MemoryPayloadV1` JSON Schema + signing envelope; ship free local library | **Not implemented** |
| Hosted memory transfer ($0.02) | — (no `createTransfer`/state machine/routes anywhere) | none | tollkeeper.html + wiki: "$0.02 hosted transfer" | No service, no metering, no receipts | Reference implementation + spec for Agent-Rider landing | **Not implemented** |
| Machine-readable memory pricing/status | — | none | tollkeeper.html points at `agentrider.fly.dev/api/toll/schema` | Nothing in this repo | Status endpoint generated from authoritative source | **Located in another repository** (claimed) |
| Rider issuance / JWKS / revocation | `docs/site/api/rider/claim.js` (calls out to `agentrider.fly.dev`) | none | site-wide "Rider" references | Backend absent here; this repo cannot verify a Rider offline | Boundary: request Agent-Rider repo for signing spec; this repo treats Rider as remote | **Located in another repository** |
| Rider claim flow (Stripe → mint) | `docs/site/api/rider/claim.js` | none | rider.html / pricing | `expires_in: 900` default, no renew/revoke lifecycle documented | Doc note only (renew/revoke is CLI's track) | **Implemented but undocumented** (lifecycle) |
| Warrant issue/verify/revoke | `docs/site/api/lib/warrant.mjs` (`issueWarrant`, `verifyWarrant`, `revokeWarrant`) | `warrant.test.mjs` 3/3 pass | warrant.html | HMAC-SHA256, **not** asymmetric; no key rotation/`kid`; caps non-atomic (double-spend possible); `X-Spl-Seat` paid check spoofable (issue.js:55, receipt.js:32) | Document limits; fix paid check to use `seatOk`; note rotation gap | **Partially implemented** |
| "Anyone can verify the signature without calling home" | — (HMAC needs the server secret) | — | `docs/site/warrant.html:34` | **False**: third parties must call `POST /api/warrant/verify` | Correct the page or ship asymmetric warrants | **Not implemented** (claim is wrong) |
| Signed toll receipts (ES256) | — (no receipt-signing code; warrant receipts are unsigned JSON) | none | tollkeeper.html: "every toll receipted"; wiki: "returns a signed receipt" | Nothing signs receipts in this repo | Receipt-signing spec lives with Agent-Rider (claimed); do not assert locally | **Located in another repository** (claimed) / **Unable to verify** |
| Toll metering / settlement | — (no `toll` code in `src/`, `packages/`, `docs/site/api/`) | none | "ten metered tools, live now" | Entire toll runtime absent here | Boundary: Agent-Rider repo | **Located in another repository** |
| x402 settlement / Stripe | `docs/site/api/x402-products.js`, `x402-suite.js`, `payments.js`, `lib/x402-spent-ledger.mjs` | some co-located | product checkout | Serves product SKUs + compression suite, **not tolls** | Reuse rail patterns for transfer billing (reference impl) | **Implemented** (different product) |
| Usage metering convention | `docs/site/api/lib/usage-meter.mjs`; `AUTH_DIR=/data` volume | none wired | — | — | Reuse for transfer metering | **Implemented and documented** (internally) |
| `aos-ring` memory tool | separate repo `ceedot-rock/aos-ring` (per wiki) | — | wiki/aos-ring.html: "the memory tool" | Distinct product (RAM-like pattern store), not portable-memory export | Keep separate; do not conflate | **Located in another repository** |
| Machine-readable site surfaces | `docs/site/llms.txt`, `agents.txt`, `sitemap.xml` | — | — | No memory mentions (fine — nothing to claim yet) | Add memory entries only when format ships | **Implemented** (no false claims) |

## Adjacent security findings (not memory, flagging for Corey)

1. **Warrant paid-bypass is client-spoofable**: `docs/site/api/warrant/issue.js:55` and `receipt.js:32` treat `X-Spl-Seat: warrant-*` as paid; the real HMAC check (`seatOk` in `lib/spl-box-gate.js`) is not used. Anyone can skip the free-issue cap.
2. **Warrant cap double-spend**: `fileReceipt` read-modify-write on JSON has no locking; concurrent filings can exceed `max_usd`/`max_calls`.
3. **No warrant key rotation**: secret from env or generated file; wiping `/data` silently invalidates all issued warrants.
4. **Warrant/receipt records publicly readable by ID** (`docs/site/api/warrant.js` GET) — by design for verification, but note it.

## Architecture decision

**Where the build lives.** The website repo gets the free, portable, dependency-free library (`packages/spl-memory/`): schema, signing, export/verify, import planning, destination adapter, CLI example, tests. This matches the public promise — "the format is free" — and needs no backend.

**Signing.** This repo's established signing is HMAC-SHA256 (warrant.mjs), but HMAC cannot back a portable format: verifiers would need the server secret. The memory envelope uses **ES256 via `node:crypto`** (zero new dependencies), `kid`-keyed, with a JWKS-style public-key document — the same shape the Rider ecosystem already uses (`agentrider.fly.dev/.well-known/jwks.json`). Domain-separated from Rider credentials and toll receipts via distinct `typ`/purpose headers.

**Hosted transfer + billing.** Belongs on Agent-Rider where the toll gates live (`/api/toll/tools/*` conventions). Delivered here as a **complete, tested reference implementation** (`packages/spl-memory/transfer-service.mjs`, file-backed, `/data` conventions, x402 rail patterns reused) plus a landing spec for the CLI. Nothing deployed; no live charges.

**Rider/Warrant integration.** The library authenticates Rider credentials by calling the existing verify path (`POST https://agentrider.fly.dev/api/rider/verify`, same as `warrant.mjs:verifyRiderToken`) and validates Warrants with the existing `warrant.mjs` — no new identity code, no fabricated backend changes.

**What stays out of v1.** Vectors, attachments, model weights (per task); end-to-end encryption for hosted transfers (not implemented — documented as not offered); production billing enablement (explicit approval required).
