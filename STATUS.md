# Lab status — 2026-09-11

Canonical public sentence lives in README.md. If a page disagrees, the page is wrong.

## Surfaces

| Role | Where | Notes |
|------|-------|-------|
| Brand domain | www.slidphilabs.com | Served from Fly app `slidphilabs`. Custom domain. |
| Fly host | slidphilabs.fly.dev | Live prod for site |
| Rider | agentrider.fly.dev | Live. Fly-only — `agentrider.vercel.app` is 402-dead |
| CuNi Studio | cuni-studio.fly.dev | Live |
| Combined GC measurements | github.com/ceedot-rock/combined-gc-view | Public |
| Combined GC engine | github.com/ceedot-rock/combined-gc | Private |
| Storefront | slidphi-storefront | Measurements + pay |

**Vercel:** account/projects 402-locked. Treat all `*.vercel.app` lab hosts as dead. Do not send traffic there. Prefer Fly secrets / private GH Actions for secrets — never public git or chat.

## Identities

- GitHub user: `ceedot-rock` (Corey Tasz).
- Do not treat `nektaronbase-cell` sports-sims apps as lab products.

## host-* dumps

Private session dumps created 2026-08-29. **Not products.** Archive them in GitHub settings. Do not link them from the site.

## Owner clicks still open

1. Create GitHub org `slid-phi-labs` and pin Combined GC view, this site repo, Agent-Rider, Chamber.
2. Archive every `host-*` dump.
3. Tag combined-gc-view `v1.19.2` in the GitHub UI if API tag is missing.

## Kickoff face kit (2026-09-11)

- **Customer face:** PCC (hosted lossless compression). Chrome / compress / products lead with PCC.
- **Guts:** LBR1 / `lb aware` strong path behind `/api/compress` (unchanged bake-off preference).
- **AWARE:** legacy alias / seat synonym only — not the main name.
- **Crowns:** unchanged. Do not invent crowns. Do not sell Gale. Quiet doors 8/9 stay deep shelf.
- **Silesia:** PCC board **51,498,645** (12/12) stays; honesty vs xz unchanged.
- Ship: merge/deploy https://github.com/ceedot-rock/SlidPhiLabs/pull/12 ; refresh `docs/site/bin/lb` from ceedot-rock/lbr1 if peels need seating.

