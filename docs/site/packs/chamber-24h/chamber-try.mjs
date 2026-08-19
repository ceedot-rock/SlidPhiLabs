#!/usr/bin/env node
/** Chamber try — 24h box. Seal a note with Web Crypto-equivalent XOR demo + live box check. */
const BASE = process.env.SPL_HOST || "https://www.slidphilabs.com";

const r = await fetch(BASE + "/api/box");
const box = await r.json();
console.log("box", box.protocol, "open", box.box_open, "hours_left", box.hours_left);
if (!box.box_open && box.door === "gated") {
  console.error("Box closed. Buy Chamber: https://buy.stripe.com/dRmeVeaZv7dm99rcwM6wE0F");
  process.exit(3);
}
const open = await fetch(BASE + "/api/box", { method: "POST" });
const g = await open.json();
console.log("opened", g.ok, g.hours_left, "h left");
console.log("Chamber try is the cloak door. Production seal is the paid seat.");
console.log("Next: https://www.slidphilabs.com/chamber");
