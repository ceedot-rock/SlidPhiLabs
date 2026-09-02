/** Public lab catalogs for hosted MCP. No engine bytes. */
const SITE = "https://www.slidphilabs.com";

export const CATALOGS = [
  {
    id: "sku",
    title: "SKU / price",
    entries: [
      { id: "cuni", name: "CuNi Studio", price: "$0", note: "Write once — Python, Go, JS match or refuse.", url: "https://cuni-studio.fly.dev/", related: ["license", "cuni"] },
      { id: "cuni-exception", name: "CuNi closed-app exception", price: "$490/yr", note: "SKU to ship closed. Public tree stays GPLv3.", url: SITE + "/pay?sku=cuni-exception", related: ["license"] },
      { id: "chamber-month", name: "Chamber month", price: "$49/mo", note: "Two-key JSON seat.", url: SITE + "/chamber", related: ["chamber", "box"] },
      { id: "chamber-year", name: "Chamber year", price: "$490/yr", note: "Two-key JSON seat.", url: SITE + "/pay?sku=chamber-year", related: ["chamber"] },
      { id: "gc-day", name: "AWARE day", price: "$9", note: "Combined GC behind access.", url: SITE + "/gc", related: ["aware"] },
      { id: "gc-month", name: "AWARE month", price: "$49/mo", url: SITE + "/gc", related: ["aware"] },
      { id: "gc-year", name: "AWARE year", price: "$490/yr", url: SITE + "/gc", related: ["aware", "pulsar"] },
      { id: "rider-month", name: "Rider Team month", price: "$79/mo", url: "https://agentrider.fly.dev/", related: ["rider"] },
      { id: "rider-year", name: "Rider Team year", price: "$790/yr", url: "https://agentrider.fly.dev/", related: ["rider"] },
      { id: "suite", name: "Suite", price: "6.9 GB / 3 h then ~5¢/GB", url: SITE + "/pps", related: ["aware", "rail"] },
      { id: "lab-pass", name: "Lab Pass", price: "$1,088/yr", url: SITE + "/lab-pass", related: ["chamber", "aware"] },
      { id: "trugame", name: "TruGame", price: "$12/mo · $79/yr", url: SITE + "/trugame", related: ["sku"] },
    ],
  },
  {
    id: "license",
    title: "License",
    entries: [
      { id: "gplv3", name: "Public GPLv3", note: "CuNi and pulsar public trees. Libraries stay copyleft.", url: SITE + "/licensing.json" },
      { id: "seat", name: "Hosted seat", note: "Access, not a grant of the engine.", url: SITE + "/licensing.json" },
      { id: "exception", name: "Closed-app exception", note: "Written license. $490/yr. SKU cuni-exception.", url: SITE + "/pay?sku=cuni-exception" },
    ],
  },
  {
    id: "surface",
    title: "Surface",
    entries: [
      { id: "lab", name: "www.slidphilabs.com", url: SITE, note: "Lab rails. Fly disk." },
      { id: "studio", name: "cuni-studio.fly.dev", url: "https://cuni-studio.fly.dev/", note: "Free exactness playground." },
      { id: "rider", name: "agentrider.fly.dev", url: "https://agentrider.fly.dev/", note: "Signed agent identity." },
      { id: "teachaid", name: "teachaid.fly.dev", url: "https://teachaid.fly.dev/", note: "Personal teacher surface." },
      { id: "mcp", name: "/mcp", url: SITE + "/mcp", note: "This server." },
    ],
  },
  {
    id: "cuni",
    title: "CuNi exactness",
    entries: [
      { id: "law", name: "Exactness law", note: "Same source. Python, Go, JS stdout match or refuse.", url: "https://cuni-studio.fly.dev/" },
      { id: "check", name: "cuni check", note: "The gate. Nothing publishes on FAIL.", url: "https://github.com/ceedot-rock/cuni" },
      { id: "spend", name: "spend-control.cuni", note: "Flagship example loaded in Studio.", url: "https://cuni-studio.fly.dev/" },
    ],
  },
  {
    id: "chamber",
    title: "Chamber",
    entries: [
      { id: "seal", name: "Two-key JSON", note: "φ-split keyword shares. Not a kernel dump.", url: SITE + "/chamber" },
      { id: "try24", name: "24h box", note: "Try on the box. Then a seat.", url: SITE + "/box" },
    ],
  },
  {
    id: "rider",
    title: "Agent-Rider",
    entries: [
      { id: "issue", name: "Issue rider", note: "POST /api/rider/issue with merchant key.", url: "https://agentrider.fly.dev/docs" },
      { id: "verify", name: "Verify rider", note: "Local, free, no callback.", url: "https://agentrider.fly.dev/demo" },
    ],
  },
  {
    id: "aware",
    title: "AWARE",
    entries: [
      { id: "engine", name: "Combined GC", note: "Adaptive Waveform Archive Restore Engine. Seated. Encoder bytes not in npm.", url: SITE + "/gc" },
      { id: "meter", name: "Suite meter", note: "6.9 GB / 3 h then ~5¢/GB.", url: SITE + "/pps" },
    ],
  },
  {
    id: "pulsar",
    title: "pulsar",
    entries: [
      { id: "cousin", name: "Public cousin", note: "GPLv3 demonstrator. Not Combined GC. Not AWARE. Beats gzip on Silesia. Loses to xz.", url: "https://github.com/ceedot-rock/pulsar-best" },
      { id: "silesia", name: "Silesia 2.5.0", note: "55,745,438 of 211,938,580 raw. vs raw 0.263.", url: SITE + "/" },
    ],
  },
  {
    id: "measure",
    title: "Measure",
    entries: [
      { id: "silesia-gzip9", name: "gzip -9 Silesia", note: "67,631,918 · 0.319" },
      { id: "silesia-pulsar", name: "pulsar 2.5.0 Silesia", note: "55,745,438 · 0.263" },
      { id: "silesia-xz6", name: "xz -6 Silesia", note: "49,408,952 · 0.233" },
    ],
  },
  {
    id: "rail",
    title: "Rail",
    entries: [
      { id: "stripe", name: "Stripe", note: "Humans. Card, Link, Cash App, ACH, Klarna.", url: SITE + "/pay" },
      { id: "x402", name: "x402", note: "Agents. USDC Solana or Base. X-PAYMENT header.", url: SITE + "/api/x402-products" },
    ],
  },
  {
    id: "box",
    title: "Box",
    entries: [
      { id: "law", name: "24h black box", note: "Every product POST is 24h black box, then a paid seat.", url: SITE + "/box" },
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
  return { catalog: id, title: cat.title, q: needle || null, n: hits.length, hits: hits.map((e) => ({ id: e.id, name: e.name, price: e.price, url: e.url })) };
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
      description: c.title + " — free text or code.",
      inputSchema: { type: "object", properties: { q: { type: "string" } } },
    });
    tools.push({
      name: c.id + "_get",
      description: c.title + " — one entry with notes and cross-links.",
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
