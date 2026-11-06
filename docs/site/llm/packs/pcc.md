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

## Honest benchmark note (2026-11-06, engines fixed)

| corpus | PCC | gzip -9 | xz -6 |
|---|---|---|---|
| medical 98 MB | 13.52% | 9.92% | 7.30% |
| financial 12 MB | 18.66% | 20.85% | 15.68% |
| judicial 1.86 MB | 5.92% | 10.22% | 4.81% |

PCC beats gzip on financial and judicial, loses medical, trails xz
everywhere. Pitch beating gzip on log/financial-type data (verified);
do not claim xz parity. Full table: `.acn/bench/BENCH-REPORT.md`.

Earlier the endpoint stored everything (missing engine binaries in the
deploy) — fixed: pulsar 2.5.0 + lb 1.0.1 bake into the image, both doors
verified live.

Page: https://www.slidphilabs.com/pcc — status live (verified end-to-end).
