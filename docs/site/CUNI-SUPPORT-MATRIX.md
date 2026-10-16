# CuNi Language Support Matrix — v0.10.0 / Protocol v1.1.1

Pinned to [CuNIverse](https://github.com/ceedot-rock/CuNIverse) release
**v0.10.0** (2026-10-08), protocol **v1.1.1**. This file is the single
versioned source of truth for CuNi language-support claims. Every public
surface (product page, wiki, llms.txt, protocol JSON) must agree with it.

## The matrix

| Category | Count | What it means | Source |
|---|---|---|---|
| Catalog | 53 | Every entry in `src/langs.rs`: the top 50 languages + 3 onchain profiles (`vy`, `move`, `cairo`) | `src/langs.rs` |
| Emitted | 53 | Every catalog entry has a real emitter (`src/codegen_*.rs`) | `src/emit.rs` `generate_exact` |
| Native-executed | 45 | `SeatKind::Native`: real emitter + real toolchain; emitted code is compiled/run and stdout compared byte-identical against the Python gold. Only native seats count toward the PASS/FAIL verdict | `src/emit.rs` `seat_kind` |
| Lowered | 5 | `m`, `vb`, `swift`, `hack`, `st`: no installable native toolchain, so they run through the Python lowering under `cuni check --all` for information only — they never flip the verdict | `src/emit.rs` doc comment; CHANGELOG v0.10.0 |
| Onchain profiles | 3 | `vy`, `move`, `cairo`: emit chain-shaped artifacts so stdout can actually be compared | `src/langs.rs` doc comment |
| Refusal-only | 0 languages | Refusal is per-construct, not per-language. Every emitter implements the core subset (`say`, `let`/`mut`, `def`/`ret`, `if`/`else`, `while`, int arithmetic, comparisons, logic, string concat) and returns `Err` — refuses — for everything outside it (floats, generics, lists, maps, etc.). A seat that refuses honestly is a real seat; a seat that approximates would be a lie | `TOP50_AUDIT.md` emitter contract |
| Studio gate | 3 (separate) | `py`, `go`, `js`: the matching gate. Kept separate from the catalog counts | `src/langs.rs`; protocol `studio_gate` |

45 + 5 + 3 = 53. The counts reconcile.

## Retired claims (do not use)

| Claim | Why it's wrong | Replaced by |
|---|---|---|
| "144 languages" | Pre-trim catalog count. The 2026-10-02 fat trim (`REMOVED_FAT.md`) removed entries with no plausible native toolchain; the catalog is now 53 | 53-entry catalog |
| "10 native seats" / "7 native seats" | Stale. 45 seats are `SeatKind::Native` as of v0.10.0 | 45 native-executed |
| "Install v0.9.0" / "public tag v0.3.0" | Stale releases | v0.10.0 (`cargo install cuni`) |
| "Protocol 1.1.0" | Stale | Protocol v1.1.1 |

## Version history
- v0.10.0 (2026-10-08): 53-entry catalog; native-only verdict; money-seat default
- v0.9.0 (2026-10-02): seven new native emitters (PHP, R, Perl, OCaml, Common Lisp, Fortran, Pascal); fat trim
