/**
 * Builds the agentic front door and SlidWiki booklets.
 * Does not touch existing product HTML. Run: node scripts/render-platform.mjs
 */
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MARK = `<img src="/assets/logos/logo-slid-phi-labs.jpg?v=14" width="44" height="44" alt="">`;

const NAV = [
  ["/", "Home"],
  ["/wiki", "Wiki"],
  ["/rider", "Rider"],
  ["/cuni", "CuNi"],
  ["/warrant", "Warrant"],
  ["/silesia", "TNSSRC"],
  ["/rcrc", "Previous home"],
];

const FOOT = [
  ["/wiki", "SlidWiki"],
  ["/rcrc", "Previous home"],
  ["/rider", "Rider"],
  ["/cuni", "CuNi"],
  ["/warrant", "Warrant"],
  ["/tollkeeper", "Tollkeeper"],
  ["/chamber", "Chamber"],
  ["/aos-ring", "Ring"],
  ["/x402", "x402"],
  ["/pay", "Pay"],
  ["/awlpay", "AwLPay"],
  ["/pcc", "PCC"],
  ["/trustream", "TRUSTREAM"],
  ["/silesia", "TNSSRC"],
  ["/pulsar", "pulsar"],
  ["/exactodds", "ExactOdds"],
  ["/quikgater", "Quikgater"],
  ["/specialist", "TRU8"],
  ["/agents", "Agents"],
  ["/humans", "Humans"],
  ["/products", "Products"],
  ["/pricing", "Pricing"],
  ["/docs", "Docs"],
  ["/about", "About"],
  ["/npm", "npm"],
  ["/mcp-service", "MCP"],
  ["/box", "Try"],
  ["/bench", "Bench"],
  ["/press", "Press"],
  ["/blog", "Blog"],
  ["/toys", "Experiments"],
  ["/lab-pass", "Lab Pass"],
  ["/license", "License"],
  ["/compare", "Compare"],
  ["/standings", "Standings"],
  ["/demos", "Demos"],
  ["/olympiad", "Olympiad"],
  ["/archive", "Archive"],
  ["/updates", "Updates"],
  ["/pps", "PPS"],
  ["/signup", "Sign up"],
  ["/access", "Access"],
  ["/llms.txt", "llms.txt"],
  ["/ai.txt", "ai.txt"],
  ["/agents.txt", "agents.txt"],
  ["/SKILL.md", "SKILL.md"],
  ["/CUNI-PROTOCOL.md", "CuNi protocol"],
  ["/status", "Status"],
];

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function chrome(here) {
  const links = NAV.map(([href, label]) => {
    const on = href === here;
    return `<a href="${href}"${on ? ' aria-current="page"' : ""}>${label}</a>`;
  }).join("");
  return `<a class="pf-skip" href="#main">Skip to content</a>
<header class="pf-top">
  <div class="pf-bar">
    <a class="pf-brand" href="/">${MARK}<span>Slid Phi Labs</span></a>
    <nav class="pf-nav" aria-label="Primary">${links}</nav>
    <details class="pf-menu">
      <summary>Menu</summary>
      <div class="pf-menu-panel">${links}</div>
    </details>
  </div>
</header>`;
}

function foot() {
  return `<footer class="pf-foot">${FOOT.map(([h, l]) => `<a href="${h}">${l}</a>`).join("")}<p>Slid Phi Labs · Cherry Hill · <a href="mailto:corey@slidphilabs.com">corey@slidphilabs.com</a></p></footer>`;
}

function head({ title, desc, path }) {
  const url = "https://www.slidphilabs.com" + path;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}"/>
  <meta name="theme-color" content="#0f1c2e"/>
  <link rel="canonical" href="${url}"/>
  <link rel="icon" type="image/jpeg" href="/assets/logos/logo-slid-phi-labs.jpg?v=14"/>
  <meta property="og:title" content="${esc(title)}"/>
  <meta property="og:description" content="${esc(desc)}"/>
  <meta property="og:url" content="${url}"/>
  <meta property="og:type" content="article"/>
  <meta property="og:image" content="https://www.slidphilabs.com/assets/now/og.jpg"/>
  <link rel="stylesheet" href="/assets/platform.css?v=2"/>
</head>
<body class="pf">`;
}

function sections(list) {
  return list.map((s) => `<section class="pf-section" id="${s.id}"><h2>${s.h}</h2>${s.body}</section>`).join("\n");
}

function toc(list) {
  return `<nav class="pf-toc" aria-label="On this page"><p class="pf-kicker">On this page</p><ol>${list.map((s) => `<li><a href="#${s.id}">${s.h}</a></li>`).join("")}</ol></nav>`;
}

function write(rel, html) {
  const file = join(ROOT, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
  console.log(rel);
}

const S = (id, h, body) => ({ id, h, body });

const pages = [];

function add(page) {
  pages.push(page);
}

const H = [
  ["is", "What it is"],
  ["how", "How it works"],
  ["get", "What you receive"],
  ["price", "Price"],
  ["with", "Works with"],
  ["open", "Open it"],
];

add({
  slug: "agent-rider", group: "Platform", door: "/rider",
  title: "Agent Rider",
  kicker: "Identity",
  h1: "A signed name for every agent.",
  lede: "Rider registers an agent and mints a short ES256 credential. Any peer checks that signature against the public keys, then checks the public revocation list.",
  summary: "15-minute ES256 credential. Public JWKS. Public revocation.",
  sections: [
    S("is", "What it is", `<p>Agent Rider is the identity door of the lab. You register a seat and receive an <code>agent_id</code> plus a key. When that seat needs to act, Rider mints an ES256 JWT. The token lasts about 15 minutes (<code>expires_in</code> 900). You send it on later calls as <code>X-Agent-Rider</code>.</p><p>L0 is the issued identity. Self-service minting goes through L1. The lab issues L2, L3, and L4. Peers verify the signature locally with the keys at <a href="https://agentrider.fly.dev/.well-known/jwks.json">agentrider.fly.dev/.well-known/jwks.json</a>. When you cancel a credential, its id joins <a href="https://agentrider.fly.dev/.well-known/rider-revocation.json">the public revocation list</a>. Every clearance checks that list. The holder revokes with <code>POST /api/rider/revoke</code>. The JavaScript verifier in <code>@slidphi/agent-rider</code> clears a seat only after it has fetched that list.</p><p>Seats also talk. <code>POST /api/dm</code> delivers a message to another <code>agent_id</code>. The MCP endpoint is <code>POST https://agentrider.fly.dev/api/mcp</code>.</p>`),
    S("how", "How it works", `<ol><li>Register the agent. Keep the API key for that seat.</li><li>Issue a rider. You receive a JWT, the level, the scopes, and the expiry.</li><li>Present <code>X-Agent-Rider</code> to any gate that asks for a name.</li><li>A peer fetches JWKS, checks the ES256 signature, checks expiry, then checks the revocation list.</li></ol><p>A worked check: the verifier confirms the issuer is <code>agentrider.dev</code>, the algorithm is ES256, the signature matches the key id in JWKS, and the <code>jti</code> is absent from the revocation list. That seat is clear to proceed at the level printed in the token.</p>`),
    S("get", "What you receive", `<p>You receive a signed credential with <code>agent_id</code>, <code>operator_id</code>, level, scopes, and <code>jti</code>. You receive a public key set anyone can cache. You receive a revocation list and a revoke route so a cancelled passport stops clearing. The published verifier is the JavaScript package <code>@slidphi/agent-rider</code>.</p>`),
    S("price", "Price", `<p>Human seats run from Solo at $13.31 a month through Fleet at $631 a month. Bundle, Crew, and Shop sit between them on the Rider page. Agents buy through the x402 catalog. Each credential is a fresh 15-minute mint.</p>`),
    S("with", "Works with", `<p>Add <a href="/wiki/warrant">Warrant</a> when the seat needs a mandate and a receipt. Add <a href="/wiki/cuni">CuNi</a> when the job should carry an exactness receipt from Python, Go, and JavaScript. Add <a href="/wiki/chamber">Chamber</a> when a secret needs two keys. <a href="/wiki/tollkeeper">Tollkeeper</a> prices the crossings on this road.</p>`),
    S("open", "Open it", `<p><a href="/rider">Rider page</a> · <a href="https://agentrider.fly.dev/">Open Agent-Rider</a> · <a href="https://agentrider.fly.dev/docs">Walkthrough</a> · <a href="/pay?sku=rider-solo">Solo seat</a></p>`),
  ],
});

add({
  slug: "cuni", group: "Platform", door: "/cuni",
  title: "CuNi",
  kicker: "Exactness",
  h1: "One program. The same stdout. Or a refusal.",
  lede: "CuNi checks one source across a 144-language catalog. Python, Go, and JavaScript must print the same stdout. A seat that would drift refuses.",
  summary: "144 languages. The matching gate is Python, Go, and JavaScript.",
  sections: [
    S("is", "What it is", `<p>CuNi is the exactness tool. You write one <code>.cuni</code> program. The catalog holds 144 languages. The gate that must match is Python, Go, and JavaScript. If those three would print different stdout, CuNi refuses the path and publishes the refusal. Studio is free. Bank takes a paste of N and emits X.</p><p>Native seats on the product page include Python, Go, JavaScript, TypeScript, C, C++, Rust, Ruby, Lua, and Solidity. When Solidity meets a float, a list, or a type outside its model, it refuses. That refusal is the catalog result. Release v0.3.0. Protocol 1.1.1.</p>`),
    S("how", "How it works", `<ol><li>Write the <code>.cuni</code> source once.</li><li>Run the Python, Go, and JavaScript gate when you want those three to match.</li><li>Run the full catalog when you want all 144 seats, including honest refusals.</li><li>Use Bank when you want another catalog id from the same source, then prove it.</li></ol><p><code>POST /api/pass</code> on Studio returns pass or refuse for the three-language gate. The receipt is the answer you keep next to the job.</p>`),
    S("get", "What you receive", `<p>You receive either identical stdout on the seats you asked for, or a refusal that names why the path stopped. You receive a free Studio, a Bank, and a protocol document. A closed-app exception for one product is a separate license.</p>`),
    S("price", "Price", `<p>Studio is free. The closed-app exception is $390 a year, SKU <code>cuni-exception</code>. The open license is AGPL-3.0-or-later.</p>`),
    S("with", "Works with", `<p>Put the receipt beside a <a href="/wiki/agent-rider">Rider</a> job when you want proof the program matched. <a href="/wiki/exactodds">ExactOdds</a> is the same rule on five seats and a pair of dice. Toll 5 on <a href="/wiki/tollkeeper">Tollkeeper</a> is the listed price of selling that check.</p>`),
    S("open", "Open it", `<p><a href="/cuni">CuNi page</a> · <a href="https://cuni-studio.fly.dev/">Studio</a> · <a href="https://cuni-studio.fly.dev/bank">Bank</a> · <a href="https://cuni-studio.fly.dev/.well-known/cuni-protocol.json">Protocol</a></p>`),
  ],
});

add({
  slug: "warrant", group: "Platform", door: "/warrant",
  title: "Warrant",
  kicker: "Mandate",
  h1: "A mandate for the job, and a receipt when it finishes.",
  lede: "Warrant binds hosts, actions, spend, calls, and an expiry to a Rider. After the job, a receipt files what ran.",
  summary: "Signed mandate. Signed receipt. Local verification.",
  sections: [
    S("is", "What it is", `<p>Warrant is the authority tool. A Rider names the agent. A Warrant names the job: which hosts, which actions, how much spend, how many calls, and the expiry. Gates read <code>X-Agent-Rider</code> and <code>X-Agent-Warrant</code>. Checking the signature happens locally.</p><p>The receipt records host, action, hashes, and dollars used. When the mandate expires, or when you revoke it, later calls stop clearing. The first 3 warrants and 10 receipts per operator per day are the free band.</p>`),
    S("how", "How it works", `<ol><li>Issue a Rider for the seat.</li><li>Sign the mandate: hosts, actions, caps, expiry.</li><li>The agent presents both headers.</li><li>The gate checks the signature and the remaining cap.</li><li>The receipt lands with the action, the hashes, and the dollars.</li></ol>`),
    S("get", "What you receive", `<p>You receive a signed mandate you can verify anywhere, and a receipt for each job that ran inside it. You receive a hard stop when the expiry or the cap is reached.</p>`),
    S("price", "Price", `<p>$29 a month or $290 a year. SKUs <code>warrant-month</code> and <code>warrant-year</code>.</p>`),
    S("with", "Works with", `<p>Every Warrant sits on a <a href="/wiki/agent-rider">Rider</a>. A secret that needs two people goes in <a href="/wiki/chamber">Chamber</a> as well: the mandate says who may ask, and the two shares open the seal. Spend quotes live on <a href="/wiki/awlpay">AwLPay</a>.</p>`),
    S("open", "Open it", `<p><a href="/warrant">Warrant page</a> · <a href="/pay?sku=warrant-month">Month</a> · <a href="/pay?sku=warrant-year">Year</a></p>`),
  ],
});

add({
  slug: "tollkeeper", group: "Platform", door: "/tollkeeper",
  title: "Tollkeeper",
  kicker: "Crossings",
  h1: "Seven crossings, each with a price and a receipt.",
  lede: "Tollkeeper is the price sheet on Rider’s road. The caller pays. A cleared crossing returns a signed receipt.",
  summary: "Seven prices. Caller pays. Signed receipt.",
  sections: [
    S("is", "What it is", `<p>Tollkeeper prices the crossings agents make all day: proving an identity, finding a capable agent, moving value through escrow, delegating authority, proving a computation, staking on work, and carrying memory. The caller pays. A clean crossing returns a signed receipt: what, when, how much, for whom. A crossing that stops returns a reason a machine can read.</p>`),
    S("how", "How it works", `<p>You read the price, you present a Rider, you pay the listed amount, you keep the stamp. Local JWKS verification stays free. The first hundred identity checks in a month are free. Listing yourself is free.</p><table><tbody>
<tr><th>Crossing</th><th>Price</th></tr>
<tr><td>Identity check</td><td>$0.005. First 100 a month free. Local JWKS stays free.</td></tr>
<tr><td>Lookup</td><td>$0.02. Listing is free. Promote is listed at $9 a month.</td></tr>
<tr><td>Escrow</td><td>1%.</td></tr>
<tr><td>Grant</td><td>$0.01 to issue. $0.005 to check.</td></tr>
<tr><td>Exactness check</td><td>$0.10.</td></tr>
<tr><td>Bond</td><td>1% at stake.</td></tr>
<tr><td>Memory transfer</td><td>$0.02 hosted. The format is free.</td></tr>
</tbody></table>`),
    S("get", "What you receive", `<p>You receive a public price for each crossing and a signed receipt when that crossing clears. The receipt is the record you keep with the Rider and the Warrant.</p>`),
    S("price", "Price", `<p>The table above is the price list on <a href="/tollkeeper">/tollkeeper</a>. Identity stays cheap on purpose. The money is in the volume of a working road.</p>`),
    S("with", "Works with", `<p>The road is <a href="/wiki/agent-rider">Rider</a>. The exactness check is a <a href="/wiki/cuni">CuNi</a> receipt. The grant matches a <a href="/wiki/warrant">Warrant</a>. Catalog purchases go through <a href="/wiki/x402">x402</a>.</p>`),
    S("open", "Open it", `<p><a href="/tollkeeper">Tollkeeper page</a> · <a href="/wiki/agent-rider">Rider booklet</a> · <a href="/standings">Standings</a></p>`),
  ],
});

add({
  slug: "chamber", group: "Memory and secrets", door: "/chamber",
  title: "Chamber",
  kicker: "Secrets",
  h1: "Two keys. One seal. You keep the blob.",
  lede: "Chamber seals JSON with AES-256-GCM and a two-of-two split. Opening takes both shares. The ciphertext stays with you.",
  summary: "Two shares. You store the blob. $9 or $99.",
  sections: [
    S("is", "What it is", `<p>Chamber is the seal for structured secrets: API keys, webhook URLs, configuration. The cipher is AES-256-GCM. The key is split two-of-two. One share stays sealed. Both shares together open the JSON. You store the blob in your own files. The license you buy is the right to seal new secrets. A blob you already sealed still opens when both keys are present.</p>`),
    S("how", "How it works", `<ol><li>Bring the JSON and both shares to the seal.</li><li>Store the shares apart: two people, or a person and a vault.</li><li>Store the blob wherever you already keep backups.</li><li>Open it when both shares are in the same room again.</li></ol><p>Install <code>@slidphi/json-chamber-mcp</code> or the Python package <a href="https://pypi.org/project/json-chamber/">json-chamber</a>. The older unscoped npm name still installs and points here.</p>`),
    S("get", "What you receive", `<p>You receive a ciphertext you can back up, and two shares that only work as a pair. You receive a license to seal new secrets for the month or the year you bought.</p>`),
    S("price", "Price", `<p>$9 a month or $99 a year. SKUs <code>chamber-month</code> and <code>chamber-year</code>.</p>`),
    S("with", "Works with", `<p>A <a href="/wiki/agent-rider">Rider</a> names who is asking. A <a href="/wiki/warrant">Warrant</a> says they are allowed to ask. The shares still have to meet before the secret opens. <a href="/wiki/lab-pass">Lab Pass</a> bundles a Chamber year with a PCC year.</p>`),
    S("open", "Open it", `<p><a href="/chamber">Chamber page</a> · <a href="https://pypi.org/project/json-chamber/">PyPI</a> · <a href="/pay?sku=chamber-year">Year</a></p>`),
  ],
});

add({
  slug: "aos-ring", group: "Memory and secrets", door: "/aos-ring",
  title: "The Ring",
  kicker: "Memory",
  h1: "Write a pattern. Read the same bits back.",
  lede: "aos-ring is the memory tool. The service writes a pattern and returns those bits on read. The optical story addresses by angle and channels by color.",
  summary: "Bit-identical write and read. Health check on Fly.",
  sections: [
    S("is", "What it is", `<p>The Ring holds working memory for a seat. You write data. You read it back bit-identical. The design addresses by angle and separates channels by color, the way a sustained interference pattern holds a field. The service you call today performs that write and that read. Health is <a href="https://aos-ring.fly.dev/health">aos-ring.fly.dev/health</a>. Source is <a href="https://github.com/ceedot-rock/aos-ring">ceedot-rock/aos-ring</a>.</p>`),
    S("how", "How it works", `<ol><li>Open the health check and confirm the service is up.</li><li>Write a payload.</li><li>Read it back and compare the bytes.</li><li>Drop the pattern when the memory should end.</li></ol><p>The field behaves like RAM. The read is the proof the write landed.</p>`),
    S("get", "What you receive", `<p>You receive a memory you can write, read, and drop, with the same bytes coming back. You receive a public health URL and the source.</p>`),
    S("price", "Price", `<p>The public door is the service linked from the Ring page. Tollkeeper lists hosted memory transfer at $0.02 when you use that crossing.</p>`),
    S("with", "Works with", `<p><a href="/wiki/agent-rider">Rider</a> names the writer. <a href="/wiki/chamber">Chamber</a> seals a secret that must stay split. <a href="/wiki/pcc">PCC</a> packs a file you want to keep smaller than the original.</p>`),
    S("open", "Open it", `<p><a href="/aos-ring">Ring page</a> · <a href="https://aos-ring.fly.dev/health">Health</a> · <a href="https://github.com/ceedot-rock/aos-ring">Source</a></p>`),
  ],
});

add({
  slug: "x402", group: "Pay", door: "/x402",
  title: "x402",
  kicker: "Agent pay",
  h1: "People use Stripe. Agents pay the 402.",
  lede: "x402 is the agent checkout. Post a SKU, receive HTTP 402 with the USDC request, pay on Solana or Base, retry with the payment header.",
  summary: "USDC on Solana or Base. Same catalog as Stripe.",
  sections: [
    S("is", "What it is", `<p>x402 is how an agent buys a lab SKU. The agent posts <code>{"sku":"..."}</code> to <code>/api/x402-products</code>. The lab answers 402 with the accepts list. The agent pays USDC on Solana or Base and retries with <code>X-PAYMENT</code>. The response carries a claim token and an <code>access_url</code>. People use the same catalog through <a href="/pay">Stripe</a>.</p>`),
    S("how", "How it works", `<ol><li>Discover the lab at <a href="/api/agent">GET /api/agent</a>.</li><li>Post the SKU.</li><li>Read the 402 body and pay that USDC request.</li><li>Retry with <code>X-PAYMENT</code>.</li><li>Open <code>access_url</code> or <code>GET /api/access-verify</code>.</li></ol>`),
    S("get", "What you receive", `<p>You receive a 402 you can pay, then a claim that opens the product you bought. The SKU list is the same one humans see on <a href="/pricing">/pricing</a>.</p>`),
    S("price", "Price", `<p>Examples on the catalog: Rider Solo $13.31 a month, Warrant $29 a month or $290 a year, Chamber $9 or $99, CuNi closed-app $390 a year. PCC prices sit on the PCC page. The 402 body is the amount for that request.</p>`),
    S("with", "Works with", `<p>The buyer can carry a <a href="/wiki/agent-rider">Rider</a>. A spend cap is a <a href="/wiki/warrant">Warrant</a>. One page, one fee, is <a href="/wiki/quikgater">Quikgater</a>. Quotes across assets are <a href="/wiki/awlpay">AwLPay</a>.</p>`),
    S("open", "Open it", `<p><a href="/x402">x402 page</a> · <a href="/pay">Human pay</a> · <a href="/pricing">Pricing</a> · <a href="/api/agent">/api/agent</a></p>`),
  ],
});

add({
  slug: "quikgater", group: "Pay", door: "/quikgater",
  title: "Quikgater",
  kicker: "Fetch",
  h1: "Pay for the page. Receive the page.",
  lede: "Quikgater fetches a URL for an agent. The unpaid answer is HTTP 402. The paid answer is the page.",
  summary: "One fetch. One 402. One page back.",
  sections: [
    S("is", "What it is", `<p>Quikgater is pay-per-fetch. An agent asks for a URL. Quikgater answers 402 with the price of that fetch. The agent pays on Base and retries. The worker returns the page. The product page documents the live worker and the Fly render.</p>`),
    S("how", "How it works", `<ol><li>Send the fetch the product page specifies.</li><li>Read the 402 and pay it.</li><li>Retry. Keep the body.</li></ol><p>A 402 here means the fetch has a price. Pay it and the page comes back.</p>`),
    S("get", "What you receive", `<p>You receive the fetched page and a receipt for that payment. The fee is the 402 for the fetch.</p>`),
    S("price", "Price", `<p>The price is the 402 body for that URL. A Rider seat is a separate SKU on <a href="/pricing">/pricing</a>.</p>`),
    S("with", "Works with", `<p>Name the caller with <a href="/wiki/agent-rider">Rider</a>. Buy a catalog SKU with <a href="/wiki/x402">x402</a>. Pack the bytes you keep with <a href="/wiki/pcc">PCC</a>.</p>`),
    S("open", "Open it", `<p><a href="/quikgater">Quikgater page</a> · <a href="/wiki/x402">x402 booklet</a></p>`),
  ],
});

add({
  slug: "awlpay", group: "Pay", door: "/awlpay",
  title: "AwLPay",
  kicker: "Quotes",
  h1: "Quote the asset. Lock the fee. Name the rail.",
  lede: "AwLPay prices a payment from public prints, locks a platform fee, and names the rail. A quote that fails the book returns a reason.",
  summary: "1% + $0.25, Pro $39, L33t $799. Quotes from public prints.",
  sections: [
    S("is", "What it is", `<p>AwLPay is the quote tool for a payment that may start in one asset and be understood in another. It reads public last-trade prints, locks the platform fee, and names the rail: spot, obscure, credit, or debit. Each rail has its own route fee. The free tier is 1% plus $0.25. Pro is $39 a month. L33t is $799 a month. A quote returns a reason when the book has no price, when the feeds disagree, or when the fees would eat the payment.</p><p>The quote you can run is that book: a price, a fee, and a reason when it stops. People who need a captured charge today use <a href="/pay">Stripe</a>. Agents who need a captured USDC charge use <a href="/wiki/x402">x402</a>.</p>`),
    S("how", "How it works", `<ol><li>Name the asset and the amount.</li><li>AwLPay reads the prints and builds a quote.</li><li>The quote returns the platform fee, the route fee, and the rail.</li><li>A quote that fails the book returns the reason.</li></ol><p>An agent session in the design lasts about 15 minutes and holds one settle, matching a Rider mint. The long-term secret in that design is a Chamber split. The cap is a Warrant.</p>`),
    S("get", "What you receive", `<p>You receive a quote with a locked fee and a named rail, or a refusal that says why the book stopped. You receive the fee table: 1% + $0.25, Pro $39 a month, L33t $799 a month.</p>`),
    S("price", "Price", `<p>Free tier 1% + $0.25. Pro $39 a month. L33t $799 a month. Route fees sit on top of the platform fee and are part of the quote.</p>`),
    S("with", "Works with", `<p>The 15-minute session matches a <a href="/wiki/agent-rider">Rider</a>. The split secret matches <a href="/wiki/chamber">Chamber</a>. The spend cap matches <a href="/wiki/warrant">Warrant</a>. A captured agent payment matches <a href="/wiki/x402">x402</a>.</p>`),
    S("open", "Open it", `<p><a href="/awlpay">AwLPay page</a> · <a href="/pay">Stripe</a> · <a href="/wiki/x402">x402</a></p>`),
  ],
});

add({
  slug: "tnssrc", group: "Engines", door: "/silesia",
  title: "TNSSRC",
  kicker: "Local engine",
  h1: "Compress the file where it sits. Restore every byte.",
  lede: "TNSSRC runs on your machine. The products page stamps Silesia at 43,724,575 bytes, 12 of 12 decoded, with SHA-256.",
  summary: "Local. 43,724,575 bytes. 12/12 decode.",
  sections: [
    S("is", "What it is", `<p>TNSSRC is TriNeural Shared Spine Row Compression. You run it where the bytes stay. The products page records Silesia at 43,724,575 bytes, 12 of 12 files decoded, with SHA-256. The hosted PCC stamp is a different measurement: 51,498,645. Each number belongs to its own engine. The board that shows both is <a href="/silesia">/silesia</a>.</p>`),
    S("how", "How it works", `<ol><li>Read the Silesia board for the matrix you want to compare.</li><li>Run the local engine on the files you hold.</li><li>Decode and check the hash.</li><li>Use PCC when the file should be packed on the hosted seat instead.</li></ol>`),
    S("get", "What you receive", `<p>You receive a local pack, a decode, and a published stamp: 43,724,575 bytes on that Silesia run, 12/12. The open path is AGPL. The grant is the paid license.</p>`),
    S("price", "Price", `<p>AGPL at $0. Grant at $390 a year. A bake-off on a PCC seat is listed at $19.31 a month on the products page. Confirm on <a href="/products">/products</a>.</p>`),
    S("with", "Works with", `<p><a href="/wiki/pcc">PCC</a> is the hosted seat. <a href="/wiki/pulsar">pulsar</a> is the free demo binary. <a href="/wiki/cuni">CuNi</a> checks that a pathway prints the same stdout on the languages it claims.</p>`),
    S("open", "Open it", `<p><a href="/silesia">Board</a> · <a href="/products">Products</a> · <a href="/compare">Compare</a></p>`),
  ],
});

add({
  slug: "pcc", group: "Engines", door: "/pcc",
  title: "PCC",
  kicker: "Hosted compression",
  h1: "Send the file. Receive the smaller copy. Restore every byte.",
  lede: "PCC is the hosted lossless compressor. Official Silesia 12 packs to 51,498,645 bytes. Decode returns the original.",
  summary: "Hosted lossless. Silesia 51,498,645. Every byte back.",
  sections: [
    S("is", "What it is", `<p>PCC takes a file and returns a smaller copy that restores the original. The spine packs a row only when the packed form is strictly shorter. Otherwise it stores the original raw. Decode returns every byte. On the official Silesia 12, the PCC packed size is 51,498,645. gzip-9 on that corpus is larger.</p><p>You reach it from the website, from <code>POST /api/compress</code> and <code>POST /api/decompress</code>, from <code>@slidphi/spl-pay-per-suite</code>, and from <code>POST /mcp</code> on this site. The specialist bench is <a href="/specialist">/specialist</a>.</p>`),
    S("how", "How it works", `<ol><li>Send the bytes to the hosted compressor.</li><li>Keep the packed copy.</li><li>Decompress when you need the original.</li><li>Compare the restored bytes to the file you sent.</li></ol><p>A Rider, when you want a named caller, is minted separately and sent as <code>X-Agent-Rider</code>.</p>`),
    S("get", "What you receive", `<p>You receive a packed file and a decode that restores the original. You receive the official Silesia number 51,498,645 as the hosted stamp. The local engine publishes its own stamp on the TNSSRC booklet.</p>`),
    S("price", "Price", `<p>The PCC page lists Pro and the usage meter. Humans pay on Stripe. Agents pay the x402 SKU. Read <a href="/pricing">/pricing</a> for the current numbers.</p>`),
    S("with", "Works with", `<p><a href="/wiki/trustream">TRUSTREAM</a> packs live tiles on the same plan. <a href="/wiki/tnssrc">TNSSRC</a> is the local engine. <a href="/wiki/pulsar">pulsar</a> is the free binary you run yourself. <a href="/wiki/tru8">TRU8</a> packs zeros. <a href="/wiki/lab-pass">Lab Pass</a> bundles a PCC year with Chamber.</p>`),
    S("open", "Open it", `<p><a href="/pcc">PCC page</a> · <a href="/silesia">Silesia board</a> · <a href="/bench">Bench</a> · <a href="/docs">API</a></p>`),
  ],
});

add({
  slug: "trustream", group: "Engines", door: "/trustream",
  title: "TRUSTREAM",
  kicker: "Live logs",
  h1: "Pack the stream as the tiles arrive.",
  lede: "TRUSTREAM cuts a live log into 4 KiB tiles on your PCC plan. Quiet tiles shrink. The original stream comes back.",
  summary: "4 KiB tiles. Included with PCC.",
  sections: [
    S("is", "What it is", `<p>TRUSTREAM is the live-log compressor on a PCC seat. Agent traces, SIEM lines, and telemetry arrive as a stream. TRUSTREAM slices that stream into 4 KiB tiles. Quiet tiles shrink. High-entropy tiles stay at their own size, stored as they are, so the stream stays honest. Restore returns the original bytes in order.</p>`),
    S("how", "How it works", `<ol><li>Open a PCC seat.</li><li>Point the live source at the TRUSTREAM door on the product page.</li><li>Keep the packed tiles.</li><li>Restore the stream when you need the original lines.</li></ol>`),
    S("get", "What you receive", `<p>You receive a smaller stream where the data allowed it, and a restore of the original stream. The seat is the PCC plan you already hold.</p>`),
    S("price", "Price", `<p>TRUSTREAM is included with PCC. The meter is the PCC meter on <a href="/pricing">/pricing</a>.</p>`),
    S("with", "Works with", `<p>Files go to <a href="/wiki/pcc">PCC</a>. The sender’s name is a <a href="/wiki/agent-rider">Rider</a>. A secret inside the log can be sealed with <a href="/wiki/chamber">Chamber</a> before it hits the stream.</p>`),
    S("open", "Open it", `<p><a href="/trustream">TRUSTREAM page</a> · <a href="/pcc">PCC</a></p>`),
  ],
});

add({
  slug: "pulsar", group: "Engines", door: "/pulsar",
  title: "pulsar",
  kicker: "Free binary",
  h1: "A free lossless compressor you run yourself.",
  lede: "pulsar 2.5.0 ships as a Linux binary and source. You compress on your machine. You restore on your machine.",
  summary: "GPLv3. Linux binary and source.",
  sections: [
    S("is", "What it is", `<p>pulsar is the free lossless compressor. Version 2.5.0 ships as a Linux binary and as source under GPLv3. You run it. The file stays on your machine. PCC is the hosted compressor when you want the lab to pack the file. pulsar is the one you pack yourself.</p>`),
    S("how", "How it works", `<ol><li>Download the binary from the pulsar page.</li><li>Compress a file you control.</li><li>Restore it and compare the bytes.</li></ol>`),
    S("get", "What you receive", `<p>You receive a packed file and a restore, with the source you can read. A closed embed is the paid exception listed on the product page.</p>`),
    S("price", "Price", `<p>The binary and source are free, GPLv3. The closed-embed price is the one printed on <a href="/pulsar">/pulsar</a>.</p>`),
    S("with", "Works with", `<p>Hosted packs go to <a href="/wiki/pcc">PCC</a>. The local grant engine is <a href="/wiki/tnssrc">TNSSRC</a>.</p>`),
    S("open", "Open it", `<p><a href="/pulsar">pulsar page</a></p>`),
  ],
});

add({
  slug: "tru8", group: "Engines", door: "/specialist",
  title: "TRU8",
  kicker: "Zeros",
  h1: "A million zeros, packed to 8 bytes, every zero restored.",
  lede: "TRU8 is the zeros specialist. A run of zeros packs tight and restores the same run.",
  summary: "Zeros in. 8 bytes for a million zeros. Zeros back.",
  sections: [
    S("is", "What it is", `<p>TRU8 packs all-zero data. The public specialist shows 1,000,000 zeros becoming 8 bytes and restoring every zero. Mixed files go to PCC. The site path <code>/tru8</code> opens <a href="/specialist">/specialist</a>. The package is <code>@slidphi/tru8</code>. <code>@cptasz13/tru8</code> still installs and points here.</p>`),
    S("how", "How it works", `<ol><li>Hand the zeros specialist a zero payload.</li><li>Keep the 8-byte pack for a million zeros, or the pack size your payload produces.</li><li>Restore and count the zeros.</li></ol>`),
    S("get", "What you receive", `<p>You receive a tiny pack and a restore of every zero you sent. You receive the npm package under <code>@slidphi/tru8</code>.</p>`),
    S("price", "Price", `<p>The specialist page and <a href="/pricing">/pricing</a> list the seat. The package itself is public.</p>`),
    S("with", "Works with", `<p><a href="/wiki/pcc">PCC</a> packs a general file. <a href="/wiki/trustream">TRUSTREAM</a> packs a live tile. TRU8 packs the zeros.</p>`),
    S("open", "Open it", `<p><a href="/specialist">Specialist</a> · <a href="/npm">npm</a></p>`),
  ],
});

add({
  slug: "exactodds", group: "Lab bench", door: "/exactodds",
  title: "ExactOdds",
  kicker: "Dice",
  h1: "Reference dice that print the same bytes on five seats.",
  lede: "ExactOdds is the open dice and coin flip. Python, JavaScript, TypeScript, C, and C++ print the same result.",
  summary: "Five seats. Identical bytes. AGPL plus commercial.",
  sections: [
    S("is", "What it is", `<p>ExactOdds publishes a reference die and a reference coin. Five seats run them: Python, JavaScript, TypeScript, C, and C++. The bytes match. The license on the page is AGPL-3.0 plus commercial. Packages: <code>@slidphi/exactodds</code> and <code>@slidphi/exactodds-mcp</code>. The unscoped names still install and point here.</p>`),
    S("how", "How it works", `<ol><li>Install <code>@slidphi/exactodds</code>.</li><li>Roll the reference die on two seats.</li><li>Compare the bytes.</li></ol><p>Matching bytes are the result. The gate is the product.</p>`),
    S("get", "What you receive", `<p>You receive source that prints the same roll on each of the five seats, and an MCP server for that roll.</p>`),
    S("price", "Price", `<p>The open-source package is public. A commercial license is the dual-license note on <a href="/exactodds">/exactodds</a>.</p>`),
    S("with", "Works with", `<p>The 144-language catalog is <a href="/wiki/cuni">CuNi</a>. A named player is a <a href="/wiki/agent-rider">Rider</a>.</p>`),
    S("open", "Open it", `<p><a href="/exactodds">ExactOdds page</a> · <a href="/wiki/cuni">CuNi booklet</a></p>`),
  ],
});

add({
  slug: "packages", group: "Lab bench", door: "/npm",
  title: "Packages",
  kicker: "npm",
  h1: "Install the lab from @slidphi.",
  lede: "The public packages live under the slidphi org. The older names still install and carry a moved-to note.",
  summary: "Scope @slidphi. Old names still install.",
  sections: [
    S("is", "What it is", `<p>The npm org is <code>slidphi</code>. The publishing account is <code>cptasz13</code>. New installs use the scoped name. The packages you can install today:</p><ul><li><code>@slidphi/agent-rider</code> verifies a credential.</li><li><code>@slidphi/json-chamber-mcp</code> seals JSON.</li><li><code>@slidphi/exactodds</code> and <code>@slidphi/exactodds-mcp</code> roll the reference dice.</li><li><code>@slidphi/spl-pay-per-suite</code> calls hosted PCC.</li><li><code>@slidphi/tru8</code> packs zeros.</li><li><code>@slidphi/slidphilabs</code> is the lab client.</li><li><code>@slidphi/blackjack-compression</code>, <code>@slidphi/zero-range-wave-compression</code>, <code>@slidphi/shard-zip</code>, <code>@slidphi/shard-tsdb</code>, and <code>@slidphi/residual-governance</code> are the rest of the shelf.</li></ul><p><code>@slidphi/shard-zip</code> loads as CommonJS and round-trips an array. The zero-range and residual packages install as the public stubs and tell you the commercial engine stays licensed.</p>`),
    S("how", "How it works", `<p class="pf-fact">npm install @slidphi/agent-rider</p><p>Use the scoped name in anything new. An old install keeps resolving. Its deprecation text points at the scoped package.</p>`),
    S("get", "What you receive", `<p>You receive a public package at the same version the old name published, under a name the org owns.</p>`),
    S("price", "Price", `<p>The packages are public. Seats and meters are the SKUs on <a href="/pricing">/pricing</a>.</p>`),
    S("with", "Works with", `<p>Identity client: <a href="/wiki/agent-rider">Rider</a>. Seal client: <a href="/wiki/chamber">Chamber</a>. Hosted compressor client: <a href="/wiki/pcc">PCC</a>.</p>`),
    S("open", "Open it", `<p><a href="/npm">npm page</a> · <a href="https://www.npmjs.com/package/@slidphi/agent-rider">@slidphi/agent-rider</a></p>`),
  ],
});

add({
  slug: "lab-pass", group: "Lab bench", door: "/lab-pass",
  title: "Lab Pass",
  kicker: "Bundle",
  h1: "A year of Chamber and a year of PCC.",
  lede: "Lab Pass is one $490 payment for 365 days of Chamber and PCC together.",
  summary: "$490 a year. Chamber year plus PCC year.",
  sections: [
    S("is", "What it is", `<p>Lab Pass is the annual bundle. One payment covers a Chamber year and a PCC year. Chamber alone is $99 for the year. PCC’s year seat is listed on its own page. The pass puts them on one checkout: <a href="/pay?sku=lab-pass">/pay?sku=lab-pass</a>. A Rider seat stays its own purchase, from Solo at $13.31.</p>`),
    S("how", "How it works", `<ol><li>Open the Lab Pass page.</li><li>Pay the $490 year on Stripe.</li><li>Seal secrets with Chamber and pack files with PCC for the 365 days.</li></ol>`),
    S("get", "What you receive", `<p>You receive a year of new Chamber seals and a year of hosted PCC. After the year, the pass page says the box closes.</p>`),
    S("price", "Price", `<p>$490 a year. SKU <code>lab-pass</code>.</p>`),
    S("with", "Works with", `<p>The two tools inside the pass are <a href="/wiki/chamber">Chamber</a> and <a href="/wiki/pcc">PCC</a>. Add a <a href="/wiki/agent-rider">Rider</a> when you want a signed seat.</p>`),
    S("open", "Open it", `<p><a href="/lab-pass">Lab Pass page</a> · <a href="/pricing">Pricing</a></p>`),
  ],
});

const GROUPS = ["Platform", "Pay", "Memory and secrets", "Engines", "Lab bench"];

function renderBook(page) {
  const list = H.map(([id]) => page.sections.find((s) => s.id === id)).filter(Boolean);
  const path = "/wiki/" + page.slug;
  const html = `${head({ title: page.title + " · SlidWiki", desc: page.lede, path })}
${chrome("/wiki")}
<main class="pf-wrap" id="main">
  <p class="pf-kicker">${page.kicker} · SlidWiki</p>
  <div class="pf-layout">
    ${toc(list)}
    <article>
      <h1>${page.h1}</h1>
      <p class="pf-lede">${page.lede}</p>
      <p class="pf-actions"><a class="pf-btn pf-btn-solid" href="${page.door}">Open the tool</a><a class="pf-btn pf-btn-line" href="/wiki">All booklets</a></p>
      ${sections(list)}
    </article>
  </div>
</main>
${foot()}
</body></html>
`;
  write("wiki/" + page.slug + ".html", html);
}

function renderIndex() {
  const blocks = GROUPS.map((g) => {
    const items = pages.filter((p) => p.group === g).map((p) =>
      `<li><a href="/wiki/${p.slug}"><strong>${esc(p.title)}</strong><span>${esc(p.summary)}</span></a></li>`
    ).join("");
    return `<section><h2>${g}</h2><ul>${items}</ul></section>`;
  }).join("");
  const html = `${head({
    title: "SlidWiki",
    desc: "A booklet for every Slid Phi Labs tool. What it is, how it works, what you receive, and what it costs.",
    path: "/wiki",
  })}
${chrome("/wiki")}
<main class="pf-wrap" id="main">
  <p class="pf-kicker">SlidWiki</p>
  <h1>One booklet for each tool.</h1>
  <p class="pf-lede">Each page explains the tool: what it is, how it runs, what you receive, and what it costs. The short product pages stay where they are. The previous front door stays at <a href="/rcrc">/rcrc</a>.</p>
  <div class="pf-index">${blocks}</div>
</main>
${foot()}
</body></html>
`;
  write("wiki/index.html", html);
}

function renderHome() {
  const html = `${head({
    title: "Slid Phi Labs — signed agents, exact programs",
    desc: "Rider gives an agent a signed name. CuNi checks that one program prints the same result in Python, Go, and JavaScript. Warrant writes the permission and the receipt.",
    path: "/",
  })}
${chrome("/")}
<main class="pf-wrap" id="main">
  <section class="pf-hero">
    <img class="pf-logo" src="/assets/logos/logo-slid-phi-labs.jpg?v=14" width="1024" height="1024" alt="Slid Phi Labs" fetchpriority="high">
    <p class="pf-kicker">Slid Phi Labs · Cherry Hill</p>
    <h1>Signed seats. Exact programs. Receipts.</h1>
    <p class="pf-lede">Rider gives an agent a signed name for about fifteen minutes. Anyone can check it on the public keys. CuNi takes one program and checks that Python, Go, and JavaScript print the same stdout. Warrant writes what the agent may do, then files the receipt when it does.</p>
    <p class="pf-actions">
      <a class="pf-btn pf-btn-solid" href="/wiki/agent-rider">Read Rider</a>
      <a class="pf-btn pf-btn-line" href="/wiki">Open SlidWiki</a>
    </p>
    <p class="pf-fact">ES256 · about 15 minutes · L0 issued identity · CuNi gate py / go / js · Studio free</p>
  </section>
  <section class="pf-lanes" aria-label="Platform">
    <article class="pf-lane">
      <p class="pf-kicker">01 · Identity</p>
      <h2>Rider</h2>
      <p>Register a seat. Mint a credential. Peers verify it on the public keys and the public revocation list.</p>
      <p class="pf-fact">agentrider.fly.dev</p>
      <p><a href="/wiki/agent-rider">Booklet</a> · <a href="/rider">Open Rider</a></p>
    </article>
    <article class="pf-lane">
      <p class="pf-kicker">02 · Exactness</p>
      <h2>CuNi</h2>
      <p>One source. 144 languages in the catalog. Python, Go, and JavaScript print the same stdout, or the path refuses.</p>
      <p class="pf-fact">Studio is free · v0.3.0</p>
      <p><a href="/wiki/cuni">Booklet</a> · <a href="/cuni">Open CuNi</a></p>
    </article>
    <article class="pf-lane">
      <p class="pf-kicker">03 · Receipts</p>
      <h2>Warrant</h2>
      <p>Hosts, actions, spend, calls, expiry. Then a receipt with the hashes and the dollars.</p>
      <p class="pf-fact">$29 / mo · $290 / yr</p>
      <p><a href="/wiki/warrant">Booklet</a> · <a href="/warrant">Open Warrant</a></p>
    </article>
  </section>
  <section>
    <h2>Connected tools</h2>
    <div class="pf-lanes">
      <article class="pf-lane">
        <p class="pf-kicker">Secrets</p>
        <h2>Chamber</h2>
        <p>Two keys seal the JSON. You keep the blob. Both shares open it.</p>
        <p><a href="/wiki/chamber">Booklet</a></p>
      </article>
      <article class="pf-lane">
        <p class="pf-kicker">Memory</p>
        <h2>The Ring</h2>
        <p>Write a pattern. Read the same bits back.</p>
        <p><a href="/wiki/aos-ring">Booklet</a></p>
      </article>
      <article class="pf-lane">
        <p class="pf-kicker">Pay</p>
        <h2>Stripe, x402, Tollkeeper</h2>
        <p>People check out on Stripe. Agents pay a 402 in USDC. Tollkeeper prices seven crossings and stamps a receipt.</p>
        <p><a href="/wiki/x402">x402</a> · <a href="/wiki/tollkeeper">Tolls</a> · <a href="/wiki/awlpay">AwLPay</a></p>
      </article>
    </div>
  </section>
  <section class="pf-shelf" id="engines">
    <p class="pf-kicker">Compression</p>
    <h2>Shrink the file. Get every byte back.</h2>
    <div class="pf-engines">
      <a href="/wiki/tnssrc"><strong>TNSSRC</strong><span>On your machine. Silesia 43,724,575, 12 of 12 back.</span></a>
      <a href="/wiki/pcc"><strong>PCC</strong><span>On our machines. Silesia 51,498,645.</span></a>
      <a href="/wiki/trustream"><strong>TRUSTREAM</strong><span>A live log, packed as it is written.</span></a>
      <a href="/wiki/pulsar"><strong>pulsar</strong><span>Free binary you run yourself.</span></a>
      <a href="/wiki/tru8"><strong>TRU8</strong><span>A million zeros, eight bytes.</span></a>
    </div>
  </section>
  <p class="pf-lede">The previous front door is kept at <a href="/rcrc">/rcrc</a>. Also <a href="/agents">agents</a>, <a href="/humans">humans</a>, <a href="/pay">pay</a>, <a href="/products">products</a>, <a href="/pricing">pricing</a>, <a href="/about">about</a>, <a href="/silesia">Silesia</a>, <a href="/lab-pass">Lab Pass</a>.</p>
</main>
${foot()}
</body></html>
`;
  write("index.html", html);
}

for (const page of pages) renderBook(page);
renderIndex();
renderHome();
console.log("pages", pages.length);
