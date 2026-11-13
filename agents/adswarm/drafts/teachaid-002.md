---
id: teachaid-002
channel: dev.to
claim_refs: [1, 2, 5]
status: approved
---
# Grade gates belong in code, not in the prompt

I work on TEACHAiD, a study app where an AI teacher works through textbooks
with you. One design decision carried the whole product: the teacher cannot
pass you. Only the app's own gates can.

The model writes a grade trailer after readiness chats — score, what you
grasp, what needs review. Then server code enforces the line: below 70, or
more than two review items, and `pass` is forced false no matter what the
model claimed. Certificates need 91+ on the final chapter. The client cannot
self-award anything; it only displays what the server decided.

This came from a simple observation: prompts negotiate, code doesn't. Every
time we found the model being generous, we moved the rule one layer down
into something testable. The suite now covers the gates the same way it
covers billing: unbalanced journals rejected, accrue-then-settle clearing,
70/30 splits landing where the pricing doc says.

Progress stays on your device unless you export it. The free tier carries
the full built-in library — 43 books across all 10 required GE buckets, per
the repo's own audit script. Pro ($9/mo) is voices and surfaces, not grades.
Grades are never for sale at any tier.

If you're building AI that judges human work, put the judgment where the
tests are.
