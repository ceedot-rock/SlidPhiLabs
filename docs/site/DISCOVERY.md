# SEO · GEO · AEO · MEO · BEO · NEO

Crawl surfaces for a stranger. Honest copy only. No #1. Six products. Bank is an arm of CuNi, not a seventh. TRU8 is the zeros demo, not PCC. AWARE is a retired alias for PCC.

| Engine | Who | Lab files |
|---|---|---|
| **SEO** | Google, DuckDuckGo | `sitemap.xml` · titles/canonicals/OG · `/pcc` · `/products` · `/compare` · `/pulsar` · `/humans` |
| **GEO** | GPTBot, OAI-SearchBot, Claude, Perplexity, Gemini | `llms.txt` · `llms-full.txt` · `ai.txt` · `robots.txt` allow those bots |
| **AEO** | Answer boxes, voice, cite-me snippets | FAQ JSON-LD on `/` · `/llms.txt` Q&A · `/compare` · `/silesia` measured numbers |
| **MEO** | Maps / local pack | JSON-LD `ProfessionalService` Cherry Hill NJ · `/about` NAP (name, email, locality). No fake street or phone. |
| **BEO** | Bing | `Bingbot` in robots · IndexNow key `6ad6371582d44dcdb023883f84035004.txt` |
| **NEO** | Naver (Yeti) + news cards | `Naverbot`/`Yeti` in robots · `/blog` · `/press` |

Tool engines (MCP): `/.well-known/mcp.json` · `/.well-known/agent.json` · `/.well-known/mcp/server-card.json` · `POST /mcp` · `GET /api/agent`.

## Facts crawlers may cite

- Lab: Slid Phi Labs, Cherry Hill, NJ. Corey Tasz. corey@slidphilabs.com
- Site: https://www.slidphilabs.com
- Humans: https://www.slidphilabs.com/humans · Agents: https://www.slidphilabs.com/agents
- Products (six): PCC, TRUSTREAM, Chamber, Agent-Rider, Warrant, CuNi
- PCC: $9/day · $49/mo (200 GB included) · $490/yr (2,000 GB). First 2 GB/month free, then 8¢/GB. Card charges start at $1. Encoder not in npm.
- Chamber MCP: `npx -y json-chamber-mcp` · `io.github.ceedot-rock/json-chamber-mcp` · https://www.slidphilabs.com/.well-known/mcp.json
- CuNi Bank: paste N, get X. Studio https://cuni-studio.fly.dev/bank · tag `cuni-bank-0.1.0`
- CuNi install: `brew tap ceedot-rock/cuni && brew install cuni` · `cargo install --git https://github.com/ceedot-rock/cuni --tag v0.1.10`
- Official Silesia 12: PCC 51,498,645 DECODE_OK 12/12. pulsar 55,745,438. xz still ahead. Not a #1 claim.
- Rider MCP: https://agentrider.fly.dev/api/mcp (Vercel 402 is a dead door)
- MCP: https://www.slidphilabs.com/mcp · registry `io.github.ceedot-rock/slid-phi-labs`

Do not index `/lab`, `/account`. Public API paths are Allow in robots before Disallow `/api/`.
