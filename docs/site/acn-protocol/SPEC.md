# ACN Protocol 1.0.0 — Agent Commerce Network

Machine-readable message formats live in `schemas/` (JSON Schema
draft 2020-12); canonical valid messages live in `examples/`;
`index.json` manifests both. This file is the human companion:
transport, auth, the artifact map, and every refusal code.

Served statically: `https://www.slidphilabs.com/acn-protocol/`.
Checked in CI by `api/lib/acn-schema.test.mjs` (dependency-free
subset validator in `api/lib/acn-schema.mjs`): every example must
validate, negatives must fail.

## Transport

JSON-RPC 2.0 over HTTPS POST to `/mcp` (card on GET `/api/mcp`).
Methods: `initialize`, `tools/list`, `tools/call`, `ping`.
Tool results arrive as MCP content blocks (`content[0].text` is a JSON
string) plus `structuredContent`. Tool errors are data, not throws.

## Auth

Free tools need nothing. Paid seats send the claim token as
`Authorization: Bearer <claim>` — format `claim-token.json`
(`spl1.<base64url(payload)>.<base64url(hmac)>`). Identity-gated
tools take a Rider JWT (`rider` arg); spend-capped tools take a
warrant token (`warrant` arg, `warrant.json`).

## Artifacts

| Schema | Artifact | Producer → consumer |
|---|---|---|
| `run-receipt.json` | per-step signed receipt (stage, ok, tool, toolVersion + sha256/size/tx) | every staged run → SDK `verifyReceipt`, filings |
| `warrant.json` | spend mandate (`wrt_`/`wrt_demo_` ids, actions, caps, iat/exp) | `spl_warrant_issue` → verify/reserve/receipt |
| `warrant-receipt-filing.json` | receipt filing args | agent → `spl_warrant_receipt` |
| `claim-token.json` | paid-seat bearer | `spl_agent_key`/checkout → paid calls |
| `catalog-product.json` | one standing SKU | `spl_catalog` → quote/buy |
| `payment-required.json` | 402 refusal with `accepts` | paid tool → payer, then retry unchanged |
| `plan-spec.json` | staged-run plan (action/host/url/bytes + stage keys) | agent → `spl_agentic_plan` |
| `quote-args.json` | suite quote args | agent/CLI → `spl_quote` |
| `research-args.json` | web-search args | agent → `spl_research` (Tavily) |
| `error.json` | refusal envelope (`ok:false` + `error` or `reason`) | everything → caller |

## Refusal codes (machine reasons, never bare text)

Warrants (`warrant.mjs`): `missing_agent`, `chain_root_mismatch`,
`free_issue_cap`, `rider_invalid`, `missing_rider`,
`unknown_reservation`, `reservation_settled`,
`reservation_released`, `reservation_mismatch`, `action_not_allowed`.
Plans (`agentic-platform.mjs`): `missing_identity`, `missing_host`,
`unknown_crossing`, `bad_url`, `cap_exceeded`,
`spend_adapter_failed`. Search (`tavily.mjs`): `tavily_unset`,
`bad_query`, `tavily_error`. SDK transport (`@slidphi/spl-acn`):
`no_fetch`, `network_failed`, `timed_out`, `bad_response`,
`card_failed`, `bad_tool`, `bad_args`, `payment_required`,
`call_failed`, `tool_error`. Endpoints add `unknown_action`,
`invalid_json`, `missing_action`, `method_not_allowed`.

## Versioning

Additive changes (new optional fields, new codes) bump minor and are
announced in the changelog. Breaking changes (required fields,
renames, removed codes) bump major and dual-read for 90 days. This
document is at 1.0.0.
