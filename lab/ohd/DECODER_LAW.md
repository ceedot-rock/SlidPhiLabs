# Decoder and prune law (OHD)

PCC is the product. Scout then Sniper. First DECODE_OK wins.
Seats do not race each other. The opponent is gzip / xz / zstd.

## Decode

Scout `d` and Sniper `d` must emit raw bytes whose length and CRC match the input.
OHD does not claim Fast for Sniper.

## Prune

Scout Fast: `SCOUT_PROFILE=fast` → `PCC_OPEN_RATIO=0.99` (skip mixer tail).
Scout quality: `PCC_OPEN_RATIO=0.31`.
Sniper: one typed front-end family (`sniper_race.h`). Skip LZM2 on high-ascii.
Cap BWT at min(n+64KiB, 32MiB).

Do not retag official Silesia from a prune.
