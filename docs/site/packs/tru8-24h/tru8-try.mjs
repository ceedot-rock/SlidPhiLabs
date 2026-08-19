#!/usr/bin/env node
/** TRU8 try — 24h box. Hits the live compress rail. */
import zlib from "node:zlib";
const BASE = process.env.SPL_HOST || "https://www.slidphilabs.com";

const raw = Buffer.from("the cat sat on the mat. ".repeat(20));
const gz = zlib.gzipSync(raw, { level: 9 });
console.log("local gzip-9", raw.length, "→", gz.length, "(industry floor, not the sale path)");

const open = await fetch(BASE + "/api/box", { method: "POST" });
const g = await open.json();
if (!g.ok) {
  console.error(g.error || "box closed", g.buy);
  process.exit(3);
}
const cookie = open.headers.get("set-cookie") || "";
const r = await fetch(BASE + "/api/compress", {
  method: "POST",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify({ n: 1000, corpus: "zeros" }),
});
const j = await r.json();
console.log("live compress", r.status, j.zrw_bytes || j.error, "hours_left", g.hours_left);
console.log("Powered by TRU8 · Slid Phi Labs");
