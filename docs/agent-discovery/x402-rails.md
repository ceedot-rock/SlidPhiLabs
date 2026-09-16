# x402 USDC rails

Two live chains. One asset (Circle USDC). Split receive keys.

## Base
- network: `eip155:8453`
- mint: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- scheme: exact + EIP-3009
- env: `X402_PAY_TO_BASE`
- facilitator: CDP

## Solana
- network: `solana-mainnet-beta` or CAIP-2 `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`
- mint: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- scheme: exact SPL transfer / serialized tx
- env: `X402_PAY_TO` (storefront) / `X402_PAY_TO_SOLANA` (Rider)

## Why the 2026-09-15 probe only showed Solana
`docs/site/api/x402-products.js` only pushes a Base accept when `baseConfig().enabled` — that requires `X402_PAY_TO_BASE` (or EVM alias). Solana `X402_PAY_TO` was set. Set the Base key on Fly/Vercel and GET /api/x402-products will list `payment_rails` length 2.
