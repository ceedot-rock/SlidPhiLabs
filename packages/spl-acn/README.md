# SPL:ACN MCP API SDK

One client for the hosted Agent Commerce Network: server card, MCP tool
calls, claim-token seats, x402-aware errors.

```js
import { createMcpClient } from "@slidphi/spl-acn";

const acn = createMcpClient({ apiKey: "spl1.…".replace("…", "") });
const card = await acn.card(); // { ok:true, card }
const out = await acn.callTool("spl_catalog", {});
if (!out.ok && out.reason === "payment_required") {
  // pay the accepts instructions, retry with proof
}
```

Free tools need no key. Paid seats send the claim token as the bearer;
402 answers come back as `payment_required` with `accepts`, never a
throw. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial.

## Terminal

```sh
npx @slidphi/spl-acn card                  # server card
npx @slidphi/spl-acn catalog               # standing SKUs
npx @slidphi/spl-acn call spl_quote '{"gb":10}'
SPL_ACN_KEY=spl1.… npx @slidphi/spl-acn call spl_compress '{"data_b64":"eA=="}'
```

Or install the `spl-acn` binary. Exit codes: 0 ok, 1 call refused,
2 bad CLI.
