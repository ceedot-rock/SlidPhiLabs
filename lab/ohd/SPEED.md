# Scout / Sniper — smaller and faster

Locked: first DECODE_OK wins. Never claim Fast for Sniper.
PCCX Op 13/14 do **not** beat current Sniper on Silesia (sao 4.21M vs E 3.66M).

## Where the bytes are (Sniper E tip 43,724,575)

| file | raw | E packed | % raw | next lever |
|---|---:|---:|---:|---|
| mozilla | 51,220,480 | 13,304,103 | 26.0 | MIPS2 already on; LZM2 race only if apply is cheap |
| webster | 41,458,703 | 7,272,548 | 17.5 | WEB3 + BWT32 already on |
| samba | 21,606,400 | 3,748,880 | 17.4 | leave |
| sao | 7,251,944 | 3,659,859 | 50.5 | **byte-planes on cols 0/2** (PCCX note; E still fat) |
| x-ray | 8,474,240 | 3,682,106 | 43.4 | XR2 already beats Aware V6 3.84M |
| nci | 33,553,445 | 1,156,452 | 3.4 | leave |
| xml | 5,345,280 | 420,071 | 7.9 | leave |
| dickens | 10,192,446 | 2,538,324 | 24.9 | leave |
| ooffice | 6,152,192 | 2,310,168 | 37.5 | EXE/MIPS sniff |
| osdb | 10,085,684 | 2,424,253 | 24.0 | TBL |
| mr | 9,970,564 | 2,111,392 | 21.2 | MRIMG |
| reymont | 6,627,202 | 1,096,419 | 16.5 | leave |

Scout official line is still **pcc-0.12.1 = 51,498,645**. Do not retag from a mixer pass.

## Faster Scout (Dial A)

`lb pcc` already:
- crush-early (`autonoma::crushed`, ~0.12–0.22)
- held-return at 0.65 after non-BWT seat
- OPEN 0.31 then LZ/LZM/STR/ZMIX/NNC

What still burns wall clock:
1. Full-file BWT after MATCH when primary is BWT (text).
2. ZMIX/NNC on every file still open at >0.31 (HOUSE_MAX gated).
3. `scout-dial-a` exported LBR1_* knobs that `lb pcc` mostly ignores.

Dial:
- `SCOUT_PROFILE=fast` → `PCC_OPEN_RATIO=0.99` (skip mixer tail)
- `SCOUT_PROFILE=quality` → `PCC_OPEN_RATIO=0.31` (smaller)

`splb` must read `PCC_OPEN_RATIO` (patch in GATE_031 / pcc.rs). Until that ships, the env is a no-op and profile is documentation.

Do **not** raise MATCH window on the Fast seat. Champ 4 MiB belongs to quality/`lb champ`, not Dial A.

## Faster Sniper (npcc)

Front-ends already exist: SAO, SAO2, D16, EXE, WEB/2/3, TBL, NCI, MRIMG, XR2, MIPS/2.
Cost is: every `fe_*_apply` that succeeds then a 32 MiB BWT inner.

Race law to land in `tnssrc.c` / codec picker:
1. Structural sniff only (record size, ELF/PE magic, even length, text frac). Decline before allocating transform buffers.
2. At most **one** typed front-end per file + raw modes 0/1/3/5/6/7.
3. Cap `BWT_BLK` to `min(32MiB, file+64k)` — webster needs 32; dickens/xml do not.
4. Skip LZM2 when `ascii_frac > 0.92` and `n > 256KiB` (BWT wins those).
5. Skip WEB3 unless `ascii_frac > 0.85` or HTML/XML magic.
6. Skip MIPS2 unless EXE/ELF/PE or mozilla-class entropy bands.

That is speed. Ratio stays E unless a sniff-selected arm beats the current winner.

## Smaller Sniper (only sao is the cheap next byte)

PCCX arms-opt said cols 0/2 on sao fell back to raw interleaved; **4 byte planes + u32-delta** is the remaining Sao idea. E is already 452 kB *ahead* of PCCX Op13. Planes are additive on top of FE_MODE_SAO / SAO2, not a crate merge.

Do not import PCCX try-all, NCA bank, or host xz.

## Smaller Scout

Worth it only on files Scout currently leaves fat (sao / x-ray / ooffice class) **without** running Sniper genes. Cheap detect in `detect.rs`:
- `arithmetic_u32_le` already flips delta MATCH and kills BWT.
- Add sao 28-byte record sniff → STR/delta MATCH only, no BWT.

If Scout needs E numbers, that file should lose first-OK to Sniper at the router — do not make Dial A into E.

## Router

OHD already stops at first DECODE_OK. Order stays scout then sniper.
Peek may skip Sniper only when Scout already returned DECODE_OK (current behavior).
Do not size-tournament across seats in v0.

## Prove

```bash
export SCOUT_LB=/path/to/lb
export OHD_SNIPER=/path/to/npcc
cd lab/ohd && bash prove.sh
SCOUT_PROFILE=fast  ./bin/scout-dial-a c testdata/hello.txt /tmp/h.pcc
SCOUT_PROFILE=quality ./bin/scout-dial-a c testdata/hello.txt /tmp/h2.pcc
```

Silesia: do not publish a new official PCC line from Fast profile.
Sniper: any race prune must keep VERIFY.json 12/12 and packed ≤ 43,724,575.
