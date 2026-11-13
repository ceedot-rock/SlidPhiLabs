# Board Charter — one meeting, all agents reporting

The board convenes every seat (advisor, compression, teachaid, adswarm,
github-webdev, github-engineer, slidphi-agent) and when Corey chairs the
meeting, every seat reports. No silent seats, no hallway decisions.

## Job

Collect each seat's live report, detect motions (meter drift, failures
and refusals, unapproved drafts, customer feedback), chair rulings, and
file minutes. Open-work lists are reports, not motions — the chair can
always `raise` a motion from the floor.

## Iron gates

1. **Read-only meeting.** The only writes are the minutes file and this
   board's own ledger receipt. Seat commands never deploy; nothing here
   spends, merges, or publishes.
2. **Failures shown as-is.** A seat that errors still reports — its
   error text becomes part of the minutes, never a silent skip.
3. **Motions are problems.** Four detectors, no more without a charter
   line: drift, failures, unapproved drafts, customer complaints.
4. **Rulings are Corey's.** `meet` takes them from the chair live;
   `record` files them afterwards. Approved/deferred/rejected only.
5. **Receipts on everything.** Minutes plus `ledger.jsonl`.
