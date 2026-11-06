# ACN submission packets (ready to paste, no creds needed yet)

One row per listing venue: name, URL, price, receipt shape. An operator
with publisher creds pastes these; nothing here auto-posts.

## x402 directories

- Name: Slid Phi Labs ACN (Agent Commerce Network)
- URL: https://www.slidphilabs.com
- Price: free tier 1 GB lifetime per IP; paid from $0.02/verb; seats from $8/mo
- Receipt: signed JSON { stage, ok, tool, toolVersion, sha256/size/tx } per
  run step; x402 proofs are txHash + payerSig on Base/Solana
- Endpoints: card GET /api/mcp · tools POST /mcp · catalog via spl_catalog

## Agent marketplaces

- Capability card: staged commerce runs (plan + run with receipts),
  identity-gated (Rider), spend-capped (Warrant), sealed artifacts
  (Chamber), blob handoffs (Depot)
- Example call: `npx github:ceedot-rock/spl-acn call spl_quote '{"gb":10}'`
- Settlement: x402 USDC, AWLpay executes

## MCP registries

- Server card: https://www.slidphilabs.com/api/mcp
- Registry: io.github.ceedot-rock/slid-phi-labs
- Client: @slidphi/spl-acn (npm, once published) / github:ceedot-rock/spl-acn
- Tools: spl_discover, spl_catalog, spl_quote, spl_compress/decompress/zip,
  spl_warrant_issue/verify/receipt, spl_agentic_plan/run, sku_*/license_*

## Freshness rule

Listings rot: re-check prices and receipts quarterly against
docs/site/pricing.json and the live card. The weekly audit job covers it.
