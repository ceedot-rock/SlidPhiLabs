# PSI Meter + Org — LLM prompt pack (beta)

Spend log for agents: usage-line meter + 23-rule token economy + quarterly
audits. Free: 1 seat, 10,000 calls/month, 7-day retention, first audit free.
Meter $25/month ($250/year, 250k calls/month included, $2 per 100k over,
sku `psi-meter`); Org $79/month (sku `psi-org`). Shipped-code embedding
needs the $490/product/year grant (sku `psi-embed-grant`).
Meter: https://www.slidphilabs.com/products
Buy: https://www.slidphilabs.com/pay?sku=psi-meter

Local metering works today with no account:

```bash
python psi/scripts/usage-line.py --log
```

Rules: log every session's line at session end; profiled cost uses live
provider rates with the measured 124:1 in/out ratio and 94% cache share
assumed only when your run matches those conditions — otherwise measure.
Status beta: local meter verified, served org API not yet verified by us.
