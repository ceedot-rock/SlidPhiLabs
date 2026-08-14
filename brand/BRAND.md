# Slid Phi Labs — master brand

## Theme (locked)
Mystical guardian era: **gold ornate metal · teal/cyan glow · lotus · wings · mandala · third-eye light · deep cosmic navy (#050b16)**.

- Full-bleed square marks (1024²), **no light gray outer frames**, no iOS app-icon chrome.
- Product logos share house system; product symbol differs, palette does not.

Master poster: `docs/site/assets/slid-phi-labs-master.jpg`

## Commercial surface assets (2026-08-14)

| File | Use | Size |
|------|-----|------|
| `og-poster-tru8-125000x.jpg` | Open Graph / Twitter `summary_large_image` | 1200×630 |
| `hero-bg-tru8.jpg` | Hero video poster + body fallback | 1920×1080 |

Visual: binary data vortex → crystalline TRU8 cube, teal `#00c2c7` + purple neon, “IMPRESSIVE COMPRESSION · 125,000×”.

**Live site action (Host):** place both files under Fly `/assets/logos/`, then:

```html
<meta property="og:image" content="https://www.slidphilabs.com/assets/logos/og-poster-tru8-125000x.jpg"/>
<meta name="twitter:image" content="https://www.slidphilabs.com/assets/logos/og-poster-tru8-125000x.jpg"/>
<!-- and -->
<video ... poster="/assets/logos/hero-bg-tru8.jpg">
```

Cache-bust CSS/JS after deploy.

## Product logos (uniform set · 2026-08-07)

| File | Product |
|------|---------|
| `logo-slid-phi-labs.jpg` | House mark |
| `logo-slid-phi.jpg` | SPL Codec / slid-phi |
| `logo-zero-range-wave.jpg` | Zero Range Wave |
| `logo-zrqc.jpg` | ZRQC umbrella |
| `logo-cddg-split.jpg` / `logo-cddg.jpg` | CDDG:Split |
| `logo-blackjack.jpg` | Blackjack |
| `logo-shard-zip.jpg` | shard-zip |
| `logo-shard-tsdb.jpg` | shard-tsdb |
| `logo-paypersuite.jpg` / `logo-pps.jpg` | Pay Per Suite |
| `logo-cuni.jpg` | CuNi |
| `logo-agent-rider.jpg` | Agent^Rider |
| `logo-quikgater.jpg` | Quikgater |

Site path: `docs/site/assets/logos/`  
Brand pack: `splabs-brand/assets/brand/logos/`

Cache-bust on site with `?v=13` or higher after deploy.
