# spl-model-pay — model-based dynamic metering (19% cap)

Op cost comes from per-model rates; customer price is op × 1.19 rounded
DOWN, so margin can never exceed 19%. Prices move whenever models move.

## How dynamism works

1. Publish a rate card at `SPL_MODEL_RATES_URL`
   (default `https://www.slidphilabs.com/api/model-rates`).
2. The engine fetches it per quote; unreachable → pinned card in
   `src/rates.mjs` (operator-configured, explicitly dated versions).
3. Every quote records `{card id, version, model, timestamp}` — auditable.

## Use

```js
import { priceUsage } from 'spl-model-pay';
await priceUsage({ model: 'frontier', input: 63881820,
                   cached: 61173893, output: 622759 });
// → { opUsd: 35.817334, priceUsd: 42.62, margin: 0.1899, ... }
```

```sh
spl-model-quote --model frontier --input 1000000 --cached 950000 --output 8000
```

## Rules

- Unknown models throw (fail closed). Cached clamps to input.
- Rounding is always down. Tests prove margin ≤ 0.19 on all models/shapes.
- Seed rates are placeholders with effective dates — replace with contracted
  numbers or publish the remote card; never hand-edit a quote.
