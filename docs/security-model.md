# Slid Phi Labs — Security Model

**Version:** 1.0.0
**Date:** October 8, 2026
**Author:** Nova (Systems Architect, Slid Phi Labs)
**Reviewed by:** Cipher (Security & Trust Engineer)
**Scope:** Rider credential lifecycle, Warrant threat model, Chamber two-key split, AwLPay payment security, explicit non-claims

---

## Overview

This document describes the security model for Slid Phi Labs' core infrastructure products. It is written to the standard a security researcher, protocol reviewer, or enterprise buyer would hold it to. Claims here are precise: each section states what the mechanism protects, what it does not protect, and where the open questions and known gaps sit.

The infrastructure covers four interlocking concerns:

1. **Rider** — agent identity: who is making this call?
2. **Warrant** — agent authorization: what is this agent allowed to do?
3. **Chamber** — secret management: how does the agent keep its keys safe?
4. **AwLPay / x402** — payment integrity: did the agent actually pay, and can that fact be trusted?

These are not independent. A Rider credential is the input to a Warrant. A Warrant governs what an agent pays for. A Chamber-sealed secret is how the agent's merchant key survives across restarts. Understanding the security model means understanding all four layers and the seams between them.

---

## 1. Rider Credential Lifecycle

### 1.1 What Rider does

Rider gives an AI agent a signed, verifiable identity credential that travels as a plain HTTP header (`X-Agent-Rider`). Any downstream service can verify that credential locally, without calling back to the lab, using the lab's published JWKS endpoint.

### 1.2 Credential structure

Rider credentials are **ES256 JWTs** (ECDSA with P-256). The JWT carries:

| Claim | Meaning |
|---|---|
| `agent_id` | Stable identifier for this agent, set at issuance |
| `operator_id` | Fleet namespace the agent belongs to |
| `level` | Clearance level (L0 through L4) |
| `jti` | Unique token ID, used for receipt binding and revocation reference |
| `iat` | Issued-at time (Unix seconds) |
| `exp` | Expiry time (`iat + 900`; the credential lives for exactly 15 minutes) |

The private signing key is held server-side at `agentrider.fly.dev`. The corresponding public key is published as a JWKS endpoint. Verifiers fetch the JWKS once and cache it; they do not call the lab per-request.

### 1.3 Issuance

Credentials are issued at `POST https://agentrider.fly.dev/api/rider/issue`, authenticated with the merchant's `X-Merchant-Key` header.

```
POST https://agentrider.fly.dev/api/rider/issue
X-Merchant-Key: <merchant key>
Content-Type: application/json

{ "agent_id": "my-agent-001", "operator_id": "my-fleet", "level": "L2" }
```

Response:
```json
{ "rider": "<ES256 JWT>", "expires_in": 900 }
```

The merchant key is the issuance gate. Its compromise means any caller can issue arbitrary Rider credentials under the merchant's fleet namespace. Treat the merchant key as a root credential: store it in Chamber or equivalent, rotate it on suspicion of exposure, and never commit it to source control.

### 1.4 The 15-minute TTL

The 15-minute expiry is deliberate. It bounds the window of usefulness for a stolen credential without requiring synchronous revocation infrastructure on every verification path. The model is:

- **Stolen-credential window:** At most 15 minutes from theft to expiry.
- **Proactive refresh:** Agents are expected to refresh 60 seconds before expiry (at the 14-minute mark) to avoid edge rejections during network latency.
- **Silent failure window:** An agent that does not implement a refresh loop will hold a valid credential for 15 minutes and then hold an expired one silently. The downstream service rejects the call; the agent gets a 401. This is the designed failure mode: loud at verification, not silent data loss.

**What this window does not protect against:** A stolen credential is valid for up to 15 minutes after theft. There is currently no synchronous JTI revocation list. If you learn that a Rider JWT was compromised, you cannot invalidate it before its `exp` — you can only rotate the merchant key to prevent new credentials from being issued under the same authority and wait for the stolen credential to expire.

This is a known gap. A JTI revocation list is the standard mitigation. It is not yet implemented. See section 5 (Non-Claims) for the explicit statement.

### 1.5 Peer verification

Any service receiving an `X-Agent-Rider` header verifies it at `POST https://agentrider.fly.dev/api/rider/verify` or directly against the JWKS:

```
POST https://agentrider.fly.dev/api/rider/verify
Content-Type: application/json

{ "rider": "<JWT string>" }
```

Response (valid):
```json
{ "valid": true, "rider": { "agent_id": "...", "level": "L2", ... } }
```

Verification is **free, unauthenticated, and rate-unlimited** for any caller. This is intentional: making verification gated would break the peer-verification model. The JWKS-based path allows fully local verification with no outbound call at all once the public key is cached.

### 1.6 Algorithm security

ES256 (ECDSA P-256) is appropriate for this use case. The following attack classes are the ones verifiers must guard against:

**alg:none bypass.** JWT libraries that do not pin the expected algorithm will accept a token with `"alg":"none"` and no signature. Every verification path must explicitly reject any algorithm value other than `"alg":"ES256"`. Do not delegate algorithm selection to the inbound token.

**Algorithm confusion (RS256 to HS256).** If the JWKS public key is obtainable and the verifier does not pin the algorithm, an attacker can construct an HS256-signed token using the public key as the HMAC secret. Guard: pin `"alg":"ES256"` before any signature verification step.

**jku/x5u header injection.** If a verifier fetches the JWKS from a URL embedded in the JWT's header (`jku` or `x5u` claim) rather than from a pinned, configured URL, an attacker can craft a JWT pointing at their own JWKS server. Guard: never follow `jku` or `x5u` from an inbound token. Fetch the JWKS only from the pinned `agentrider.fly.dev` JWKS endpoint.

**CVE-2022-21449 (Psychic Signatures).** Affects ECDSA implementations in Java 15 through 18. A blank signature (r=0, s=0) passes validation in vulnerable runtimes. If any verification path runs on an affected Java version, a blank-signature forged Rider credential will be accepted as valid. Guard: verify the Java runtime version on every service that verifies Rider JWTs; upgrade to Java 19+ or apply the patch.

**ECDSA nonce reuse.** A reused signing nonce `k` across two signatures mathematically leaks the private key. This is a library-level risk, not an application-level one. Use a well-audited, actively maintained cryptographic library for signing. Do not use custom signing code.

### 1.7 JWKS endpoint

The Rider JWKS endpoint is the trust anchor for all credential verification. Its location is pinned server-side. Verifiers must not derive the JWKS URL from the inbound token header.

The JWKS endpoint must be:
- **Accessible** to any verifier without authentication.
- **Stable** — key rotation must use the `kid` (key ID) field to allow a rolling transition window rather than a hard cutover.
- **Monitored** — endpoint downtime causes all peer verification to fail or fall back to cached keys. Stale-cache behavior on downtime must be explicitly documented by each integrator.

---

## 2. Warrant Threat Model

### 2.1 What Warrant does

A Warrant is a signed mandate bound to a Rider identity. It specifies:

- `allow_hosts` — the set of hostnames the agent is permitted to call
- `actions` — the action types the agent is permitted to invoke
- `max_usd` — the maximum USD value the agent may spend under this mandate
- `max_calls` — the maximum number of calls
- `exp` — expiry time

The Warrant token format is `w1.<base64url payload>.<HMAC signature>`. The HMAC signing key is server-held. After each job, the agent files a receipt via `spl_warrant_receipt`, which decrements `remaining_usd` and `remaining_calls` and appends an auditable receipt to the token's record.

### 2.2 Spend caps and call caps

Spend caps (`max_usd`) and call caps (`max_calls`) are the operator-supplied limits on what a Warrant allows. They function as an upper bound on agent autonomy: an agent holding a Warrant with `max_usd: 5` cannot be directed to spend more than $5 under that mandate, regardless of what instructions it receives.

**What caps protect against:**
- Runaway agent spending caused by malformed instructions or prompt injection
- An operator's cost exposure from a compromised agent key
- Scope creep from an agent acting beyond its briefed mandate

**What caps do not protect against:**
- An agent that holds multiple Warrants. Each Warrant is independently capped; an attacker who can issue multiple Warrants can route around any single cap.
- Receipt manipulation. If receipts are only enforced client-side (the agent self-reports what it spent), an agent or attacker who does not file receipts can exhaust a mandate silently and continue acting. Server-side enforcement of remaining balances per-warrant is the correct design. Whether this is currently enforced server-side is treated as an open question in section 6.

### 2.3 Host restrictions

`allow_hosts` specifies a whitelist of hostnames the Warrant permits the agent to call. A verifying service compares the request's target host against this list before acting.

**What host restrictions protect against:**
- An agent being directed to exfiltrate data to an attacker-controlled domain
- An operator's Warrant being used on services the operator did not authorize

**What host restrictions do not protect against:**
- A verifier that does not enforce the `allow_hosts` check. The mandate is only as strong as the enforcement on the receiving end.
- DNS-level attacks where an allowed hostname is pointed at a malicious IP. The Warrant enforces hostname matching, not IP matching or TLS certificate pinning.

### 2.4 Receipt integrity

Receipts are the audit trail for Warrant-bounded operations. Each call to `spl_warrant_receipt` records what action was performed and how much USD was spent, appending to the `receipts` array on the token record.

The receipt mechanism provides:
- An operator-visible log of what the agent did under the mandate
- A decrement of `remaining_usd` and `remaining_calls` that bounds further action

**Receipt integrity depends on server-side enforcement.** If the server trusts the client to file accurate receipts but does not independently verify the spend, a compromised agent can misreport spend amounts or skip filing receipts entirely.

### 2.5 Demo mode

Warrants issued with `"demo": true` carry:
- `rider_jti: null` (no Rider identity binding)
- `level: "L0"`
- A 10-minute expiry
- `max_usd: 1`, `max_calls: 20`

Demo tokens are real signed Warrant tokens. They are accepted by the verifier as syntactically valid.

**Critical trust boundary:** Any downstream service that accepts `X-Agent-Warrant` and does not check that `demo === false` before granting production access is susceptible to a demo token being used as a valid credential. A demo token costs nothing and requires no Rider credential.

**The fix must be applied consistently:** Every service that gates on a Warrant must check `warrant.demo === false` before granting non-demo access. This check must be present in the verifier, not assumed from the token's origin.

### 2.6 HMAC signing

Warrant tokens are signed with a server-held HMAC key. The algorithm and key length are not publicly disclosed. The security of the Warrant token format depends on:

1. The HMAC key being of sufficient length (256 bits minimum for HS256; 384+ bits for HS384/HS512).
2. The HMAC key not being shared across dev, staging, and production environments.
3. The HMAC key being rotated on suspicion of compromise.

If the HMAC key is short, guessable, or leaked, an attacker can forge arbitrary Warrant tokens with any `allow_hosts`, `actions`, `max_usd`, and `max_calls` values they choose. Because the Warrant format is publicly documented, offline forgery attempts are straightforward once the key is known.

---

## 3. Chamber Two-Key Split

### 3.1 What Chamber does

Chamber is a JSON secret seal. It splits an input secret into two key shares; opening the sealed blob requires both shares. The sealed blob is portable and stored by the user. The SDK is `json-chamber` 1.4.1 on PyPI; MCP tools are available.

### 3.2 What the two-key split protects against

- **One share stolen:** Secret is safe. The attacker has a cryptographically useless fragment.
- **Both shares stolen:** Secret is exposed.
- A single point of compromise on the key storage side
- Casual credential leakage (e.g., one key is accidentally committed to a repo; the secret remains protected as long as the second share is held elsewhere)

### 3.3 What the two-key split does not protect against

- **Theft of both shares.** If both shares are held in the same location, the split provides no practical protection. The value of the split is in distributing shares to independent storage systems.
- **Compromise of the unsealing process.** At the moment a secret is unsealed, the plaintext exists in memory. Any process that can read memory during this window can capture the plaintext.
- **Server-side storage of plaintext.** If Chamber stores sealed blobs server-side and the server performs the unsealing, a server compromise retrieves all secrets.

### 3.4 Open question: client-side vs. server-side encryption

The current public documentation describes Chamber as producing a "portable encrypted blob stored by the user." The sealing and unsealing mechanisms are not fully documented publicly. The security property of the two-key split depends critically on whether encryption and decryption happen on the client (stronger) or on the server (weaker). This distinction is not currently resolvable from public documentation. Operators storing high-value secrets in Chamber should confirm with the lab which model is in force.

---

## 4. AwLPay Payment Security

### 4.1 What AwLPay does

AwLPay is the payment infrastructure layer. It accepts USDC payments on Solana and Base, reads a public last-trade price print, quotes a fee, and locks it. The stated guarantee: refuses when math doesn't work. No silent slippage.

The x402 protocol flow:
1. Agent calls `GET /api/x402-products` to fetch the live catalog and payment rails.
2. Agent calls `POST /api/x402-products` with the desired SKU, receives `402 Payment Required`.
3. Agent settles USDC on-chain (Solana SPL transfer or Base ERC-20 transfer).
4. Agent retries with a base64-encoded `X-PAYMENT` proof header.
5. Server verifies the proof and returns a `claim_token`.
6. `claim_token` is used as `Authorization: Bearer <token>` for subsequent access.

### 4.2 Price lock mechanics

AwLPay reads a live price oracle to quote the fee in USDC. The quote is locked at request time. The server refuses to serve the resource if the payment amount does not match the locked quote.

**Price lock depends on:**
- The oracle being a trustworthy, manipulation-resistant price source.
- The lock window being short enough that price movements during settlement do not invalidate the quote.

### 4.3 Slippage refusal

AwLPay explicitly refuses payments where the submitted amount does not match the server-held lock. This is the primary financial integrity guarantee.

Amounts use integer-exact arithmetic: USDC has 6 decimal places, and amounts are expressed as integers (e.g., 1331 = $13.31). All client code must use `BigInt` or equivalent. Float arithmetic near money introduces rounding errors that trigger rejections.

### 4.4 On-chain settlement finality

**Solana.** Settlement proof is a `txSignature`. Solana has three confirmation levels: `processed` (non-final, can be reverted), `confirmed` (used in the reference guide), and `finalized` (strongest guarantee, ~13 seconds). The required level is `confirmed` at minimum. For high-value transactions, `finalized` is the appropriate commitment level.

**Base (EVM).** Settlement proof is a `txHash`. EVM finality on Base (Optimistic Rollup) involves a challenge window. A confirmed Base transaction has very low revert risk in practice.

### 4.5 Replay protection

Each payment proof is bound to the proof-id (`txSignature` on Solana, `txHash` on Base) plus the network. Submitting the same proof twice returns a `402` rather than granting a duplicate seat.

**The replay protection model depends on:**
- The server logging each proof ID on first presentation and rejecting any second presentation.
- This check being atomic. A race condition where two simultaneous presentations both pass the "not yet seen" check before either is logged represents a double-spend window.

### 4.6 The Solana settlement finality race

If the server accepts `confirmed` status and the transaction is later rolled back (rare but possible under Solana network instability), the resource has been delivered for a payment that did not finalize. The financial exposure per incident is bounded by the cost of the resource. This is a residual risk the lab accepts by operating at `confirmed` rather than `finalized` settlement.

---

## 5. What This System Explicitly Does Not Claim to Protect Against

This section is not a disclaimer. It is a precise enumeration of the attack classes that are outside the current security model. Operators and integrators must account for these in their own risk posture.

### 5.1 Mid-window credential theft

A stolen Rider JWT is valid for up to 15 minutes from its issue time. There is no synchronous JTI revocation list. The mitigation available today is to rotate the merchant key and wait for the stolen credential's TTL to expire. **This is an acknowledged gap.**

### 5.2 Merchant key compromise

The `X-Merchant-Key` is a bearer secret. Loss of the merchant key gives an attacker the ability to issue arbitrary Rider credentials under the merchant's fleet namespace. Key compromise is handled manually today: detect it, contact the lab, rotate the key.

### 5.3 Unauthenticated agent key issuance

The `POST /api/auth` endpoint with `"action": "agent_key"` requires no password, no email, and no proof of identity. Rate limits are per-key, not per-identity. The agent key is a rate-limiting mechanism, not an authentication mechanism. Do not treat possession of a `spl_ag_` key as evidence of a specific identity.

### 5.4 Demo warrant bypass

The lab provides correctly signed and correctly marked demo tokens. Enforcement of the `demo === false` check on downstream services is the integrator's responsibility.

### 5.5 Oracle manipulation

AwLPay's price lock and slippage refusal protect against paying the wrong amount for a valid quote. They do not protect against the quote itself being wrong due to oracle manipulation.

### 5.6 Prompt injection into Warrant-authorized agents

A Warrant caps what an agent may spend and which hosts it may call. It does not prevent the agent from being misdirected by adversarial inputs within the permitted scope.

### 5.7 Supply chain compromise in npm packages

Slid Phi Labs publishes npm packages (`slid-phi`, `spl-pay-per-suite`, `blackjack-compression`, `@cptasz13/tru8`). The lab cannot protect against supply chain compromise of packages installed by third parties. Operators should pin package versions and audit dependencies.

### 5.8 Three undocumented internal services

The services `l33tsaas.fly.dev`, `overlord-eye.fly.dev`, and `teachaid.fly.dev` are surfaced in every agent key response via the `doors` object. Their purpose, authentication requirements, and security posture are not currently documented publicly. **The lab has not made a security claim about these services.** This section will be updated when the product decision on these services lands.

### 5.9 Sandbox (Box) isolation

The sandbox at `https://www.slidphilabs.com/box` allows evaluation of user-supplied input. The isolation model, runtime, and input restrictions are not publicly documented.

### 5.10 Webhook replay (Stripe rail)

Replay protection on the Stripe rail is the operator's responsibility. Validate the `Stripe-Signature` header's timestamp component on every webhook receipt.

---

## 6. Open Questions and Flagged Sections

| # | Item | Status | Impact if unresolved |
|---|---|---|---|
| OQ-1 | JWKS endpoint public URL for Rider | Not publicly documented | Integrators cannot pin the JWKS URL independently |
| OQ-2 | Chamber sealing model (client-side vs. server-side) | Not confirmed publicly | If server-side: a server compromise exposes all stored secrets |
| OQ-3 | Warrant HMAC algorithm and key length | Not disclosed | Determines whether offline warrant forgery is theoretical or practical |
| OQ-4 | x402 txSignature deduplication atomicity | Not visible from public docs | A non-atomic check creates a double-spend window |
| OQ-5 | l33tsaas, overlord-eye, teachaid — purpose and auth | Not documented | Three live services disclosed to all key holders with no auth documentation |
| OQ-6 | JTI revocation — roadmap | Not announced | Stolen Rider JWTs remain valid for their full 15-minute TTL |
| OQ-7 | Solana finality level accepted by server | Not confirmed | Determines the exact finality-race exposure window |
| OQ-8 | Warrant receipt enforcement model | Not confirmed | If client-side only: an agent can over-spend its mandate without detection |

A section marked open here is not a vulnerability; it is a gap in the documented security model that an integrator cannot currently reason from. These sections will be updated as the lab resolves each question.

---

## 7. Integration Security Checklist

### Rider

- [ ] Algorithm pinning: all verifiers explicitly accept only `"alg":"ES256"` and reject all other values, including `"none"`
- [ ] JWKS URL is pinned in verifier configuration; not derived from the inbound token's `jku` or `x5u` header
- [ ] Java runtime (if applicable) is 19+ or patched for CVE-2022-21449
- [ ] Refresh loop is implemented: agent refreshes the Rider JWT at least 60 seconds before `exp`
- [ ] Merchant key is stored in Chamber or equivalent secret management; not committed to source control
- [ ] Merchant key rotation procedure is documented and tested

### Warrant

- [ ] All services accepting `X-Agent-Warrant` check `warrant.demo === false` before granting non-demo access
- [ ] `allow_hosts` is enforced on the verifying service, not only trusted from the token
- [ ] Receipt filing is implemented for all Warrant-bounded operations
- [ ] Warrant HMAC key is not shared across dev/staging/production environments

### Chamber

- [ ] Key shares are stored in independent locations (different machines, different cloud providers, or different secret stores)
- [ ] Neither key share is committed to source control
- [ ] Unsealing only occurs in a controlled, audited process; the plaintext window is minimized

### AwLPay / x402

- [ ] All payment amounts use integer arithmetic (`BigInt` in JavaScript); no float arithmetic near money
- [ ] `payTo` addresses and amounts are always fetched from the live catalog at runtime; never hardcoded
- [ ] Proof IDs (`txSignature` or `txHash`) are not reused across payment attempts
- [ ] Solana settlement uses `"confirmed"` commitment minimum; `"finalized"` for high-value transactions
- [ ] Double-spend protection: the same proof ID is never submitted to two endpoints simultaneously

---

## 8. Summary Security Posture

| Layer | Core guarantee | Known gap |
|---|---|---|
| Rider — issuance | ES256-signed, 15-min TTL, merchant-key gated | No JTI revocation; stolen credentials valid for up to 15 min |
| Rider — verification | Free peer verification via JWKS; no call-home per request | JWKS URL not publicly documented |
| Warrant — scope | Host restrictions, spend caps, call caps, HMAC-signed | Demo mode bypass if downstream omits `demo` check; receipt enforcement model unconfirmed |
| Chamber — secret management | Two-key split; portable encrypted blob | Client-side vs. server-side encryption model unconfirmed publicly |
| AwLPay — price integrity | Locked quote; integer-exact amounts; slippage refusal | Oracle manipulation outside scope; finality model depends on accepted commitment level |
| x402 — replay | Proof ID deduplication on first presentation | Atomicity of deduplication check under concurrent requests unconfirmed |

---

*Slid Phi Labs. Questions: corey@slidphilabs.com*
*This document is versioned. Check https://www.slidphilabs.com/security for the current version.*
