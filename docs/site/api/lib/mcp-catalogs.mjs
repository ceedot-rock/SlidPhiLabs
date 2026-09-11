/** Public lab catalogs for hosted MCP. No engine bytes. */
const SITE = "https://www.slidphilabs.com";

export const CATALOGS = [
  {
    id: "sku",
    title: "Prices",
    entries: [
      { id: "cuni", name: "CuNi Studio", price: "$0", note: "Write once. Print many languages. Python, Go, and JS must match, or it refuses. Free playground. v0.1.8.", url: "https://cuni-studio.fly.dev/", related: ["license", "cuni"] },
      { id: "cuni-exception", name: "CuNi closed-app exception", price: "$490/yr", note: "Pay $490/year to ship CuNi inside one closed product. Public tree stays GPLv3.", url: SITE + "/pay?sku=cuni-exception", related: ["license"] },
      { id: "pulsar-exception", name: "pulsar closed-embed exception", price: "$490/yr", note: "Pay $490/year to embed the free GPLv3 compressor in one closed product for one year. Not PCC.", url: SITE + "/pay?sku=pulsar-exception", related: ["license", "pulsar"] },
      { id: "chamber-month", name: "Chamber month", price: "$9/mo", note: "Two-key JSON seal. License to seal new secrets. Open existing seals with both keys, no extra payment.", url: SITE + "/chamber", related: ["chamber", "box"] },
      { id: "chamber-year", name: "Chamber year", price: "$99/yr", note: "Two-key JSON seal. License to seal new secrets for a year. Open existing seals with both keys.", url: SITE + "/pay?sku=chamber-year", related: ["chamber"] },
      { id: "gc-day", name: "PCC day", price: "$9", note: "Hosted lossless compressor for one day. Paid access, no source.", url: SITE + "/gc", related: ["aware"] },
      { id: "gc-month", name: "PCC month", price: "$49/mo", note: "Hosted lossless compressor. 200 GB included, then 8¢/GB. Paid access, no source.", url: SITE + "/gc", related: ["aware"] },
      { id: "gc-year", name: "PCC year", price: "$490/yr", note: "Hosted lossless compressor. 2,000 GB included, then 8¢/GB. Paid access, no source.", url: SITE + "/gc", related: ["aware", "pulsar"] },
      { id: "rider-month", name: "Rider Team month", price: "$79/mo", note: "Signed identity for AI agents, one month.", url: "https://agentrider.fly.dev/", related: ["rider"] },
      { id: "rider-year", name: "Rider Team year", price: "$790/yr", note: "Signed identity for AI agents, one year.", url: "https://agentrider.fly.dev/", related: ["rider"] },
      { id: "rider-ops-month", name: "Rider Ops month", price: "$29/mo", note: "Fleet watch when a signed agent goes quiet. Needs a Rider seat.", url: SITE + "/pay?sku=rider-ops-month", related: ["rider"] },
      { id: "rider-ops-year", name: "Rider Ops year", price: "$290/yr", note: "Fleet watch when a signed agent goes quiet. Needs a Rider seat.", url: SITE + "/pay?sku=rider-ops-year", related: ["rider"] },
      { id: "suite", name: "PCC metered jobs", price: "2 GB/mo free, then 8¢/GB", note: "First 2 GB each month free. Then 8¢ per GB. Month plan includes 200 GB. Compare: /compare. Quote: POST /api/ppp-quote.", url: SITE + "/compare", related: ["aware", "rail"] },
      { id: "lab-pass", name: "Lab Pass", price: "$668/yr", note: "One year of Chamber + PCC + TruGame for $668. Does not include Rider.", url: SITE + "/lab-pass", related: ["chamber", "aware"] },
      { id: "trugame", name: "TruGame", price: "$12/mo · $79/yr", note: "Game-engine seat. Also bundled in Lab Pass.", url: SITE + "/trugame", related: ["sku"] },
      { id: "consulting", name: "Consulting", price: "$250", note: "Two hours of lab time.", url: SITE + "/pay?sku=consulting", related: ["sku"] },
      { id: "oss-support", name: "OSS support", price: "$199", note: "Help with an already-public GPLv3 library. Not a license to embed, and not PCC.", url: SITE + "/pay?sku=oss-support", related: ["npm"] },
    ],
  },
  {
    id: "license",
    title: "License",
    entries: [
      { id: "gplv3", name: "Public GPLv3", note: "CuNi and pulsar are free under GPLv3. Run, study, share. Closed-product embed needs a paid exception.", url: SITE + "/licensing.json" },
      { id: "seat", name: "Hosted seat", note: "You buy the right to run PCC, Chamber, Rider, or Lab Pass. You do not get the production engine.", url: SITE + "/licensing.json" },
      { id: "exception", name: "Closed-app exception", note: "Written license, $490/yr. CuNi: cuni-exception. pulsar: pulsar-exception. One closed product, one year.", url: SITE + "/COMMERCIAL-LICENSE.md" },
    ],
  },
  {
    id: "surface",
    title: "Where to use them",
    entries: [
      { id: "lab", name: "www.slidphilabs.com", url: SITE, note: "Public site, checkout, and APIs." },
      { id: "studio", name: "cuni-studio.fly.dev", url: "https://cuni-studio.fly.dev/", note: "Free CuNi playground. Write once, print many languages. Python, Go, and JS must match, or refuse." },
      { id: "rider", name: "agentrider.fly.dev", url: "https://agentrider.fly.dev/", note: "Signed agent identity. $79/mo · $790/yr on the Labs seat." },
      { id: "teachaid", name: "teachaid.fly.dev", url: "https://teachaid.fly.dev/", note: "Personal teacher surface." },
      { id: "mcp", name: "/mcp", url: SITE + "/mcp", note: "This server. Catalog, prices, and quotes." },
    ],
  },
  {
    id: "cuni",
    title: "CuNi",
    entries: [
      { id: "law", name: "Exactness law", note: "One program. Python, Go, and JS print the same thing, or it refuses to compile. Playground is free.", url: "https://cuni-studio.fly.dev/" },
      { id: "check", name: "cuni check", note: "The gate: nothing publishes on FAIL.", url: "https://github.com/ceedot-rock/cuni" },
      { id: "spend", name: "spend-control.cuni", note: "Flagship example loaded in the free Studio.", url: "https://cuni-studio.fly.dev/" },
    ],
  },
  {
    id: "chamber",
    title: "Chamber",
    entries: [
      { id: "seal", name: "Two-key JSON", note: "Seal a JSON secret with two keys. $9/mo · $99/yr to make new seals. Opening later takes both keys, not another payment.", url: SITE + "/chamber" },
      { id: "try24", name: "24h box", note: "Try Chamber for 24 hours, then buy a seat.", url: SITE + "/box" },
    ],
  },
  {
    id: "rider",
    title: "Agent-Rider",
    entries: [
      { id: "issue", name: "Issue rider", note: "Issue a signed agent credential. POST /api/rider/issue with a merchant key. Team seat $79/mo · $790/yr.", url: "https://agentrider.fly.dev/docs" },
      { id: "verify", name: "Verify rider", note: "Check a credential locally, free, no callback.", url: "https://agentrider.fly.dev/demo" },
    ],
  },
  {
    id: "aware",
    title: "PCC",
    entries: [
      { id: "engine", name: "PCC", note: "Hosted compressor. Files and live 4 KiB pipe, one seat. $9/day · $49/mo · $490/yr. Paid access, no source.", url: SITE + "/gc" },
      { id: "stream", name: "PCC stream", note: "4 KiB ZERO+STORE pipe for agent logs / SIEM. Same PCC seat.", url: SITE + "/trustream" },
      { id: "meter", name: "PCC meter", note: "Billing: 6.9 GB / 3 h unpaid, then ~5¢/GB. Not a fifth product.", url: SITE + "/pps" },
    ],
  },
  {
    id: "pulsar",
    title: "pulsar",
    entries: [
      { id: "cousin", name: "Public compressor", note: "Free GPLv3 lossless compressor. Not PCC. Beats gzip on Silesia. Loses to xz. $490/yr to embed closed.", url: "https://github.com/ceedot-rock/pulsar-best" },
      { id: "exception", name: "Closed-embed exception", note: "$490/yr. SKU pulsar-exception. One closed product, one year. Not the production engine.", url: SITE + "/pay?sku=pulsar-exception" },
      { id: "silesia", name: "Silesia 2.5.0", note: "Measured size: 55,745,438 of 211,938,580 raw bytes. Proof, not a SKU.", url: SITE + "/" },
    ],
  },
  {
    id: "measure",
    title: "How pulsar compares",
    entries: [
      { id: "silesia-gzip9", name: "gzip -9 Silesia", note: "Comparison only — 67,631,918 · 0.319. Not a product we sell." },
      { id: "silesia-pulsar", name: "pulsar 2.5.0 Silesia", note: "Public GPLv3 compressor — 55,745,438 · 0.263. Free to build; $490/yr to embed closed." },
      { id: "silesia-xz6", name: "xz -6 Silesia", note: "Comparison only — 49,408,952 · 0.233. Not a product we sell." },
    ],
  },
  {
    id: "rail",
    title: "How to pay",
    entries: [
      { id: "stripe", name: "Stripe", note: "Humans. Card, Link, Cash App, ACH, Klarna.", url: SITE + "/pay" },
      { id: "x402", name: "x402", note: "Agents. USDC on Solana or Base. X-PAYMENT header.", url: SITE + "/api/x402-products" },
    ],
  },
  {
    id: "box",
    title: "Try",
    entries: [
      { id: "law", name: "24h try", note: "Try a product for 24 hours, then buy a seat.", url: SITE + "/box" },
    ],
  },
  {
    id: "npm",
    title: "npm / public packages",
    entries: [
      { id: "slid-phi", name: "slid-phi", note: "HTTP client + discovery stub. No compressor engine.", url: "https://www.npmjs.com/package/slid-phi" },
      { id: "spl-pay-per-suite", name: "spl-pay-per-suite", note: "Quote helper for metered PCC jobs. Unpaid 6.9 GB / 3 h. No encoder.", url: "https://www.npmjs.com/package/spl-pay-per-suite" },
      { id: "blackjack-compression", name: "blackjack-compression", note: "Public stub. The compressor stays hosted or licensed.", url: "https://www.npmjs.com/package/blackjack-compression" },
      { id: "tru8", name: "@cptasz13/tru8", note: "Zeros demo. 1 000 000 zeros → 8 bytes. Non-zero input is not free — buy PCC.", url: "https://www.npmjs.com/package/@cptasz13/tru8" },
      { id: "shard-zip", name: "shard-zip", note: "Historical GPLv3 package. Not PCC.", url: "https://www.npmjs.com/package/shard-zip" },
      { id: "shard-tsdb", name: "shard-tsdb", note: "Historical GPLv3 package. Not PCC.", url: "https://www.npmjs.com/package/shard-tsdb" },
      { id: "pulsar", name: "pulsar 2.5.0", note: "Not npm. cargo/git GPLv3. Free to build; $490/yr to embed closed. Not PCC.", url: SITE + "/pulsar" },
    ],
  },
  {
    id: "docs",
    title: "Docs",
    entries: [
      { id: "skill", name: "SKILL.md", url: SITE + "/SKILL.md" },
      { id: "llms", name: "llms.txt", url: SITE + "/llms.txt" },
      { id: "card", name: "MCP server card", url: SITE + "/.well-known/mcp/server-card.json" },
      { id: "agent", name: "Platform discovery", url: SITE + "/api/agent" },
      { id: "pricing", name: "pricing.json", url: SITE + "/pricing.json" },
      { id: "licensing", name: "licensing.json", url: SITE + "/licensing.json" },
      { id: "mcp-service", name: "MCP landing", url: SITE + "/mcp-service" },
      { id: "npm", name: "npm catalog", url: SITE + "/npm" },
    ],
  },
];

function hay(e) {
  return [e.id, e.name, e.note, e.price, e.url].filter(Boolean).join(" ").toLowerCase();
}

export function searchCatalog(id, q) {
  const cat = CATALOGS.find((c) => c.id === id);
  if (!cat) return { error: "unknown catalog", id };
  const needle = String(q || "").trim().toLowerCase();
  const hits = !needle ? cat.entries : cat.entries.filter((e) => hay(e).includes(needle));
  return {
    catalog: id,
    title: cat.title,
    q: needle || null,
    n: hits.length,
    hits: hits.map((e) => ({ id: e.id, name: e.name, price: e.price, url: e.url, note: e.note })),
  };
}

export function getCatalog(id, entryId) {
  const cat = CATALOGS.find((c) => c.id === id);
  if (!cat) return { error: "unknown catalog", id };
  const e = cat.entries.find((x) => x.id === entryId);
  if (!e) return { error: "unknown entry", catalog: id, id: entryId, known: cat.entries.map((x) => x.id) };
  return { catalog: id, title: cat.title, ...e };
}

export function catalogTools() {
  const tools = [];
  for (const c of CATALOGS) {
    tools.push({
      name: c.id + "_search",
      description: c.title + " — what it is, what you get, what you pay. Free text or code.",
      inputSchema: { type: "object", properties: { q: { type: "string" } } },
    });
    tools.push({
      name: c.id + "_get",
      description: c.title + " — one entry with notes, price, and links.",
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    });
  }
  return tools;
}

export function dispatchCatalog(name, args = {}) {
  if (name.endsWith("_search")) return searchCatalog(name.slice(0, -7), args.q || args.query || args.code);
  if (name.endsWith("_get")) return getCatalog(name.slice(0, -4), args.id || args.code || args.entry);
  return null;
}
