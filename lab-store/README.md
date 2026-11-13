# Lab agent store

[![Audited checks](https://github.com/ceedot-rock/lab-agent/actions/workflows/audited-checks.yml/badge.svg)](https://github.com/ceedot-rock/lab-agent/actions/workflows/audited-checks.yml)

Nine CuNi calls, plus squeeze. Receipt or refuse. Pay is on when `LAB_REQUIRE_PAY=1`.

| verb | product | POST | price |
|---|---|---|---|
| check | CuNi exactness | `/v1/check` | lab-check $0.05 |
| translate | CuNi Bank | `/v1/translate` | lab-translate $0.10 |
| ingest | foreign source to .cuni | `/v1/ingest` | lab-ingest $0.10 |
| money | decimal seats | `/v1/money` | lab-money $0.25 |
| time | time law | `/v1/time` | lab-time $0.25 |
| parity | py, rs, c, go, sql | `/v1/parity` | lab-parity $0.25 |
| chain | eight chain emitters | `/v1/chain` | lab-chain $0.50 |
| ship | C and Rust firmware gate | `/v1/ship` | lab-ship $0.50 |
| audit | law vs foreign impl | `/v1/audit` | lab-audit $1.00 |
| squeeze | PCCX | `/v1/squeeze` | lab-squeeze $0.10 |

Discovery: `GET /.well-known/ai-products.json`
Tools: `GET /mcp/tools.json`
Eval: `eval/bank-add.json`

Pay: https://www.slidphilabs.com/api/agent

Live: https://spl-lab-agent.fly.dev/ · canonical catalog https://www.slidphilabs.com/.well-known/ai-products.json

```
POST /v1/check      { "source": "say(1)" }
POST /v1/translate  { "source": "print(1)", "from": "py", "to": "js" }
POST /v1/squeeze    { "data_b64": "..." }
```

Receipt always has `verb`, `ok`, `source_hash`, `pin`. `source_hash` is the SHA-256 of the raw input (UTF-8 for source verbs). `retry` is false on refuse. **402** on POST `/v1/check|translate|squeeze` without `Payment-Signature` or `X-PAYMENT`. Health, readiness, and catalog stay free.
Deposit: `POST /v1/deposit` with `source_hash` (64-character SHA-256 hex; case-insensitive) and `data_b64`; `GET /v1/deposit/<hash>` returns the same bytes. Invalid hashes, malformed base64, and oversized bodies are refused, not coerced.
Readiness: `GET /readyz` returns 200 only when both `cuni` and `pccx` are present; `GET /healthz` stays a liveness check.
MCP on Rider: `cuni_check`, `bank_paste`, `pccx_encode`.
