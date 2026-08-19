#!/usr/bin/env node
/** TRU8 try — 24h box. Hits the live codec rail. */
const BASE = process.env.SPL_HOST || "https://www.slidphilabs.com";

const open = await fetch(BASE + "/api/box", { method: "POST" });
const g = await open.json();
if (!g.ok) {
  console.error(g.error || "box closed", g.buy);
  process.exit(3);
}
const cookie = open.headers.get("set-cookie") || "";

const zeros = await fetch(BASE + "/api/compress", {
  method: "POST",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify({ corpus: "zeros", n: 10000 }),
});
const zj = await zeros.json();
console.log("zeros", zeros.status, "packed", zj.packed_bytes ?? zj.zrw_bytes, "method", zj.method, "flagship", zj.claim_check);

const text = await fetch(BASE + "/api/compress", {
  method: "POST",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify({ corpus: "text", text: "the cat sat on the mat. ".repeat(40) }),
});
const tj = await text.json();
console.log("text", text.status, "raw", tj.raw_bytes, "packed", tj.packed_bytes, "method", tj.method);

if (zj.packed_b64) {
  const back = await fetch(BASE + "/api/decompress", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ packed_b64: zj.packed_b64 }),
  });
  const dj = await back.json();
  console.log("decode zeros", back.status, "raw_bytes", dj.raw_bytes);
}

if (!(zj.claim_check && zj.claim_check.matches_flagship_8b_on_10k)) {
  console.error("flagship miss — 10k zeros should pack to 8 B");
  process.exit(2);
}
console.log("hours_left", g.hours_left);
console.log("Powered by TRU8 · Slid Phi Labs");
console.log("TRU8 Year $990 → https://buy.stripe.com/dRmaEY6Jf1T23P78gw6wE0E");
