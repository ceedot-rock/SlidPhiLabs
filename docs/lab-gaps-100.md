# Lab gaps 100 — ranked audit 2026-11-05 (revenue/security first)

Action plan: [LAB50.md](LAB50.md). Re-verify a row against current code before acting; several rows are already stale.

## Money + legal risk (1–25)

1. No terms.html/privacy.html/ToS/DPA on site — paid flows run without legal cover.
2. Standing waiver v1 unreviewed by attorney (ATTORNEY_REVIEW_PENDING in waiver-text.mjs).
3. IP packets UNSIGNED (LLC→Inc + founder-direct); title still personal.
4. 83(b)s unconfirmed (Corey Atlas filing, Robert signature+mailing); deadline Dec 4, 2026.
5. All provisionals DRAFT unfiled; foreign rights lost on disclosed matter.
6. LLC wind-down undecided; no dissolution docs; old Stripe/bank still live?
7. Past-due AWS account 313696198749 (card ending 0902 failed Nov 1).
8. Lab ledger Incoming=$0 — no Stripe revenue evidence on file.
9. Catalog uses /pay?sku= URLs, no Stripe Price-ID mapping on file.
10. No Stripe card refund/dispute/chargeback path (only x402 24h refunds).
11. Payouts are unsigned intents — nothing executes transfers.
12. x402 dev-bypass tx always accepted, no env gate (replay protection bypassable).
13. Meter identity keyed on raw x-forwarded-for — spoofable; anon shares one bucket.
14. Webhook dedupe breaks on ledger I/O error (sale re-recorded).
15. Ignored/no_order_id webhook events acked with no ledger entry (blind spot).
16. claim secret falls back to STRIPE_SECRET_KEY cross-purpose reuse.
17. HMAC claim secret missing fails per-call — every caller handles claim_secret_missing.
18. Depot has zero pricing/billing code (quota counters only); 100MB default vs 100GB advertised.
19. Depot metadata-only publish is quota-exempt and unverified.
20. Depot publish overwrites in place — orphaned blobs leak disk, quota-blind.
21. Solana verify stubbed fail-closed (keystore password-locked).
22. Varo ACH allowlist unfinished; Gmail SMTP delivery failed earlier.
23. Price conflicts unresolved on file (PCC $369 vs $390; suite sizes).
24. sampled license inventory lists repos with NONE license (gitdepot-hub, PCCVerse, others).
25. sampled patent triage: Apache-2.0 Sec.3 grants already out on disclosed matter.

## Security + integrity (26–45)

26. Playground/studio API world-writable: publish/register/notelog/agent POSTs, no key.
27. CORS * on JSON API incl. paid-compute POSTs.
28. Depot Bearer keys over plain HTTP (no TLS).
29. Depot stored XSS: depot name into onclick evictDepot.
30. Depot audit UI 404s (no log-read API route).
31. Depot invites never expire, unlimited uses; no revoke/remove/rotate routes.
32. Join seat_taken is global not per-team (cross-team seat squatting).
33. Bootstrap deadlocked: invites need auth, all keys ISSUE-AT-DEPLOY.
34. Modal token + lab password plaintext in .modal.toml / .slidphi/vault.env.
35. CI secret-scan misses js/html/toml/sh/.env; tokens in workflows, no rotation record.
36. Conductor /api/demo/push unauthenticated, mutates real branches.
37. approve() merges any status incl. open/no-review; review block advisory only.
38. AGENTS.md fetched then voided — never passed to workspace.
39. forkForTask hardcodes demo-token + memory:// remote.
40. robots.txt allows /api/ — crawlers invited onto compute endpoints.
41. No rate limiting on Depot single-threaded HTTPServer; no security/CORS headers.
42. Failed builds consume minutes; no rollover (cost integrity).
43. Conductor review LLM layer dead without AI binding (llmSummary null).
44. cuni emit honest-501 without URL; only the 501 asserted in tests.
45. ArtifactsStore all methods throw (listRepos/createRepo/listFiles/writeFiles/diff/merge/branches).

## Availability + ops (46–62)

46. www vs fly.dev DNS split; Fly certs Not verified; custom TLS incomplete.
47. Fly single machine + single 1GB volume, no standby (Studio + site).
48. auto_stop=off/min=1 contradicts scale-to-zero cost docs (24/7 burn).
49. No [http_service.checks]; live CHECKS columns empty.
50. /api/health returns 200 even when ok:false.
51. Quota module never wired — 429 caps in docs don't exist; 45s check open to world.
52. No post-deploy smoke curl; broken deploys go live silently.
53. No monitoring (Sentry/Prometheus/uptime); logs print-to-stdout, short retention.
54. No restore runbook; snapshots exist but no off-Fly copy.
55. Depot data/ on ephemeral disk (no volume mount) — restarts wipe everything.
56. Depot Dockerfile boots unauthenticatable (placeholder members, no VOLUME/HEALTHCHECK).
57. Depot EC2 runbook: region-locked, manual SSM push, open SG, no TLS/backups/rotation.
58. Depot tests 401 against v2 server; quota test gets 413 not 403; order-flaky; no CI.
59. Unbounded log.jsonl, no rotation.
60. Session logs 1.47GB, top 126MB — no rotation/prune.
61. No status/health endpoint for the network itself.
62. Fly billing alerts / spend-limit state unknown (dashboard-only).

## Stale + broken surfaces (63–82)

63. docs.html stale meter (2GB/8¢/$37) vs pricing.json ($0.25/1GB/$25).
64. openapi.yaml same stale meter.
65. HOME-COPY.md stale PCC/Rider/Chamber prices.
66. pricing.html TNSSRC $490 vs pricing.json 369.
67. license.html foreign Cloudinary $99 line.
68. status.html badge Operational vs 5/6 days down, ~6wk stale.
69. STATUS.md + llms.txt freshness lag vs pricing.json.
70. Broken internal links: /stand, /the-word; dead /invest spec link.
71. Sitemap missing ~11 indexable pages; docs page detached from openapi.yaml.
72. ~50 pages no JSON-LD; 7 cuni pages no-og.
73. spl-pay-per-suite: 2GB/month + 8¢ in README/quote.mjs vs 1GB-lifetime + 25¢ manifest.
74. MCP server.json lists 8 tools, code has 13.
75. Scoped 1.2.5 vs unscoped 1.2.3 skew; root 2.3.1 vs tags v2.5.0; shim 1.20.2 untracked.
76. 4/7 verses zero releases; SlidPhiLabs Pages 404; MemoryVerse/profile Pages 404.
77. phi-rest never published, no README/LICENSE.
78. spl-model-pay dangling files manifest, no CHANGELOG/NOTICE.
79. trugame unpackaged (6x .py, no manifest).
80. MCP surfaces (json-chamber, agent-rider) without counterpart packages.
81. verse-registry claimed 7 PUBLIC vs gh descriptions saying (private) — removed, VERSES map is truth.
82. pedia index ~9x stale (111 bullets vs 36 claimed).

## Tests + code health (83–93)

83. ~40 API handlers with zero tests (agent, checkout, payments, webhook, x402, bench, mcp...).
84. 14 lib modules without test files (incl. usage-meter, engines, lab-auth).
85. ofa-sim asserts only, no negatives, no runner.
86. engines lbDecode has no catch (encode/aware do) — unhandled 500s.
87. pulsar decode zero error mapping — all exec failures throw.
88. Bad JSON body silently {} — corrupt vs empty indistinguishable.
89. Empty catch{} on setHeader hides failures.
90. ppp-checkout import failure swallowed, silent legacy fallthrough.
91. Warrant receipt JSON parse failure coerced to {} then filed.
92. Generic 500 leaks e.message, no request-id correlation.
93. sios-cell stub returns null "on purpose"; ofa-sim is an external shim with no bit-exact CI.

## Data + deadlines (94–100)

94. Kaggle ARC paper track: 0/5 training, checklist pending; deadline 2026-11-09.
95. Gemma paper: draft-only writeup; deadline 2026-11-12.
96. Traffic-flow bench: 8GB zip + 411MB dup + ~30 state CSVs; no standings file.
97. Name-that-LLM + quantum-circuit comps: no submission/standings artifacts.
98. ~90 scratch scripts in .slidphi unversioned; no Modal/Kaggle/pedia RUNBOOK.
99. data/ untracked + duplicated under C:/Users/ptasz/data (secret.txt!).
100. Home-root reports/inventories not in repo/docs; home-root w-mint files unfiled.
