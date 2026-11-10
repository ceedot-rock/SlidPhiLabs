# Uptime drill (LAB50 step 10)

Hourly GitHub sweep: `.github/workflows/uptime.yml` probes `/api/health`
and `/api/ops?action=health`, filing an `incident` issue on failure.

Sub-five-minute alerting needs the external leg (a */5 Actions schedule
would burn ~8,600 minutes a month, past the free quota):

1. Add a free external monitor (e.g. UptimeRobot free tier) on
   `https://www.slidphilabs.com/api/health`, 5-minute interval, alerting
   to the named inbox.
2. Optional email from Actions: add `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`
   repository secrets, then extend the failure step to send via
   `swaks`/`curl --url smtps://...`. Secrets are operator-side.

Drill (closes the step): deploy a probe target that answers 500, confirm
the issue files and the external alert lands inside five minutes, then
revert and link the run + issue + alert mail here.
