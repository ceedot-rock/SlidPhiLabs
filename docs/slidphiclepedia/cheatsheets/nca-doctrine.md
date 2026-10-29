# NCA doctrine — helpers, not the packer

Source of record: `docs/GAPS_NCA_SWARM.md` §0b. Binding on all lab NCA work.

## The law

Autonoma are the little machines that watch, gate, inhibit, schedule, grow,
and abort. They are never the compressor. DECODE_OK always holds: decode
never mutates bytes; the inhibitor sits before writes, never inside them.

## Sanctioned NCA uses (precedents in-tree)

- Sentinel: Allow/Throttle/Block at entropy breakpoints.
- Inhibitor bus: pre-write gate with mirrored cost.
- Colony: grow/spend/leftover resource dynamics (game worlds, pacing).
- Cloak: watch residual/stagnation, seal outputs.
- Cheap gate: pick pipeline family from stats ("not a codec").
- Site coat: health/metrics ticks.

## Banned shapes

- NCA emitting bytes the decoder cannot replay (DECODE_OK violation).
- "SmartSwarm" as compressor (stub; real object is MoE routing).
- NCA iterating directly on secrets or payment paths.

## Scoreboard (standing lab numbers)

- PERsiST: naive 61,637 vs heart 1,981 tok/turn (96.8%), 355/355 shards,
  20/20 Ed25519 envelopes, ratio 2.93x.
- CESD: Silesia 0.6491, enwik8 0.6350, agent-corpus 0.6861 (psi golden.md).
