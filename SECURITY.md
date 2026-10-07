# Security

Report vulnerabilities to **corey@slidphilabs.com**, or use GitHub's private
vulnerability reporting on this repository (Security tab, "Report a
vulnerability"). Do not file public issues with exploit details.

Include what is affected, steps or inputs to reproduce, and what you expected
versus what happened. You can expect an acknowledgement within 3 business days.
We will keep you updated while we investigate and credit you unless you prefer
to stay anonymous.

## In scope

- The npm clients (`slid-phi`, `spl-pay-per-suite`) and `mcp-shim.js`
- The pccz archive path (`src/pccz.mjs`)
- `phi-rest` static hosting and the sealed-boot path
- The hosted API contract documented in this repo (not the private encoder)

## Out of scope

- The hosted encoder and lab machine internals
- Social engineering, spam, or denial-of-service against hosted demos

## Standing rules

- Do not commit `sk_`, `rk_`, `whsec_`, or service-role keys.
- Public npm packages in this org are stubs or quote rails. They are not the engine.
- Rider JWTs are short-lived ES256. Verify against JWKS; do not send secrets to agents.
- Combined GC engine is private. Measurement pages contain no coefficients.
