# Quikgater — LLM prompt pack (beta)

Metered fetch gateway. $0.02/fetch (sku `quikgater`); first 100
fetches/month free; customer-set monthly cap (default $10), alert at 80%.

```bash
curl -s "https://quikgater-worker.ceedotrock.workers.dev/?url={URL_ENCODED_TARGET}"
```

Rules: URL-encode the target, expect x402 payment-required responses once
past the free quota (pay, then retry — same pattern as the [acp pack](acp.md)),
respect the cap: a cap refusal is a stop, not an error to route around.
Status beta: worker endpoint confirmed alive, paid fetch not yet verified
end-to-end by us. Page: https://www.slidphilabs.com/quikgater
