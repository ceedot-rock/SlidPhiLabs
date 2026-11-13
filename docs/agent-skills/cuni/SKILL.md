---
name: cuni
description: Use the nine CuNi calls — check, translate, ingest, audit, money, time, chain, ship, parity. Same name on the CLI, POST /v1, MCP, and the Python SDK. Hosted calls bill the lab. Use when proving identical output, translating a program, or shipping a money, time, chain, firmware, or parity proof.
version: 1.0.0
---

# CuNi

Write one program. **Same stdout, or it refuses.**

Nine calls: `check` `translate` `ingest` `audit` `money` `time` `chain` `ship` `parity`.

| Call | CLI | POST | USD |
|---|---|---|---|
| check | `cuni check` | `/v1/check` | 0.05, first 100/month free |
| translate | `cuni translate` (`cuni bank` is the same call) | `/v1/translate` | 0.10 |
| ingest | `cuni ingest` | `/v1/ingest` | 0.10 |
| money | `cuni money` | `/v1/money` | 0.25 |
| time | `cuni time` | `/v1/time` | 0.25 |
| parity | `cuni parity` | `/v1/parity` | 0.25 |
| chain | `cuni chain` | `/v1/chain` | 0.50 |
| ship | `cuni ship` | `/v1/ship` | 0.50 |
| audit | `cuni audit` | `/v1/audit` | 1.00 |

Keeper: https://github.com/ceedot-rock/CuNIverse  
Studio (free playground): https://cuni-studio.fly.dev/  
Lab (the meter): https://www.slidphilabs.com/v1/check  
Python: `from cuni_exactness import check, translate, money` — HTTP 402 raises `PaymentRequired`.

Pass an x402 `X-PAYMENT` header or the lab answers 402. The local binary is unmetered.

## Bank

Paste N, get X, prove or refuse. `cuni translate` is this call. `cuni bank paste` still works.

```bash
cuni bank paste examples/bank/add.py --from py --to c
```

Studio bank stays free: https://cuni-studio.fly.dev/bank  
Metered translate: POST https://www.slidphilabs.com/v1/translate  SKU `lab-translate` $0.10  
Metered check: POST https://www.slidphilabs.com/v1/check  SKU `lab-check` $0.05  

Receipt fields: `verb`, `ok`, `source_hash`, `pin`. A 402 body also carries `sku` and `accepts`.

## Pay

Studio exactness is $0. Closed-app exception $490/yr SKU `cuni-exception`. License AGPL-3.0-or-later or commercial grant.
