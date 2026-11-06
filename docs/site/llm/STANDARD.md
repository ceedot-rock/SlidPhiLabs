# Lab LLM-Callability Standard v1

Every lab product must be callable by any LLM agent through a prompt alone.
No SDK install required unless the pack says so. Rule: if an LLM with
network access cannot invoke the product from its pack, the product is not
done.

## Per product: two artifacts

1. `docs/site/llm/packs/<product>.md` — copy-paste prompt block plus curl
   examples. Placeholders in `{BRACES}`. Must include: what it does, call
   path (URL, CLI, or SDK command), auth (exact header/token/pattern),
   cost (exact sku + usd from `pricing.json`), limits, and error meanings.
2. One row in `docs/site/llm/registry.json`:
   `{ product, pack, actions[], via, auth, sku, status }`.

## Statuses (honest only)

- `live` — pack's call path verified end-to-end by us.
- `beta` — call path exists, not yet verified by us.
- `stub` — no runnable call path exists yet. Pack says so in one line and
  names what is missing. Never invent an endpoint to avoid `stub`.

## Model neutrality

Packs are plain HTTP/CLI. They work from any model and any agent runtime.
No product may require a specific model provider to be callable.

## Registry consumers

`docs/site/llms.txt` links the registry. `agents.json` may mirror it.
