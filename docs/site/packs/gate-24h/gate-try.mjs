#!/usr/bin/env node
/** Gate try — 24h box. Live /api/process zeros rail. */
const BASE = process.env.SPL_HOST || "https://www.slidphilabs.com";
const open = await fetch(BASE + "/api/box", { method: "POST" });
const g = await open.json();
if (!g.ok) {
  console.error(g.error || "box closed", g.buy);
  process.exit(3);
}
const cookie = open.headers.get("set-cookie") || "";
const r = await fetch(BASE + "/api/process", {
  method: "POST",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify({ n: 10000, corpus: "zeros" }),
});
const j = await r.json();
console.log("process", r.status, "zrw_bytes", j.zrw_bytes, "hours_left", g.hours_left);
console.log("Gate Year $790 → https://buy.stripe.com/7sY4gA6Jfapy1GZ8gw6wE0G");
