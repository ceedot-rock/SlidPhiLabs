# Laws — compression, distilled

Source of record: `docs/GAPS_NCA_SWARM.md` §0, Mahoney *Data Compression Explained*.

1. **Lossless = predict + code.** Predict the next byte; spend ~0 bits where
   certain; write guesses with an entropy coder (rANS/range/arithmetic).
2. **DECODE_OK.** The decoder must replay the exact same guesses from already
   decoded data. No replay → not lossless. Kills most "smart" ideas.
3. **compression = modeling + coding.** Coding is solved. Modeling is hard.
   No universal compressor shrinks everything.
4. **NCA is never the packer.** NCA/Autonoma watch, gate, inhibit, schedule,
   grow, abort. Specialists pack; a router picks; Autonoma guard the edges.
