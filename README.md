# Slid Phi Labs

**Public proof. Private performance. Paid production.** Slid Phi Labs builds lossless-compression and agent-infrastructure products. This repository contains the public site, integration clients, documentation, and payment rails—not the protected production compression engine.

| Surface | Public entry point |
|---|---|
| Website | https://www.slidphilabs.com |
| Hosted MCP | https://www.slidphilabs.com/mcp |
| MCP documentation | https://www.slidphilabs.com/mcp-service |
| MCP server card | https://www.slidphilabs.com/.well-known/mcp/server-card.json |
| npm catalog | https://www.slidphilabs.com/npm |
| Public compression baseline | https://github.com/ceedot-rock/pulsar-best |

## Product boundaries

**AWARE** is the hosted lossless-compression surface. **Agent-Rider** is a public-facing signed-agent-identity product. **Chamber** provides two-key JSON sealing. **CuNi** is a public exactness tool. The public packages and documentation describe these surfaces; protected routing, production engines, customer data, and issuer controls remain behind their appropriate operating boundary.

The private pathway evidence is presented with its measured scope. Do not describe internal results as a public first-place Silesia-table result.

## npm

Public packages are clients, quote tools, integration stubs, or demonstrations. They do not contain private encoders.

| Package | What it provides |
|---|---|
| `slid-phi` | Public HTTP client and discovery stub |
| `spl-pay-per-suite` | Quotes, checkout rails, and optional local MCP helper |
| `blackjack-compression` | Public integration stub for hosted compression services |
| `@cptasz13/tru8` | Public demonstration package |

```bash
npm install spl-pay-per-suite
npx -y spl-pay-per-suite mcp
```

For remote MCP use, point a compatible client at `https://www.slidphilabs.com/mcp`. No npm package is required for the hosted catalog server.

## Suite metering

The public Suite boundary is **6.9 GB and 3 hours unpaid**, then about **5¢/GB**. The package surfaces quote and commerce behavior; it does not bypass the hosted service or package the private engine.

## Status

See [STATUS.md](STATUS.md) · [CHANGELOG.md](CHANGELOG.md) · [SECURITY.md](SECURITY.md) · [CITATION.cff](CITATION.cff).

Inbox: corey@slidphilabs.com
