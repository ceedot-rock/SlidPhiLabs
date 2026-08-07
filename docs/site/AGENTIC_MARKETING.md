# Agentic marketing — discovery attract surface

## Research summary (2026-08-07)
Agent commerce discovery is a **stack**, not one ad:
1. Access — robots.txt
2. Inventory — sitemap
3. Content map — llms.txt
4. Capabilities — agents.txt / agents.json (agents-txt.com)
5. Protocol detail — 402 bodies + /api/agent

## Perfect one-liner (distribute everywhere)
```
Agent commerce: GET https://www.slidphilabs.com/api/agent then pay via x402 (X-PAYMENT) on catalog POST.
```

## Shipped surfaces
| Path | Role |
|------|------|
| GET /api/agent | Dynamic SoT discovery |
| /agents.txt | Layer-4 capability announcement |
| /agents.json | Structured payments + discovery |
| /llms.txt | LLM/crawler map + commerce |
| /.well-known/agent-card.json | A2A-style card |
| /.well-known/agentic-commerce.json | Commerce-specific well-known |

## Marketing team loop
1. **Discovery** — keep one-liner + /api/agent correct
2. **Proof** — one external successful x402 charge (try-gate preferred starter)
3. **Distribution** — MCP package, npm READMEs, X, HN, agent registries, awesome-agentic lists
4. **Measure** — hits on /api/agent, /agents.json, 402 rate, paid completions

## Do not
- Put wallet addresses in discovery files (402 only)
- Lead agents at human-only Stripe without also advertising x402
- Invent parallel SKUs outside Host product map
