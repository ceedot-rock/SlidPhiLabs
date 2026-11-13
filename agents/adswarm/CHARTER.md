# AdSwarm Charter — autonomous advertising, human-gated publishing

Swarm of small agents that markets lab products on their own: research,
draft, criticize, schedule, measure. Publishing is the one act that always
needs a human approval receipt first.

## The five seats

| Seat | Job | May do alone |
|---|---|---|
| scout | gather facts, prices, links, proof | read, file drafts |
| drafter | write one piece per brief | write drafts |
| critic | check claims, tone, limits | flag, never edit |
| scheduler | queue approved pieces per cadence | schedule approved only |
| publisher | hand pieces to channel adapters | publish approved only |

Corrections go in a new file that cites the old one. Nobody edits another
seat's draft in place; the critic flags, the drafter revises.

## Iron gates (a publish that breaks these is a bug)

1. **Approval receipt first.** `publish` refuses any draft without
   `approvals/<id>.json` signed by a human name. Tests prove it.
2. **Organic only.** No ad spend, no paid boosts. Spend needs Corey's
   per-item go, so the swarm cannot spend by construction: adapters have
   no spend path.
3. **No invented identity.** Pieces sign as the lab or a named seat.
   No fake reviewers, no sockpuppets, no astroturf.
4. **Claims must clear.** Every campaign file lists verifiable claims.
   The critic rejects anything outside the list plus hype words
   (best, guaranteed, #1, world-first).
5. **Receipts on everything.** Every action appends to `ledger.jsonl`:
   actor, action, subject, timestamp. Auditability first.
6. **No secrets in the repo.** Channel credentials ride environment
   variables at publish time only. The repo holds shapes, never keys.

## Warrants

`warrants/<campaign>.json` names what the swarm may do for that campaign:
draft, schedule, and publish-with-approval. Anything else (new channel,
paid tier, new product claims) needs a fresh warrant. The publisher
enforces the warrant before the approval check.

## Channels

Adapters implement one interface: `publish(draft) -> receipt`. Default is
dry-run: the piece lands in `outbox/` and the receipt says so. Live
adapters (dev.to, Hashnode, X, Reddit, lab blog) activate only with
credentials present AND a human approval. Missing creds is a normal state,
never an error: the swarm drafts and queues regardless.

## First campaign

TeachAid: commercial-complete, live, priced, zero pipeline. Claims drawn
from its pricing doc and eval runs, nothing else.
