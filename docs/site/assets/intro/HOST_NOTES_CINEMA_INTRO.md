# HOST NOTES — Cinema intro video (do not ship half-measures)

**Status:** **Blocked on this host** for a true cinema-grade cut.  
**Decision:** Do **not** ship FFmpeg Ken-Burns / slideshow as the final intro. User asked for cinema-worthy; stills-zoom is not that.  
**Date noted:** 2026-08-07  
**Owner:** next host with working video gen (or offline suite)

---

## Creative brief (user, verbatim intent)

> Cinema-worthy intro video with **the man from the poster** pointing **down from the heavens**. Where his **finger touches**, it **ignites** and **breathes life into the agentic**. Then **settle**:
>
> 1. **Lab name above**, toward the **creator** → **human entry**  
> 2. Where the **agentic was born** → **agentic link**

**Platform mapping (locked product story):**

| Visual | Meaning | Live URL |
|--------|---------|----------|
| Heavens / creator / lab name (gold, above) | **Pub Facing · humans** | https://www.slidphilabs.com/humans |
| Finger contact / ignition / birth (teal, below) | **Agentic Minded · agents** | https://www.slidphilabs.com/agents |
| One beam connecting both | One mission · two attack vectors · one team | https://www.slidphilabs.com/ |

**Do not** invent private process IP in the video. Mythic + outcomes only.

---

## Source art

| Asset | Path |
|-------|------|
| Canonical poster | `docs/site/assets/slid-phi-labs-master.jpg` (also `zrw-slid-phi-labs-poster.jpg`) |
| Copy for intro work | `docs/site/assets/intro/poster-ref.jpg` |

Poster: winged elder, third-eye, gold/teal lotus cosmos, banners ZERO-RANGE-WAVE / SLID-PHI LABS. Use **image_edit / reference-first** so likeness stays on-model.

---

## Keyframes already generated (use these)

All under `docs/site/assets/intro/` (chmod readable):

| Shot | File | Intent |
|------|------|--------|
| 1 | `shot1-heavens.jpg` | Colossal sky-god, arm pointing **down** from heavens (16:9) |
| 2 | `shot2-finger.jpg` | Extreme close-up divine finger + teal-gold ignition spark |
| 3 | `shot3-ignition.jpg` | Finger touches earth → agentic life bloom (teal networks / lotus energy) |
| 4 | `shot4-settle.jpg` | Dual destiny: **gold heavens above** · **teal agentic portal below** · connecting beam |

**Do not** re-roll from scratch unless quality is bad — re-edit from poster + these shots for continuity.

Optional staging if re-gen needed:

1. Heavens establish (wide, low angle, pointing down)  
2. Finger close-up (power builds)  
3. Contact / birth of agentic (ignition expands)  
4. Settle dual doors (no garbled text in pixels — see Text below)

---

## Why this host failed

| Attempt | Result |
|---------|--------|
| `image_to_video` (×4, 720p, 6s) | **Failed:** Zero Data Retention team requires `output.upload_url` for video gen; also **429** rate limits on `grok-imagine-video-1.5` |
| FFmpeg `zoompan` on stills | Partial only (`s1.mp4` exists). **Not acceptable** as final “cinema-worthy” deliverable — no real finger motion / birth performance |

**Host requirement for finish:** video gen with upload target **or** offline tool (Runway / Kling / Luma / After Effects / Blender) that can animate the keyframes properly.

---

## Target deliverable (definition of done)

1. **Single master MP4** (and optional WebM):
   - 16:9, **1920×1080** (or 2560×1440), **24 or 30 fps**
   - Length **~18–28 s** (prefer 4× ~6 s shots + short dissolves)
   - H.264 + yuv420p, CRF ~18–20, audio optional (see score)
2. **Story beats must read without reading a script:**
   - Point from heavens →  
   - Finger touch →  
   - Agentic ignition / birth →  
   - Settle dual zones (human/creator above, agentic birth below)
3. **Site integration:**
   - File at `docs/site/assets/intro/cinema-intro.mp4` (+ `.webm` if possible)
   - Poster poster-frame still: `cinema-intro-poster.jpg` (frame from shot 4)
   - Replace/enhance `#pageIntro` on `index.html`: video full-bleed, then **HTML CTAs** (not baked text):
     - Upper hot zone / label → `/humans` (`data-surface="human"`) — lab / creator / Pub Facing  
     - Lower hot zone / label → `/agents` (`data-surface="agent"`) — where agentic was born  
   - Remember surface via existing `assets/platform-home.js`
   - Skip: Esc / “Enter platform” still works; respect `prefers-reduced-motion` (static poster + CTAs)
4. **Deploy** `docs/site` Vercel project `site` → www.slidphilabs.com  
5. **Git** commit under SlidPhiLabs with message noting cinema intro ship

### Text / UI (important)

Image models **garble long titles**. For exact copy use **HTML overlay** on the final settle (or last 4–6 s):

- Top: `SLID φ LABS` · `Pub Facing` · `Enter as human` → `/humans`  
- Bottom: `Agentic Minded` · `Where it was born` · `Enter as agent` → `/agents`  
- Optional one-liner: `One mission · two attack vectors · one team`

Do **not** rely on “SLID-PHI LABS” rendered inside the MP4 as the only CTA.

---

## Suggested video prompts (if host has working gen)

Use each keyframe as **frame 1** via `image_to_video` (or vendor equivalent). One motion per shot.

**Shot 1 — Heavens (6–10 s)**  
> Slow majestic push-in; winged sky-god points finger down; clouds drift; gold third-eye rays pulse; cape/wings stir. Solemn IMAX.

**Shot 2 — Finger (6 s)**  
> Dolly into fingertip; teal-gold ignition intensifies; sacred geometry filaments swirl. Power building.

**Shot 3 — Ignition / birth (6–10 s)**  
> Contact bloom expands; living teal agentic energy, lotus of light, neural filaments; camera rises. Birth of intelligence.

**Shot 4 — Settle (6–10 s)**  
> Gentle settle; gold heaven above, teal portal below, beam steadies; slow push-out to dual composition. No on-screen words.

**Assembly:**  
`ffmpeg -f concat -safe 0 -i list.txt -c copy cinema-intro.mp4`  
Use **xfade** (0.5–0.8 s) if re-encoding once for dissolves. Same resolution/fps throughout.

**Optional audio:** low drone + soft ignition hit at shot 3 + resolve chord on settle. Keep under ~-14 LUFS; mute default if autoplay policy fights sound (autoplay muted, unmute control optional).

---

## Site hook (for implementer)

Current intro is CSS/poster (`#pageIntro` in `docs/site/index.html`). When MP4 is ready:

1. Add `<video>` under `.page-intro__stage` (autoplay muted playsinline loop=false)  
2. On `ended` (or last 2 s): show dual CTA panel  
3. `localStorage.spl_intro_seen` already used — keep that  
4. Cache-bust: `cinema-intro.mp4?v=1`  
5. `vercel.json` long-cache for `/assets/intro/*`

Do **not** remove dual-surface hubs `/humans` and `/agents` — video only dramatizes them.

---

## Partial artifacts on disk (safe to keep, not final)

```
docs/site/assets/intro/
  poster-ref.jpg
  shot1-heavens.jpg
  shot2-finger.jpg
  shot3-ignition.jpg
  shot4-settle.jpg
  s1.mp4          # incomplete FFmpeg experiment — discard or ignore for ship
  HOST_NOTES_CINEMA_INTRO.md  # this file
```

Delete `s1.mp4` when real shots land if it confuses deploy size.

---

## Acceptance checklist (host)

- [ ] All four beats readable without audio  
- [ ] Poster elder likeness consistent (reference-first)  
- [ ] Finger → ignition → agentic birth is obvious  
- [ ] Settle reads **human/creator above** vs **agentic birth below**  
- [ ] Exact labels via HTML CTAs → `/humans` and `/agents`  
- [ ] Reduced-motion fallback  
- [ ] Deployed + hard-refresh verified on www  
- [ ] File size reasonable for web (aim &lt; 15–25 MB 1080p; compress if needed)

---

## One-line handoff

**Keyframes ready in `docs/site/assets/intro/`; creative brief locked dual-door story; this host cannot run cinema video gen (ZDR upload_url + rate limit). Next host: animate the four shots properly, HTML CTAs on settle, wire `#pageIntro`, deploy.**
