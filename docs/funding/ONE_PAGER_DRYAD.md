# Slid Phi Labs × Dryad · storage audit one-pager

**Question: how many of Dryad's stored bytes are compressible — and what is that worth?**
(One-page pilot proposal for Jennifer Gibson, pilots & partnerships.)

## The offer (free, 2 weeks)

Slid Phi Labs will run a **storage audit over an agreed sample of Dryad's public datasets**
and deliver a written report:

1. **Compressibility profile** — per-format ratios (tabular, genomic, imaging, text) using
   open, reproducible tools (zstd/gzip baselines + our GPLv3 `pulsar` reference).
2. **Savings model** — projected storage + egress savings at Dryad's current scale,
   priced against public cloud egress (~9¢/GB).
3. **Lossless guarantee note** — everything measured is bit-exact round-trip; research
   data is never altered, only measured.

No engine handover. No private code in the pilot. Dryad keeps the report whatever it decides.

## Why us

- We build metering and lossless compression for a living: hosted compressor (PCC),
  metered jobs at $0.25/GB after the first 1 GB once per address, agent pay rails over x402.
- Public proof, honestly stated: `pulsar` 2.5.0 (GPLv3) scores **55.7M / 211.9M on Silesia**
  with 12/12 DECODE_OK — beats gzip-9, loses to xz-6. We publish the losses too.
- One person, live checkout, no slideware: https://www.slidphilabs.com

## The pilot ask

- A 30-minute scoping call: which collections, what sample size, where the bytes live.
- Read-only access (or a Dryad-pulled sample) to the agreed corpus.
- If the numbers justify it: a paid compression + metering pilot on Dryad's terms.

## Contact

Corey Tasz, CEO/Founder · corey@slidphilabs.com · https://www.slidphilabs.com
Cherry Hill, NJ
