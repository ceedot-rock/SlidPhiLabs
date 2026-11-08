# LAB50 — 50 steps to make the lab viable

**Started:** 2026-11-08

**Source audit:** [lab-gaps-100.md](lab-gaps-100.md) (ranked 2026-11-05)

**Rule:** a step is done only when its "Done when" check passes on `main` and is linked here. Re-verify an audit row before acting; several rows are already stale (for example, the x402 dev bypass is now env-gated and the usage meter is already HMAC-bound).

## What "viable" means here

One customer can find one product, pay, receive a receipt, get the bytes, and repeat. A failure is detected before the customer reports it. The lab can explain what it sells, what it refuses, and where the money went. Everything else is a side project.

The order matters: trust and money first, then reliability, then surface cleanup. Do not start a new product while steps 1–20 are open.

## Phase 0 — Prove the base (done 2026-11-08)

1. **[x] Make the root test command work.** `node --test test/` did not run the pccz suite on current Node.
   **Done when:** `npm test` runs `test/pccz.test.mjs` and exits 0.
   **Evidence:** `package.json`; 5/5 tests pass.

2. **[x] Put the site/API suites in CI.** 92 test files under `docs/site` were never run by the workflow, and `docs/**` was ignored on push.
   **Done when:** `npm run test:site` runs in CI and a site-only change triggers the workflow.
   **Evidence:** `.github/workflows/test.yml`, `.github/workflows/audited-checks.yml`; 689/689 tests pass.

3. **[x] Close the lab-agent deposit path traversal.** `deposit_get()` joined an unvalidated request value onto the deposit directory and could read files outside it.
   **Done when:** only 64-character SHA-256 hex names resolve (case-insensitive, normalized to lowercase), symlinks cannot escape the base directory, and regression tests cover both.
   **Evidence:** `lab-agent/server.py`; `tests/test_lab20.py` (`test_refuse_non_hash_path`, `test_refuse_symlink_escape`).

4. **[x] Refuse malformed and oversized lab-agent payloads.** Invalid base64 became a 500, and the request body had no size cap.
   **Done when:** invalid base64 is 400, oversized bodies are 413, and negative or non-numeric `Content-Length` is 400.
   **Evidence:** `server.py` (`decode_b64`, `read_json`); `tests/test_lab20.py`.

5. **[x] Use one `source_hash` contract.** `check` and `squeeze` used SHA-256, but `translate` used a 64-bit FNV hash, so its receipt could not be deposited or replicated.
   **Done when:** every verb returns SHA-256 over the raw input and a test proves it.
   **Evidence:** `server.py` (`do_translate`); `test_translate_hash_matches_deposit_hash`.

6. **[x] Separate liveness from readiness.** The store reported `ok: true` even when a verb binary was missing.
   **Done when:** `GET /healthz` is liveness, `GET /readyz` is 200 only when `cuni` and `pccx` exist, the container has a healthcheck, and Fly checks readiness.
   **Evidence:** `server.py`, `Dockerfile`, `fly.toml`, `tests/test_lab20.py`.

## Phase 1 — Make the audit trustworthy (next)

7. **[ ] Re-verify all 100 audit rows.** Mark each row `open`, `closed`, or `stale` with a file, test, or URL. Do not fix a row that is already closed; do not trust a row without evidence.
   **Done when:** every row in `lab-gaps-100.md` has a status and every `stale` row is closed with a note.

8. **[ ] Make one health surface authoritative.** `/api/health` currently returns 200 even when a check says `ok: false` (audit #50). Pick the route, define the JSON contract, and make every page and monitor read it.
   **Done when:** a forced dependency failure returns 503 and the status page shows the same state.

9. **[ ] Put a timestamp on every public claim.** `status.html` and `STATUS.md` can say "operational" while a surface is down (audit #68).
   **Done when:** the page shows `checked_at` and the source URL for each row, with no hand-edited green badge.

10. **[ ] Add one external uptime check.** Use a free monitor or a scheduled GitHub Action against `/api/health` and one paid verb.
    **Done when:** a deliberate 500 or timeout produces an alert to a named inbox within five minutes.

11. **[ ] Rotate every secret that has appeared in a session, chat, or vault file.** Inventory first, then rotate, then record the rotation date without recording the value.
    **Done when:** old keys are revoked, new keys are only in Fly secrets or a password manager, and the inventory has no blank rotation date.

12. **[ ] Archive the `host-*` dumps and other non-products.** They are private session dumps, not products (see `STATUS.md`).
    **Done when:** GitHub shows them archived, the site does not link them, and `STATUS.md` says where the archive record lives.

## Phase 2 — Legal and money

13. **[ ] Publish Terms, Privacy, DPA, and refund pages.** Only `/refund-policy` exists today (audit #1).
    **Done when:** all four pages are live, linked from the footer and every checkout, and the refund page matches the code path.

14. **[ ] Get the standing waiver reviewed and signed.** The audit flags `ATTORNEY_REVIEW_PENDING` (audit #2).
    **Done when:** a dated sign-off is filed and the code no longer carries a pending marker.

15. **[ ] Execute the IP assignment packets.** LLC→Inc and founder-direct assignments are still unsigned (audit #3).
    **Done when:** signed packets are in the legal folder and the cap table names the company as owner.

16. **[ ] Confirm the 83(b) filings before the December 4, 2026 deadline.** (audit #4).
    **Done when:** filing receipts for each founder are on file and the deadline is on the shared calendar.

17. **[ ] Decide the patent posture, then file or abandon.** All provisionals are drafts and foreign rights may already be lost on the disclosed matter (audit #5).
    **Done when:** counsel has a written decision and each matter has either a filing receipt or an abandonment note.

18. **[ ] Map every listed SKU to a Stripe Price ID.** The catalog uses `/pay?sku=` links with no Price-ID map (audit #9).
    **Done when:** a script compares `PRODUCT_CATALOG` to Stripe and exits non-zero on a missing or mismatched price.

19. **[ ] Make the sales ledger fail closed.** A ledger read error currently looks like "not recorded" and can double-record a sale; ignored webhook events leave no trace (audit #14–15).
    **Done when:** a read error returns 5xx without writing, duplicate delivery is a no-op, and ignored events append an audit line.

20. **[ ] Build and test the refund/chargeback path.** x402 refunds exist in policy; Stripe card refunds and disputes do not (audit #10).
    **Done when:** a test-mode refund and a test-mode dispute each produce a receipt and a ledger entry.

## Phase 3 — Security

21. **[ ] Authenticate every mutating playground/studio endpoint.** Publish, register, notelog, and agent POSTs are world-writable (audit #26).
    **Done when:** an unauthenticated request gets 401/403, and the happy path has a test.

22. **[ ] Replace wildcard CORS on paid routes.** `Access-Control-Allow-Origin: *` on JSON/paid compute is too broad (audit #27).
    **Done when:** only the site origins and explicit agent clients are allowed, with a test for a rejected origin.

23. **[ ] Fix the Depot stored-XSS path.** A depot name reaches an `onclick` handler (audit #29).
    **Done when:** a name containing quotes or a script tag is escaped or rejected and a test covers it.

24. **[ ] Expire and revoke invites; count seats per team.** Invites currently never expire, never run out, and `seat_taken` is global (audit #31–32).
    **Done when:** invite TTL, single-use default, revoke/rotate routes, and cross-team seat tests exist.

25. **[ ] Rate-limit paid and expensive endpoints.** There is no limit on the single-threaded Depot server (audit #41).
    **Done when:** a burst test gets 429 with `Retry-After`, and the health route stays available.

26. **[ ] Make dev bypass impossible in production.** The bypass is env-gated now, but a misconfigured prod can still turn it on (audit #12).
    **Done when:** boot fails when `NODE_ENV=production` and the bypass flag is set, with a test.

27. **[ ] Stop leaking exception text.** Generic 500s still expose `e.message` (audit #92).
    **Done when:** responses carry a request id and a generic message; the detail is only in server logs.

28. **[ ] Extend the secret scan.** The scan misses `.js`, `.html`, `.toml`, `.sh`, and `.env` (audit #35).
    **Done when:** CI catches a planted fake token in each of those file types.

29. **[ ] Add a dependency and license audit.** The sampled inventory includes repos with no license (audit #24).
    **Done when:** `npm audit --omit=dev` is clean or triaged, and every public repo has a machine-readable license.

30. **[ ] Write the incident response card.** Who to call, how to revoke a key, how to stop billing, how to restore data.
    **Done when:** a one-page card is linked from `SECURITY.md` and tested in a tabletop drill.

## Phase 4 — Reliability and operations

31. **[ ] Run more than one machine for the paid surface.** Single Fly machine plus one 1 GB volume has no standby (audit #47).
    **Done when:** a machine kill does not drop a paid request, or the runbook states the accepted downtime.

32. **[ ] Keep an off-Fly backup and restore it.** Snapshots exist; an off-Fly copy and a restore drill do not (audit #54).
    **Done when:** a restore into a clean volume reproduces a known SHA-256.

33. **[ ] Wire the quota module to the documented 429.** The caps in docs do not exist in code (audit #51).
    **Done when:** over-quota requests get 429 and the meter records the refusal.

34. **[ ] Add a post-deploy smoke gate.** A broken deploy can go live silently (audit #52).
    **Done when:** the deploy job fails on a bad health, catalog, or paid-verb probe.

35. **[ ] Fix the DNS/certificate split.** `www` and `fly.dev` drift; Fly certs were not verified (audit #46).
    **Done when:** one canonical host, a valid certificate, and a redirect test are in CI.

36. **[ ] Rotate logs.** `log.jsonl` and session logs grow without bound (audit #59–60).
    **Done when:** size and age limits run on a schedule and a sample old file is gone.

37. **[ ] Move Depot data to a volume.** Depot data sits on ephemeral disk (audit #55).
    **Done when:** restarting the Depot preserves a written object and a test proves it.

38. **[ ] Expose the network health endpoint and feed the status page.** There is no status/health endpoint for the network itself (audit #61).
    **Done when:** the page reads the endpoint, not a hand-edited table.

## Phase 5 — Honest public surfaces

39. **[ ] Make `pricing.json` the only price source.** Generate or verify the HTML, docs, OpenAPI, package metadata, and discovery files from it.
    **Done when:** a sweep test finds zero price mismatches.

40. **[ ] Close the remaining price/meter drift.** Audit #63–65 found stale docs, OpenAPI, and home copy; a 2026-11-08 spot-check shows `docs.html` and `openapi.yaml` already at 1 GB / 25¢, so re-verify each surface before editing.
    **Done when:** every public price page is generated from or tested against `pricing.json`.

41. **[ ] Re-verify the `spl-pay-per-suite` copy.** Audit #73 claims the README and quote still say 2 GB/month and 8¢; the current README and `quote.mjs` already say 1 GB lifetime and 25¢. Close the row if the sweep is green.
    **Done when:** one test reads the published claim and compares it to `suite-pricing`.

42. **[ ] Make the MCP catalog generated, not hand-counted.** Audit #74 claims 8 tools in `server.json` and 13 in code; current files disagree in the other direction (45 tools in the registry card). Compare `tools/list` to every published card and make one source.
    **Done when:** the published tool list is generated from the live server and the count test passes.

43. **[ ] Add JSON-LD and OG tags to the remaining pages.** About 50 pages have no JSON-LD and 7 cuni pages have no OG image (audit #72).
    **Done when:** the crawler reports zero missing tags on the sitemap set.

44. **[ ] Fix internal links and the sitemap.** `/stand`, `/the-word`, and the `/invest` spec link are broken; the sitemap misses about 11 pages (audit #70–71).
    **Done when:** a link checker and a sitemap diff both pass.

45. **[ ] Regenerate the verse registry and pedia counts.** The registry claims 7 public verses; the pedia index is about 9x stale (audit #81–82).
    **Done when:** both are generated from the repo map and a count test passes.

## Phase 6 — Product focus and code health

46. **[ ] Pick one lead product for the next quarter.** PCC is the customer face; the other surfaces are proof or parked.
    **Done when:** the homepage has one primary CTA and every other product has an explicit `lead`, `proof`, `parked`, or `retired` label.

47. **[ ] Add tests for the untested API handlers.** About 40 handlers (agent, checkout, payments, webhook, x402, bench, mcp) have no tests (audit #83).
    **Done when:** every handler has at least one success and one refusal test, or is deleted.

48. **[ ] Fix the known code-health bugs and keep the tests.** `lbDecode` has no catch, pulsar throws raw exec errors, bad JSON becomes `{}`, and empty `catch {}` hides header failures (audit #86–92).
    **Done when:** each fix has a regression test and the site/API suite stays green.

49. **[ ] Re-verify release coverage, then tag or publish what is actually missing.** Audit #76–79 flags missing verse releases, `phi-rest`, `spl-model-pay`, and trugame; check each repo before acting.
    **Done when:** each shipped surface has a tag, a package or a README saying `not shipped`, and a release note.

50. **[ ] Make the quarterly viability review a habit.** Review revenue, uptime, open security items, and this list every quarter.
    **Done when:** the first review is dated, the next date is on the calendar, and every open step has an owner.

## This week

Do steps 7–10 and 18–19. They turn the audit into a live list, make health and money observable, and close the two revenue-integrity holes that are cheapest to fix. Do not start step 46 until those checks are green.
