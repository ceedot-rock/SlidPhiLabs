# Slidphiclepedia — standing Tavily ingest

Standing rule (operator-set, 2026-10-28): everything ever pulled out of the
Tavily API lands here. No pull evaporates in chat.

## Layout

- `pulls.jsonl` — one JSON record per retrieved result. Append-only.
- `index.md` — human-browsable grouped index of pulls.
- `README.md` — this file: the rule and the record schema.

## Record schema

```json
{"d":"2026-10-28","q":"query text","title":"...","url":"...","snippet":"...","note":"..."}
```

- `d`: pull date (UTC).
- `q`: exact Tavily query that surfaced it.
- `title`, `url`: as returned.
- `snippet`: short fair-use excerpt (≤280 chars), never full article text.
- `note`: one-line lab-relevance note added at ingest.

## Ingest rules

1. Every Tavily search/extract/crawl in any session appends its results here
   before anything else is built on them.
2. Snippets stay short. Full third-party text is never vendored.
3. Probe/empty pulls (e.g. connectivity checks) are logged with
   `"note":"probe"` or skipped with the skip recorded in the session, never
   silently dropped.
4. This store is append-only. Corrections supersede by new records; old lines
   are never edited.
