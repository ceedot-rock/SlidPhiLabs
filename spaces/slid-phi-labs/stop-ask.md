# Stop and ask Corey (no guesses made)

1. DECIDED 2026-11-09: SPL stands for Slid Phi Labs. (Earlier SPLK
   note withdrawn; no rename of SPL:ACN or @slidphi/spl-acn.)
2. DECIDED 2026-11-09: live ACN is https://www.slidphilabs.com/api/mcp
   (site map primary; client default + allowlist match). GitDepot Hub is
   blob storage, not the ACN address. GitHub hosts code only.
3. Does ACN get its own Stripe product, or ride the existing one? Code
   shows inline price_data for credit buys (no dashboard product) and
   dashboard products only for Merchant Gate subs. No ACN product found.
4. DECIDED 2026-11-09: sell usage, not seats. No seat pricing. (Existing
   $9/mo Rider toll stays until replaced by metered pricing.)
5. Free allowance: 1 GB or 2 GB of usage? (Undecided.)
9. DECIDED 2026-11-09: usage metering rides the Rider credential. No
   separate usage token; quotas enforce at rider issue/gate time.
10. DECIDED 2026-11-09: full rebuild top to bottom, ordered by economic
    viability, usage gated by the rider token.
7. Licenses: WalletVerse and HonorAnchor have no LICENSE file. HonorAnchor
   recommendation is the lab dual standard (AGPL-3.0-or-later OR
   Commercial). Confirm per repo, starting with these two.
8. Decision: make seats free with token or API-key gating on the other
   services? (Which services, which gate.)

Bounties: outbound hunting only. SlidPhi hunts others' bugs for bounty
payouts (HackenProof HyperBridge filing live); SlidPhi pays no bounties
to others and holds no charter.

Also still open from earlier work: delete the org TeachAid placeholder and
transfer ceedot-rock/teachaid, or leave both; merge the ATLAS rebrand
(branch atlas-rebrand) or drop it; apply the two Supabase migrations
(referral codes, atomic promo caps) after review + backup.
