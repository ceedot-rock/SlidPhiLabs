# GitDepot — LLM prompt pack (beta)

Invite-only git hosting with receipted operations. $15/seat/month
(sku `gitdepot-seat`), $150/seat/year (sku `gitdepot-seat-year`); 100 GB
pooled storage included, then $0.10/GB/month. Free: 1 team, 3 seats,
10 GB, 30-day audit retention. Invite: mailto:corey@slidphilabs.com.
Page: https://gitdepot.slidphilabs.com/

Call path is the depot receipt route (`GET|POST /api/depot`), dispatched
by `action`, JSON envelope `{ok:true,...}` / `{ok:false,...}`, fail-closed:

```
GET  verify | price | repo-get | repos-list | pr-get | prs-list | blame
POST issue | verify | repo-create | branch-create | commit-record
     | pr-open | pr-review | pr-merge
```

Rules: reads before writes (price, then act); a `null` issue result is a
400 — fix the input, don't retry identical. Every mutation keeps its
receipt. Status beta: route verified in code, served instance invite-only.
