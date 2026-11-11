# Autopilot Charter — autonomy inside bounds

The sweep acts on its own so the lab stays correct while Corey sleeps.
It may do three things alone: look (detect), fix sure meter drift
(autofix), and ask (propose). Everything else belongs to the board.

## What runs itself

1. **Detect.** All 7 board reports + motions, read-only, on schedule.
2. **Autofix — PCC meter numerics only.** When `package.json` and
   `README.md` agree and `docs/site/pricing.json` differs, patch the
   pricing.json meter numbers to the agreed pair, with a `.bak` backup
   and a ledger receipt. Prose is never rewritten by machine. Any other
   split — all
   three disagree, README unreadable, anything ambiguous — becomes a
   proposal, never an edit.
3. **Propose.** Every remaining motion becomes a file in `proposals/`
   for the next `/board` meeting.

## What never runs itself

Merge, deploy, publish, spend, new files outside this folder (except
the pinned pricing.json fix and the `.bak`), any repo but SlidPhiLabs,
any price but the PCC meter. There is no spend command: purchases and
paid tiers always stop and ask per-item.

## Iron gates

1. **2-of-3 or nothing.** No consensus, no edit. Ever.
2. **Backup before write.** Every autofix leaves `pricing.json.bak`.
3. **Receipts on everything.** `ledger.jsonl` per sweep, fix, proposal.
4. **Findings on disk.** Every sweep writes `findings/<ts>.json` so a
   human can audit what the night shift did.
