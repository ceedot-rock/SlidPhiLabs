# ARC Prize 2026 paper track: missing items (draft, nothing submitted)

Deadline: today 2026-11-09, 6:59 PM local (checklist notes Kaggle uses
23:59 UTC). Entry is a Kaggle Writeup, not a score file. Local folder:
kaggle-arc-prize-2026-paper-track/.

## Measured state (nothing invented)

- Draft body: paper-writeup.md, measured 850 words (alphanumeric tokens)
  by local count. The brief calls it an 887-word draft; the file on disk
  counts 850. Limit is 1500, so either count fits.
- Title: present. "Prior-Projection Baseline: Calibrating the Floor for
  ARC Reasoning".
- Subtitle: MISSING. No subtitle line under the title.
- Thumbnail: present. cover.png (35,459 bytes, solved + failed task render).
- Gallery figures: only cover.png exists (1 of 6). Figures 2 through 6 are
  MISSING, including the required 6th gallery figure.
- Public source-repo link: MISSING. Code (notebook, baseline.py,
  make_figure.py, results JSON) exists only locally; no public repo holds
  it yet.
- Step 1 dependency: the linked prediction-track notebook submission and
  its leaderboard score are still pending (per OWNER_SUBMIT_CHECKLIST.md);
  the writeup body needs the score + notebook URL appended before posting.

## What Corey must do, in order

1. Supply the subtitle (one line).
2. Generate figures 2-6 (make_figure.py exists for the cover; extend it or
   export notebook outputs) and confirm the gallery count hits 6.
3. Push the code to a public repo (or confirm which public repo) and take
   its URL for the Writeup link field.
4. Run Step 1: submit arc-agi-2-ppb-baseline.ipynb to the ARC-AGI-2 track,
   record the score, append score + notebook URL to paper-writeup.md.
5. Paste the final body into a paper-track Writeup, upload cover.png as
   cover image, attach the public notebook, click Submit, and confirm the
   status shows submitted before 6:59 PM.
