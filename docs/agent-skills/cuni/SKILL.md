---
name: cuni
description: Use CuNi exactness and CuNi Bank. One .cuni program, 119 languages, same stdout or refuse. Bank paste N get X. Studio, cuni check, lab-agent /v1/check and /v1/translate. Use when translating code losslessly, proving identical output, or writing portable agent policy.
version: 1.0.0
---

# CuNi

Write one program. Emit many languages. **Same stdout on every catalog seat, or it refuses.** There is no best-effort mode.

Studio: https://cuni-studio.fly.dev/  
Product: https://www.slidphilabs.com/cuni  
Protocol: https://cuni-studio.fly.dev/.well-known/cuni-protocol.json  
Repo: https://github.com/ceedot-rock/cuni  tags `v0.1.10` · `cuni-bank-0.1.0`  
Install: `cargo install --git https://github.com/ceedot-rock/cuni --tag cuni-bank-0.1.0`

Native seats: Python, Go, JavaScript, TypeScript, C, C++, Rust. Other catalog ids emit and run via Python lowering. `cuni check` is the proof.

## Bank

Paste N, get X, prove or refuse. Ingest is Python subset or `.cuni` — not 119 ingest parsers. 119 langs = `cuni check` after ingest.

```bash
cuni bank paste examples/bank/add.py --from py --to c
```

Studio bank: https://cuni-studio.fly.dev/bank  
Lab: POST https://spl-lab-agent.fly.dev/v1/check  SKU `lab-check` $0.10  
Lab: POST https://spl-lab-agent.fly.dev/v1/translate  SKU `lab-translate` $0.10  

Receipt fields: `verb`, `ok`, `source_hash`, `pin`.

## Pay

Studio exactness is $0. Closed-app exception $490/yr SKU `cuni-exception`. License AGPL-3.0-or-later or commercial grant.
