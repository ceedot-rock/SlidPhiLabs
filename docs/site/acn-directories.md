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

## Submission checklist

- [ ] x402 directories (x402scan and peers): name, URL, price, receipt shape.
- [ ] Agent marketplaces: capability card + 402 example call.
- [ ] MCP registries: server card + tool list.
- [ ] Re-check quarterly: prices and receipts drift, listings rot.
License: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
