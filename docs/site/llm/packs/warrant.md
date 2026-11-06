# Warrant — LLM prompt pack (beta)

Warrants declare an agent fit to serve. Issue, verify on every gated action,
revoke when done. Chain max 8, delegation modes supported.

```js
import { issueWarrant, verifyWarrant, revokeWarrant } from './docs/site/api/lib/warrant.mjs';
const w = issueWarrant({ agent_id, room_id, scope: 'files', granted_by: adminId, ttl_s: 86400 });
const { allowed, reason } = verifyWarrant(w.token, { agent_id, room_id, scope: 'files' });
if (!allowed) throw new Error(reason); // fail closed, never work around
```

Rules: 3 free issues/day, 10 free receipts/day. Verify on every access
attempt, not just the first. Revoke on role change or incident.

Cost: $8/month add-on to Rider Solo ($80/year, sku `warrant-addon`);
included in Rider Team and Fleet. No standalone SKU.
Buy: https://www.slidphilabs.com/pay?sku=warrant-addon
Status beta: SDK verified locally, served registry not yet verified.
Page: https://www.slidphilabs.com/warrant
