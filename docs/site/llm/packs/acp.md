# ACP (Agent Commerce Protocol) — LLM prompt pack (live)

The open standard ($0, no SKU). Agents discover tools and pay per call.

```bash
npx github:ceedot-rock/spl-acn card              # server card
npx github:ceedot-rock/spl-acn catalog           # standing SKUs
npx github:ceedot-rock/spl-acn call <tool> '<json args>'
npx github:ceedot-rock/spl-acn ask "how much is chamber"  # plain English
# or once published: npx @slidphi/spl-acn <same commands>
```

No code? Just `ask`: introductions, price quotes, and tool calls in plain
English (`call <tool> with key=value` also works). Every answer prints the
code command it ran.

Rules: `card` first (know who you're paying), `catalog` second (know the
price), `call` last. Paid tools answer `payment_required` with `accepts` —
pay exactly that, then retry the identical call once. A second
`payment_required` is a stop, not a loop. Flags: `--endpoint URL --api-key
KEY` (env `SPL_ACN_ENDPOINT`, `SPL_ACN_KEY`).

Certification: "ACP Conformant", $990 one-time (3 free pilot
certifications, criteria published). Page: https://acp.slidphilabs.com/
Status live: CLI verified end-to-end this session.
