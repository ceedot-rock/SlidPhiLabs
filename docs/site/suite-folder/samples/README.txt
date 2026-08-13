SPL Pay Per Suite — sample data folder
=====================================
Download any sample to your machine, compress on /pps or via API, then
decompress and recompress.

  zeros_*.i32le  — int32 little-endian zeros (ZRW domain)
  ramp_1k.i32le  — 0..999 ramp
  walk_1k.i32le  — deterministic walk
  series_demo.json — small JSON for web-codec text path

Encode: POST /api/compress (int32) or POST /api/web-codec (text/json)
Decode: POST /api/decompress or web-codec decompress

Stay on the suite: https://www.slidphilabs.com/pps
