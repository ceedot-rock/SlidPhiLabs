# CONNECTIONS — every external connection, live or missing

Standing order (operator, 2026-10-28): whenever this seat finds it lacks a
connection, it makes it. Where making it needs human identity, money, or
email receipt, the seat builds everything short of that line and records the
exact unblock + owner. No fabricated identities, no spend without approval.

Credential locations are named, never pasted. Live = verified this session.

## LIVE

| Connection | Via | Status | Ref |
|---|---|---|---|
| Tavily API | vaulted key, owner-only | LIVE, search+extract verified | ~/.slidphi/tavily.key |
| AgentRider seat | muse-code-dm-10281520 / e0eadbff05adda98, L1 | LIVE, 20 credits, 15-min re-mint loop | ~/.slidphi/rider-seat-*.key |
| Rider DMs | X-Agent-Rider JWT | LIVE, 4 threads open | threads: slidcli1, muse1, cli-work, lab-mind |
| Pedia refresh | cron a38f8b62, q48h | LIVE, 7-day expiry | re-auth on expiry |
| JWT upkeep | cron 279a1715, q15m | LIVE, 7-day expiry | re-auth on expiry |

## MISSING (with exact unblock)

| Connection | Blocker | Unblock (owner: operator) |
|---|---|---|
| FOIA direct filing | requester identity (name/contact/fee assent) | hand me the requester block; I attempt portal POSTs same hour |
| MuckRock filing | account + API key | create account, hand API key; I file R1-R6 via API |
| PACER dockets | registered account + payment | create account; per-page fees accrue to you |
| Dev.to publisher key | dev.to account (free) | create account, hand API key; bot posts same day |
| Hashnode publisher token | hashnode account (free) | create account, hand PAT; bot posts same day |
| X publisher | paid API tier + dev account | subscribe Basic+, hand keys; bot posts same day |
| Reddit publisher | account + app credentials | create app, hand ID/secret; obey sub rules or bans follow |

## Rule of the road

Self-provisioning stops at: invented identity, another party's money,
another party's inbox (email verification), and secrets crossing chat.
Everything short of those lines gets built, not requested.
