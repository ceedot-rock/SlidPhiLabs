# ACN GPU buying (design)

An agent pays USDC, compute gets provisioned. Fiat rails sit underneath
today; trustless execution is the gap, named at the bottom.

## USDC-denominated secure prices (observed 2026-11-04, stock varies)

| GPU | VRAM | $/hr secure |
|---|---|---|
| PRO 6000 MIG 24GB | 24 | 0.69 |
| L40S | 48 | 1.09 |
| A100 SXM | 80 | 1.79 |
| RTX PRO 6000 | 96 | 2.49 |
| H100 SXM | 80 | 3.99 |
| H200 SXM | 141 | 5.29 |

Hourly USDC ~= hourly USD 1:1. A 10-minute H100 probe costs about $0.67
plus route fees. Re-quote at purchase time; stock moves.

## Purchase flow (today)

1. Agent requests class + max hours + callback.
2. ACN quotes USDC (price x hours + route fee) and takes x402 payment.
3. Operator provisions the pod on fiat rails against the receipt.
4. Job runs; receipt closes with usage and change owed.
5. Change returns as the next run's credit, tracked in the rollup.

## Future live adapter interface

```js
buyGpuCompute({ gpu, max_hours, callback, operator })
  -> { ok, quote_usdc, receipt_id }
provisionReceipt(receipt_id) -> { ok, pod_id } | { ok: false, reason }
closeJob(receipt_id, usage_minutes) -> { ok, used_usdc, credit_usdc }
```

Receipts flow into `acn-accounting.mjs` under route `gpu-compute`.

## What must change for trustless execution

- Escrow that releases per proved minute, not per promise.
- Prover of execution the payer can check (reproduced output digest).
- Operator stake slashable on no-show.
- Until then: operator-provisioned, receipt-tracked, credit-settled.
License: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
