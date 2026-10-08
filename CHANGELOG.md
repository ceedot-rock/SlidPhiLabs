# Changelog — Slid Phi Labs npm Packages

Version history for the npm packages published under the `cptasz13` npm account.

All packages live on https://www.slidphilabs.com.

---

## slid-phi

The primary hosted-compression client and agent-discovery entry point.

### [2.3.1] — current
- MCP server card: `https://www.slidphilabs.com/.well-known/mcp/server-card.json`
- `scripts.test` added
- Node 24 compatible (`_nodeVersion: 24.20.0`)

### [2.3.0] — 2026-10
- Full hosted-compression client rewrite: `compress()` and `decompress()` against the live host
- MCP server at `https://www.slidphilabs.com/mcp` (streamable HTTP)
- `agentic.suite` points to the Pay Per Suite page
- Pricing manifest with SKU list embedded in `package.json`
- `platform.json` discovery endpoint added
- License: AGPL-3.0-or-later
- Deprecated marker from prior stub versions removed

### [2.2.5] — 2026-09
- x402 and agentic discovery fields added to `package.json`
- `agent_card`, `agents_txt`, `agents_json`, `agentic_commerce` endpoints embedded
- Commerce flow: GET `https://www.slidphilabs.com/api/agent` then X-PAYMENT on Solana or Base mainnet

### [2.2.4] — 2026-09
- Homepage updated to `https://www.slidphilabs.com`
- Fib/ANS codec description stabilized

### [2.2.3] — 2026-09
- Node 26 build (`_nodeVersion: 26.3.1`)
- Description updated

### [2.2.1] — 2026-09
- Description: Zeckendorf/hybrid Fibonacci + optional gap-ANS path
- Homepage: `https://slidphilabs.vercel.app`

### [2.2.0] — 2026-09
- Initial public version; stub pointing to `https://slidphilabs.vercel.app/access`

---

## blackjack-compression

Alias client for the hosted PCC compression path. Same lab host as `slid-phi`.

### [1.6.1] — current
- Minor fixes

### [1.6.0] — 2026-10
- Full hosted-compression client replacing stub
- `stub.mjs` entry; calls `POST /api/compress` on the lab host
- License: AGPL-3.0-or-later
- Keywords narrowed to: `compression`, `pcc`, `archive`, `slid-phi-labs`, `blackjack`

### [1.4.4] — 2026-09
- Agentic commerce fields added (same shape as `slid-phi` 2.2.5)
- Keywords extended: spl-codec, cddg, agent-platform, cuni, agent-rider, quikgater

### [1.4.3] — 2026-09
- x402 and agentic discovery fields added to `package.json`

### [1.4.2] — 2026-09
- Homepage updated to `https://www.slidphilabs.com`
- Blackjack v4 pure-JS description: Fib ops, Rice, Elias omega, Delta-squared, Combinadic sets + LZ77

### [1.4.1] — 2026-09
- Description updated; Slid Phi Labs branding

### [1.4.0] — 2026-09
- Initial public version; stub pointing to `https://slidphilabs.vercel.app/access`

---

## spl-pay-per-suite

Quotes, Stripe (human) + x402 (agent) checkout, CLI, and MCP server for the Slid Phi Labs compression and agent platform.
Deprecated in favor of `@slidphi/spl-pay-per-suite`.

### [1.2.3] — current
- Minor fixes

### [1.2.0] — 2026-10
- Pricing model updated: first 2 GB/month free, then 8 cents/GB
- Try Gate retired
- `zip()` builds a `.pcc` archive
- `spl-mcp` bin entry added
- `team_mesh` endpoint: `https://spl-team-mesh.fly.dev`
- License: AGPL-3.0-or-later
- 12 files in package (up from 7)

### [1.1.3] — 2026-09
- Pricing model: first 1 GB free then ~1.5 cents/GB (freemium v2)
- Try Gate retired in this version
- `suite` and `platform_json` agentic fields added

### [1.1.2] — 2026-09
- Agentic platform fields: compression module (SPL Codec, CDDG:Split), agent platform (CuNi, Agent^Rider, Quikgater)
- Agent Rider URL updated to `https://agentrider.vercel.app/`

### [1.1.1] — 2026-09
- Initial release: on-spot quotes, Stripe + x402 checkout, MCP server, CLI (`spl-pps`, `pay-per-suite`, `spl-pay-per-suite` bin entries)
- Library entry at `src/index.mjs`, `./quote` export
- x402 and agentic discovery fields embedded

---

## @cptasz13/tru8

Zeros pack locally to 8 bytes; everything else routes to hosted PCC.

### [0.2.0] — current (as of site knowledge, October 2026)

No prior public release history available. Starting point documented from this version forward.

---

*Versions and dates are reconstructed from npm registry metadata and GitHub commit history. Exact publish dates for 2026-09 versions are not available from the registry `time` endpoint but follow the npm operational timestamps embedded in each version record.*
