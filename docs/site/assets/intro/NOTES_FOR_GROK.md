# NOTES FOR GROK — Cinema intro (finish this)

**From:** prior host session (2026-08-07)  
**User intent:** Cinema-worthy intro. Do **not** ship Ken-Burns / slideshow as final. If you cannot make it cinema-grade, leave notes — user already accepted that bar.

---

## Story (lock this)

1. **Man from the poster** (winged elder / third-eye) points **down from the heavens**.  
2. Where his **finger touches** → **ignites** → **breathes life into the agentic**.  
3. **Settle dual doors:**
   - **Above / toward creator / lab name** → **human entry** → `https://www.slidphilabs.com/humans`  
   - **Where agentic was born** (contact point) → **agentic link** → `https://www.slidphilabs.com/agents`  

Slogan: *One mission · two attack vectors · one team.*

---

## Assets ready (use these)

Path: `docs/site/assets/intro/`

| File | Beat |
|------|------|
| `poster-ref.jpg` | Source poster |
| `shot1-heavens.jpg` | Sky-god pointing down |
| `shot2-finger.jpg` | Finger + ignition spark |
| `shot3-ignition.jpg` | Contact / agentic birth bloom |
| `shot4-settle.jpg` | Gold above · teal below · beam |

Canonical poster also: `docs/site/assets/slid-phi-labs-master.jpg`

Longer host writeup: `HOST_NOTES_CINEMA_INTRO.md` (same folder).

---

## Why prior host stopped

- `image_to_video` failed: **ZDR** needs `output.upload_url`; also **429** rate limits.  
- FFmpeg zoompan on stills = **not** cinema enough — **do not ship**.  
- Partial `s1.mp4` was deleted on purpose.

---

## Your job

1. Animate the **four** keyframes (real motion: point → touch → birth → settle). Prefer 6s shots, 16:9 1080p+, concat with short dissolves.  
2. **Exact text as HTML overlays**, not in the MP4 (models garble titles):
   - Top: lab / Pub Facing / human → `/humans`  
   - Bottom: Agentic Minded / birth → `/agents`  
3. Wire into `docs/site/index.html` `#pageIntro` (video full-bleed; keep Esc/skip; `prefers-reduced-motion` → poster + CTAs).  
4. Output: `docs/site/assets/intro/cinema-intro.mp4` (+ poster still).  
5. Deploy Vercel project **`site`** → www.slidphilabs.com.  
6. Commit SlidPhiLabs.

Door memory already exists: `assets/platform-home.js` (`data-surface="human"|"agent"`).

---

## Platform context (don’t break)

- Dual surface live: `/humans` · `/agents` · `/platform.json` · `/api/welcome` · `/api/agent`  
- Modules: Compression (SPL Codec+CDDG) · Agent platform (CuNi·Rider·Quikgater)  
- Public outcomes only — no private process in the video.

---

## Done when

Beats read without audio · dual CTAs work · deployed · not a slideshow.
