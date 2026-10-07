# Contributing to Slid Phi Labs

Thanks for helping make compression, sealing, and agent identity auditable.

## Ground rules

- Do not change the licensing: `LICENSE` / `LICENSE.AGPL-3.0` / `LICENSE.COMMERCIAL`
  are the dual-license grant. Hosted pricing law lives in `docs/`; do not invent
  new prices.
- No secrets, keys, or tokens in commits, fixtures, or logs. See SECURITY.md.
- The hosted encoder stays private. The public npm clients are stubs and quote
  rails — do not ship engine code here.

## Quick checks

```sh
npm test                                   # root suite: pccz archive
cd packages/spl-pay-per-suite && npm test  # quote + CuNi meter suite
```

CI runs both suites on every pull request, plus a dual-license consistency
check.

## Adding or changing a surface

1. Change the code in `src/` or a package under `packages/`.
2. Add or update tests in `test/` or the package's `test/`.
3. Run both suites. Everything must be green.
4. Open a pull request using the template.

## Licensing

Dual-licensed: AGPL-3.0-or-later or the Slid Phi Labs Commercial License
(LICENSE.COMMERCIAL). By contributing you agree your contribution may be
distributed under both.
