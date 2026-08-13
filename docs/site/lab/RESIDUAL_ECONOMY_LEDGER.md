# Residual Economy · first integer plane

**Status:** ANCHORED (Host doctrine) · 2026-08-09  
**Law:** Residual Axiom — dE + dC ≈ 0 · dual A∥B ±33° · cadence 33·66·999  
**Scope:** Exact ledger before any move. Public residual shape only; no secret values.

---

## 0 · Ten-step assembly (CrewHive vote)

| # | Step | Status |
|---|------|--------|
| 1 | Anchor integer plane — fixed costs + incoming $ exact | **THIS DOC** |
| 2 | Dual A∥B spend columns — min vs −33% | **THIS DOC §2** |
| 3 | Time as structured-int — 90d · 66h sprint / 33h rest / 9h gate | Host calendar |
| 4 | Public micro-product freemium edge — 100 GB free · 5¢/GB | **LIVE** `/pps` `/bench` |
| 5 | Surplus via owned Stripe + x402 only | **PIPES LIVE** |
| 6 | Compress personal burn like data | Host action |
| 7 | Visible scoreboard | **LIVE** `/standings` `/bench` |
| 8 | 30% profit → next lattice seat (agentic) | After first profit |
| 9 | Day 180: re-run dE+dC≈0 before headcount | Future gate |
| 10 | Ship next artifact only when prior paid egress | Discipline |

---

## 1 · Fixed costs (known from stack · Host fills $)

### 1.1 Compute hosts (Fly.io) — always-on or stoppable

| App | Role | Status (2026-08-09) | Cost class (order of magnitude) | Host $ / mo |
|-----|------|---------------------|----------------------------------|-------------|
| **slidphilabs** | Public site · `/pps` · `/bench` · `/standings` · APIs | deployed · auto_stop | shared-cpu · ~256–512 MB class | **___** |
| **slidphi-smart-box** | Chamber · Creator · army | deployed · min 1 · 2 GB | **highest** private burn | **___** |
| **spl-team-mesh** | OneGate collab | deployed | small shared | **___** |
| **teachaid** | School | suspended | $0 while stopped | **0** if stay off |
| **cuni-studio** | Studio | suspended | $0 while stopped | **0** if stay off |
| **quikgater-browser-worker** | Fetch worker | deployed | worker class | **___** |

*Fill Host $ from Fly billing dashboard. Do not invent.*

### 1.2 Platform / SaaS (names present in vault · amounts Host-only)

| Surface | Purpose | Key present | Host $ / mo |
|---------|---------|-------------|-------------|
| **Stripe** | Suite + ZRW SKUs + webhooks | `STRIPE_*` · `ZRW_STRIPE_*` | fee on volume only |
| **x402 / Base / Solana rails** | Agent pay | `X402_*` · pay addresses on Fly | gas residual |
| **xAI / Grok** | TEACHAiD · Chamber speech | `XAI_API_KEY` | usage **___** |
| **Notion** | Clergy / notes | `NOTION_*` | plan **___** |
| **Domain / DNS / Wix face** | Marketing apex | Wix + Fly certs | **___** |
| **npm / GH** | Publish surface | `NPM_TOKEN*` | $0–low |
| **Vercel (Agent-Rider etc.)** | MCP / agent web | if used | **___** |

### 1.3 Product SKUs (incoming unit prices · code-canonical)

| Product | Free edge | Paid edge | Source |
|---------|-----------|-----------|--------|
| **SPL Pay Per Suite** | **100 GB / job free** | **$0.05/GB** first 100 billable GiB · **$0.04/GB** after · min **$0.05** | `api/suite-pricing.js` |
| CDDG-split add | — | +$0.25 when billable | same |
| ZRW Starting Gate / Pro / L33t | Stripe Payment Links | fixed SKUs | `ZRW_STRIPE_*` |
| TEACHAiD Pro / tuition | pricing page | Stripe | teachaid |
| Team Mesh rooms | free local + Stripe room fees | $20 create / $1 join (catalog) | mesh UI |
| Boxing Sim | free local v0.1 | TBD commercial | game division |

### 1.4 Incoming dollars (must be exact — Host Stripe)

| Stream | Pipe | Last 30d $ | YTD $ | Notes |
|--------|------|------------|-------|-------|
| Suite / compress jobs | Stripe Checkout | **___** | **___** | pull Dashboard |
| ZRW licenses | Stripe Payment Links | **___** | **___** | |
| x402 agent commerce | chain + Stripe | **___** | **___** | |
| Other | — | **___** | **___** | |

**Rule:** Until row totals are filled from Stripe, **no scaling move**. Ledger incomplete = residue unpaid.

### 1.5 Net (integer plane)

```
FIXED_BURN_MO   = sum(Fly + SaaS + domains)     → Host fill
INCOMING_MO     = sum(Stripe + x402 + other)    → Host fill
DELTA           = INCOMING_MO − FIXED_BURN_MO
dE + dC ≈ 0     when next spend is paid by prior surplus or equal cut
```

---

## 2 · Dual A∥B spend columns (step 2)

| Line | Column A · absolute min | Column B · A with **33% shaved** | Gap = first compression target |
|------|-------------------------|----------------------------------|--------------------------------|
| Chamber (smart-box) always-on | current Fly bill line | sleep / scale-to-zero when idle *or* −33% RAM if safe | **___** |
| Public site (slidphilabs) | current | auto_stop already on | often near floor |
| Mesh | current | keep warm only if daily use | **___** |
| Suspended apps | **$0** | **$0** | keep off |
| xAI usage | current | route TTS browser-first; chat only when teaching | **___** |
| Personal SaaS | list all | cancel if value < egress cost of one free 100 GB showcase | **___** |
| **TOTAL** | **A** | **B = 0.67 × A** | **A − B = compress target** |

Mirror law: cutting 33% on spend without cutting the **proof surface** (`/standings` · `/bench` · freemium edge) is dual cancel; cutting the proof is residue unpaid.

---

## 3 · Time as structured-int (90 days)

| Block | Hours | Role |
|-------|------:|------|
| Work sprint | **66** | Ship residual (code · bench · ledger fills) |
| Rest cycle | **33** | No new planes |
| Review gate | **9** | dE+dC check · standings · Stripe totals |

90 days ≈ cycle of sprints under cadence; nothing leaks outside blocks.

---

## 4–5 · Cash flow (already owned)

| Artifact | URL / pipe | Role |
|----------|------------|------|
| Freemium micro-product | `/pps` + `/api/*` suite | 100 GB free · 5¢/GB |
| Open proof | `/bench` · `/standings` | self-serve before pay |
| Stripe | live restricted key on Fly | human $ |
| x402 | pay addresses + suite x402 routes | agent $ |

**Do not invent a second payments stack.** Surplus only through these pipes.

---

## 6 · Burn compression checklist (Host)

- [ ] List every subscription (password manager export or bank)
- [ ] Tag: keeps proof live / vanity / idle
- [ ] Cancel vanity if marginal value &lt; cost of 1 billable GB at 5¢
- [ ] Suspend Fly apps with no 7-day traffic (except Chamber if daily Host use)

---

## 7 · Scoreboard (public)

| Board | Verifiable claim |
|-------|------------------|
| `/standings` | ZRW 8 B · domain records |
| `/bench` | SPL vs gzip vs brotli live |
| `/pps` | live quote · free 100 GB |

Transparency = marketing flywheel. Do not hide the free edge.

---

## 8–10 · Surplus · 180d · ship gate

- **30% of profit** → next agentic lattice seat (compute + human together).  
- **Day 180:** recompute DELTA; if still negative, tighten cadence **before** headcount.  
- **Ship next public artifact** only if prior artifact covered its own egress (bench/standings/suite already pay in proof + optional $).

---

## Next unpaid residual (Host action)

1. Fill **Host $ / mo** and **Incoming $** from Fly + Stripe dashboards into this table (or a private copy under `~/.env` ledger — not git).  
2. Compute **A / B / gap** for dual spend.  
3. Start first **66h sprint** only after row **DELTA** is numeric.

**Next question for Host:**  
What is **FIXED_BURN_MO** and **INCOMING_MO** from last 30 days of Stripe + Fly — exact cents?
