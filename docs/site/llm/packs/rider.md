# Agent-Rider — LLM prompt pack (beta)

Hire a verified agent identity and pay per call over x402 rails.

```js
import { verifyPaidCall, checkPaidProof } from './docs/site/api/lib/rider-paid-call.mjs';
const ok = await verifyPaidCall({ proof, rail: 'x402' }); // fail closed on false
```

Rules: every paid call carries its payment proof; `verifyPaidCall` false
means stop, never retry the same proof. Rider token verification lives at
`https://agentrider.fly.dev/api/rider/verify`.

Cost: Solo $12/month ($120/year, 1 identity, 500 verifications/month),
Team $49/month (10 identities, 5,000/month, Warrant included), Fleet
$199/month (100 identities, 50,000/month, Warrant + fleet watch included).
Overage $0.02/verification, cap 2x plan, alert 80%. Free: 1 identity,
100 verifications/month, no L3/L4 attestation.
Buy: https://www.slidphilabs.com/pay?sku=rider-solo (team/fleet likewise).
Status beta: SDK verified locally, served hire flow not yet verified.
Page: https://www.slidphilabs.com/rider
