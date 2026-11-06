# ACN directory listings packet

Where ACN surfaces get listed so outside agents find and pay them.
Source of truth for tool names: `docs/site/api/mcp.js` (TOOLS + COMMERCE).

## MCP tools (served at /mcp)

| Tool | Price | Auth | Receipt |
|---|---|---|---|
| spl_discover | free | none | none |
| spl_lab_auth | free | none | none |
| spl_signup | free | none | account |
| spl_agent_key | free | none | key id |
| spl_catalog | free | none | none |
| spl_compress | metered | receipt | signed |
| spl_decompress | metered | receipt | signed |
| spl_zip | metered | receipt | signed |
| spl_unzip | metered | receipt | signed |
| spl_quote | free | none | quote |
| spl_warrant_issue | free lane | rider/JWT | warrant |
| spl_warrant_verify | free | none | verdict |
| spl_warrant_receipt | free lane | warrant | receipt |
| spl_agentic_plan | free | none | plan |
| spl_agentic_run | metered | confirm+rider/warrant | receipts |

## 402 routes (pay-per-call, x402)

- Suite and product metered endpoints under `docs/site/api` (see x402-products, x402-suite).
- AWLpay quote/execute on the live app (`/api/pay/quote`, `/api/pay/execute`, 402-first).
- Human checkout links (`/pay?sku=`).

## Membership tiers (freemium gate)

| Tier | Who | Terms |
|---|---|---|
| free | no seat | 1 GB lifetime input per IP, standard $0.25/GB after |
| founding | signup seq 1-10 of the first 100 | 6 months (180 days), 10 GiB/mo included, $25/mo spend ceiling, then standard rates |
| paid | claim-token seat SKU | per-SKU allowance from the catalog |

Founding grants bind one rider_id, are non-transferable, and are recorded
in the suite ledger (`founding-grants.mjs`). In-window but ungranted
sequences (11-100) ride free; past sequence 100 the window is closed.

## ACN run stages (spec keys for plan/run)

| Spec key | Stage | Needs |
|---|---|---|
| depotStore { op: publish/retrieve/list } | depot-store | adapters.depotStore { endpoint, key, fetchFn? } |
| chamberSeal { seal: obj } or { open: env } | chamber-seal | adapters.chamberSeal { keyHex } |
| membership { grant_seq?, spent_cents? } | membership | adapters.membership { dir?, nowMs? } |

No adapter means the stage refuses fail-closed with adapter_required and
zero network. Keys travel via adapters only, never in specs or receipts.

## Canonical rails

AWLpay is the settlement solution: ACN executes, agenTill accounts. The
WalletVerse sample points here. Rider identity pairs with x402 in the
rider-paid-call stage (Rider JWT plus txHash proof, Base USDC). The
supported client is `@slidphi/spl-acn`; the old docs-only listing is a
read-only pointer.

## Login continuity (.dSF pointer file)

Bulk stays on the rider's own disk: ledgers under `~/.acn/` (founding
grants, subscriptions, session mirrors), blobs and checkouts beside them.
Exactly one small file per rider, `.dsf/<rider_id>`, lives in the shared
depot so the next login resumes anywhere. Rules: 64 KiB max, no secret
keys at any depth, every save chains prev_sha so a stale writer gets
`conflict` instead of forking two logins. Next login: load the pointer,
merge, save with the fresh prev_sha, mirror locally. Depot down means
work continues offline from the mirror — the depot is sync, not truth.

## Submission checklist

- [ ] x402 directories (x402scan and peers): name, URL, price, receipt shape.
- [ ] Agent marketplaces: capability card + 402 example call.
- [ ] MCP registries: server card + tool list.
- [ ] Re-check quarterly: prices and receipts drift, listings rot.
License: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
