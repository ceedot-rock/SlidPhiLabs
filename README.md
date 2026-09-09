# Slid Phi Labs

Hosted lossless compression, a two-key JSON seal, signed agent identity, and a small language that refuses to lie.

This repository is the public website, API, and npm clients. It is not the production compressor. You buy a seat or a written exception — you do not get the encoder.

| Surface | URL |
|---|---|
| Website | https://www.slidphilabs.com |
| Products | https://www.slidphilabs.com/products |
| MCP | https://www.slidphilabs.com/mcp |
| npm | https://www.slidphilabs.com/npm |
| pulsar (free compressor) | https://github.com/ceedot-rock/pulsar-best |

## Products

| Product | What it is | Price |
|---------|------------|-------|
| **AWARE** | Hosted lossless compression. Send a file, get a smaller file back, restore every byte. | $9/day · $49/mo (200 GB) · $490/yr (2,000 GB), then 8¢/GB |
| **TRUSTREAM** | The same plan, for live logs. | Included with AWARE |
| **Chamber** | Two-key JSON seal. One share is useless. You store the blob. | $9/mo · $99/yr |
| **Agent-Rider** | Signed identity so you know which agent acted. | $79/mo · $790/yr |
| **CuNi** | Write one program. Print many languages. Python, Go, and JS must match, or it refuses. | Studio $0 · closed-app exception $490/yr |
| **pulsar** | Free GPLv3 compressor you can build yourself. Not AWARE. | Free · $490/yr to embed in a closed product |

First 2 GB each month are free with no plan. Compare: https://www.slidphilabs.com/compare

## npm

```bash
npm i slid-phi
npm i spl-pay-per-suite
npx -y spl-pay-per-suite mcp
```

These packages discover and quote. They do not ship the compressor.

## Status

See [STATUS.md](STATUS.md) · [CHANGELOG.md](CHANGELOG.md) · [SECURITY.md](SECURITY.md). Inbox: corey@slidphilabs.com

## License

Site and clients: see LICENSE. pulsar and CuNi are GPLv3. The hosted encoder stays here.
