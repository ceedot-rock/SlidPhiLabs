# PCC — LLM prompt pack (live)

Hosted lossless compression over the lab MCP server. Round-trip verified
2026-11-06 (compress → decompress → byte-identical).

```bash
ENDPOINT=https://www.slidphilabs.com/api/mcp
# quote first (free): bytes, product, op
curl -s -X POST "$ENDPOINT" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"spl_quote","arguments":{"bytes":1861035,"product":"auto","op":"compress"}}}'
# compress: base64 in, packed_b64 out (inside result.content[0].text JSON)
# decompress: packed_b64 in, data_b64 out
```

Tools: `spl_compress {data_b64}`, `spl_decompress {packed_b64}`,
`spl_zip {files:[{path,data_b64}]}`, `spl_unzip {packed_b64}`,
`spl_quote {bytes,product,op}` with product auto|zrw|blackjack|shard-zip|
shard-tsdb|slid-phi. Via SDK: `spl-acn call spl_compress '{"data_b64":"..."}'`
or plain English: `spl-acn ask "call spl_compress with data_b64=..."`.

Cost: first 1 GB free once per IP, then $0.25/GB (sku `pcc-meter`,
default $25 cap, alert 80%). Pro $25/month or $250/year, 100 GB included,
$0.20/GB over. Card charges start at $1. Paid calls answer
`payment_required` with `accepts` — pay, retry unchanged.

## Honest benchmark note (2026-11-06)

On the 1.86 MB judicial XML corpus every product pathway round-tripped
exactly but stored (ratio 1.0000) where gzip -9 reaches 10.22% and xz -6
reaches 4.81%. Do not pitch compression ratios to pilots until a pathway
beats the `.acn/bench/BENCH-REPORT.md` baselines on a real corpus. What is
live today: the call path, the metering, and lossless round-trip.

Page: https://www.slidphilabs.com/pcc — status live (call path verified).
