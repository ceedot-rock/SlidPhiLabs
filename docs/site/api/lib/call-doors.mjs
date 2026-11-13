/**
 * One short name per call that already has an engine.
 * POST /v1/<name>, the MCP tool, and the Python SDK use that name.
 * Prices below are the ones already published. This file adds none.
 */
const DROP = ["payment", "paymentHeader", "api_key", "apiKey", "authorization", "merchant_key", "merchantKey"];

export const SITE_REWRITES = Object.freeze({
  "/v1/compress": "/api/compress",
  "/v1/decompress": "/api/decompress",
  "/v1/zip": "/api/archive",
  "/v1/unzip": "/api/unarchive",
  "/v1/quote": "/api/ppp-quote",
  "/v1/research": "/api/research",
  "/v1/seal": "/api/seal",
  "/v1/open": "/api/open",
  "/v1/fetch": "/api/fetch",
  "/v1/warrant/issue": "/api/warrant/issue",
  "/v1/warrant/verify": "/api/warrant/verify",
  "/v1/warrant/receipt": "/api/warrant/receipt",
  "/v1/warrant/revoke": "/api/warrant/revoke",
  "/v1/warrant/reserve": "/api/warrant/reserve",
  "/v1/warrant/release": "/api/warrant/release",
});

export function siteRewrite(pathname) {
  return SITE_REWRITES[pathname] || null;
}

/** Tollkeeper shelf. Same names as Rider /api/toll/tools/<name>. */
export const TOLL_TOOLS = Object.freeze([
  "pcc-compress",
  "pcc-verify",
  "attest-notarize",
  "attest-exactness",
  "exactodds-draw",
  "exactodds-resolve",
  "cuni-proof",
  "trustream-pack",
  "chamber-seal",
  "awlpay-quote",
]);

/** Flat toll prices in USD, copied from Rider TOOL_PRICE_UUSDC_FLAT. */
export const TOLL_USD = Object.freeze({
  "pcc-verify": "0.02",
  "attest-notarize": "0.01",
  "attest-exactness": "0.05",
  "exactodds-draw": "0.01",
  "exactodds-resolve": "0.02",
  "cuni-proof": "0.10",
  "chamber-seal": "0.02",
  "awlpay-quote": "0.005",
});

export function riderOrigin() {
  return (process.env.RIDER_URL || "https://agentrider.fly.dev").replace(/\/$/, "");
}

export function labOrigin() {
  return (process.env.LAB_AGENT_URL || "https://spl-lab-agent.fly.dev").replace(/\/$/, "");
}

export function siteOrigin() {
  return (process.env.SPL_HOST || "https://www.slidphilabs.com").replace(/\/$/, "");
}

export function workerOrigin() {
  return (process.env.QUIKGATER_WORKER || "https://quikgater-worker.ceedotrock.workers.dev").replace(/\/$/, "");
}

export function tollUrl(name) {
  return `${riderOrigin()}/api/toll/tools/${name}`;
}

const ALIAS = {
  compress: "spl_compress",
  decompress: "spl_decompress",
  zip: "spl_zip",
  unzip: "spl_unzip",
  quote: "spl_quote",
  research: "spl_research",
  warrant_issue: "spl_warrant_issue",
  warrant_verify: "spl_warrant_verify",
  warrant_reserve: "spl_warrant_reserve",
  warrant_release: "spl_warrant_release",
  warrant_receipt: "spl_warrant_receipt",
};

export function aliasTool(name) {
  return ALIAS[name] || null;
}

export const PUBLIC_PATH = Object.freeze({
  seal: "/v1/seal",
  open: "/v1/open",
  research: "/v1/research",
  warrant_issue: "/v1/warrant/issue",
  warrant_verify: "/v1/warrant/verify",
  warrant_reserve: "/v1/warrant/reserve",
  warrant_release: "/v1/warrant/release",
  warrant_receipt: "/v1/warrant/receipt",
  warrant_revoke: "/v1/warrant/revoke",
});

function payProps() {
  return {
    payment: { type: "string", description: "x402 X-PAYMENT. Omit it and a paid door answers 402." },
    api_key: { type: "string", description: "Bearer key or raw key when the door requires a tool credential." },
    authorization: { type: "string", description: "Authorization header when the door is a Tollkeeper tool (Bearer ar_…)." },
  };
}

function tool(name, description, properties, required, mutating) {
  return {
    name,
    description,
    inputSchema: {
      type: "object",
      properties: { ...properties, ...payProps() },
      ...(required && required.length ? { required } : {}),
    },
    annotations: {
      readOnlyHint: !mutating,
      destructiveHint: false,
      idempotentHint: !mutating,
      openWorldHint: true,
    },
  };
}

const str = (description) => ({ type: "string", description });
const num = (description) => ({ type: "number", description });

export const CALL_TOOLS = [
  tool(
    "compress",
    "PCC compress. POST /v1/compress. Same engine as spl_compress. First 1 GB free once per IP, then $0.25/GB. A tool credential is required on the HTTP door. This is not Tollkeeper pcc-compress.",
    { data_b64: str("Base64 bytes to compress.") },
    ["data_b64"],
    false,
  ),
  tool(
    "decompress",
    "PCC decompress. POST /v1/decompress. Restores bytes from compress. Same door as spl_decompress.",
    { packed_b64: str("Base64 packed bytes from compress.") },
    ["packed_b64"],
    false,
  ),
  tool(
    "zip",
    "PCC zip. POST /v1/zip. Packs files into a .pcc archive. Same door as spl_zip and POST /api/archive.",
    { files: { type: "array", description: "Files: path, data_b64, dir." } },
    ["files"],
    false,
  ),
  tool(
    "unzip",
    "PCC unzip. POST /v1/unzip. Restores a .pcc archive. Same door as spl_unzip and POST /api/unarchive.",
    { packed_b64: str("Base64 .pcc archive from zip.") },
    ["packed_b64"],
    false,
  ),
  tool(
    "quote",
    "PCC quote. POST /v1/quote. Free. First 1 GB free once per IP, then $0.25/GB, $1 card minimum. Same price function as spl_quote.",
    {
      bytes: num("Payload bytes."),
      product: str("auto, zrw, blackjack, shard-zip, shard-tsdb, or slid-phi."),
      op: str("compress, decompress, or roundtrip."),
      dataClass: str("Data class, when known."),
    },
    [],
    false,
  ),
  tool(
    "research",
    "Lab web search. POST /v1/research. Same door as spl_research. Refuses when TAVILY_API_KEY is unset. No per-call SKU on this door.",
    {
      query: str("Search query."),
      max_results: num("1-10, default 5."),
      search_depth: str("basic or advanced."),
      include_answer: { type: "boolean" },
    },
    ["query"],
    false,
  ),
  tool(
    "warrant_issue",
    "Warrant issue. POST /v1/warrant/issue. Same door as spl_warrant_issue. The Warrant add-on is the seat. This door adds no per-issue fee.",
    {
      rider: str("Agent-Rider JWT. Required unless demo is true."),
      demo: { type: "boolean", description: "Shape check. Issues nothing billable." },
      actions: { type: "array", items: { type: "string" } },
      allow_hosts: { type: "array", items: { type: "string" } },
      max_usd: num("Spend cap in USD."),
      max_calls: num("Call cap."),
      ttl_seconds: num("Lifetime in seconds."),
    },
    [],
    true,
  ),
  tool(
    "warrant_verify",
    "Warrant verify. POST /v1/warrant/verify. Same door as spl_warrant_verify. Read-only.",
    {
      warrant: str("Warrant token."),
      host: str("Host to check."),
      action: str("Action to check."),
      usd: num("USD to check against the remaining cap."),
    },
    ["warrant"],
    false,
  ),
  tool(
    "warrant_reserve",
    "Warrant reserve. POST /v1/warrant/reserve. Same door as spl_warrant_reserve.",
    { warrant: str("Warrant token."), host: str("Host."), action: str("Action."), usd: num("USD to hold.") },
    ["warrant"],
    true,
  ),
  tool(
    "warrant_release",
    "Warrant release. POST /v1/warrant/release. Same door as spl_warrant_release.",
    { reservation_id: str("Reservation id from warrant_reserve.") },
    ["reservation_id"],
    true,
  ),
  tool(
    "warrant_receipt",
    "Warrant receipt. POST /v1/warrant/receipt. Same door as spl_warrant_receipt.",
    {
      warrant: str("Warrant token."),
      action: str("Action that ran."),
      host: str("Host that was called."),
      usd: num("USD to settle."),
      reservation_id: str("Reservation id, when one was held."),
    },
    ["warrant"],
    true,
  ),
  tool(
    "warrant_revoke",
    "Warrant revoke. POST /v1/warrant/revoke. Same handler as POST /api/warrant/revoke.",
    { warrant: str("Warrant token to revoke.") },
    ["warrant"],
    true,
  ),
  tool(
    "seal",
    "Chamber seal. POST /v1/seal. Library door. Adds no per-seal price. Anonymous HTTP gets 402 until a key or claim. Seats already on the catalog: chamber-month, chamber-year. The metered crossing is chamber-seal at $0.02.",
    {
      obj: { type: "object", description: "JSON value to seal. At least 8 bytes once serialized." },
      key_hex: str("64 hex characters. Never echoed back."),
    },
    ["obj", "key_hex"],
    true,
  ),
  tool(
    "open",
    "Chamber open. POST /v1/open. Free once both keys meet. Wrong key, tampering, and a bad envelope refuse.",
    {
      envelope: { type: "object", description: "Envelope from seal or chamber-seal." },
      key_hex: str("64 hex characters. Never echoed back."),
    },
    ["envelope", "key_hex"],
    false,
  ),
  tool(
    "fetch",
    "Quikgater fetch. POST /v1/fetch. $0.02 per fetch, first 100 a month free, cap default $10. The worker answers 402 when the URL is unpaid.",
    { url: str("http or https URL to fetch.") },
    ["url"],
    true,
  ),
  tool(
    "squeeze",
    "PCCX squeeze. POST /v1/squeeze. SKU lab-squeeze $0.10. Same door as pccx_encode. Pass payment or the lab returns 402.",
    {
      data_b64: str("Base64 payload."),
      source: str("UTF-8 text when data_b64 is omitted."),
    },
    [],
    false,
  ),
  tool(
    "pcc-compress",
    "Tollkeeper pcc-compress. POST /v1/pcc-compress proxies Rider /api/toll/tools/pcc-compress. $0.01 per MB of input, minimum $0.001. Not the suite compress meter.",
    { data_base64: str("Raw input, base64. Max 8MB decoded.") },
    ["data_base64"],
    false,
  ),
  tool(
    "pcc-verify",
    "Tollkeeper pcc-verify. POST /v1/pcc-verify. $0.02 per verification.",
    {
      blob_base64: str("Compressed blob, base64."),
      orig_size: num("Original byte size."),
      expected_sha256: str("Hex SHA-256 of the original bytes."),
    },
    ["blob_base64", "orig_size", "expected_sha256"],
    false,
  ),
  tool(
    "attest-notarize",
    "Tollkeeper attest-notarize. POST /v1/attest-notarize. $0.01 per notarization.",
    { payload: { type: "object", description: "Payload to notarize." } },
    ["payload"],
    true,
  ),
  tool(
    "attest-exactness",
    "Tollkeeper attest-exactness. POST /v1/attest-exactness. $0.05 per check.",
    {
      artifact: { type: "object", description: "Code artifact." },
      claim: { type: "object", description: "Claimed exact output. Requires stdout." },
    },
    ["artifact", "claim"],
    false,
  ),
  tool(
    "exactodds-draw",
    "ExactOdds draw. POST /v1/exactodds-draw. $0.01 per draw.",
    {
      game_id: str("coin-flip, dice, roulette, or crash."),
      draw_id: str("Optional idempotency key."),
      count: num("1 to 100. Default 1."),
    },
    ["game_id"],
    true,
  ),
  tool(
    "exactodds-resolve",
    "ExactOdds resolve. POST /v1/exactodds-resolve. $0.02 per resolution.",
    {
      game_id: str("Game id."),
      draw_id: str("Draw to resolve."),
      stake_cents: num("Optional integer cents."),
    },
    ["game_id", "draw_id"],
    true,
  ),
  tool(
    "cuni-proof",
    "Tollkeeper cuni-proof. POST /v1/cuni-proof. $0.10 per proof. The lab check door is POST /v1/check at $0.05. These are different calls.",
    {
      source: str("CuNi source. Max 64KB."),
      seats: { type: "array", items: { type: "string" }, description: "Optional seat ids." },
    },
    ["source"],
    false,
  ),
  tool(
    "trustream-pack",
    "TRUSTREAM pack. POST /v1/trustream-pack. $0.01 per MB of input, minimum $0.001. TNSSRC encode stays parked. The grant stays a purchase.",
    { data_base64: str("Raw stream bytes, base64. Max 8MB decoded.") },
    ["data_base64"],
    false,
  ),
  tool(
    "chamber-seal",
    "Tollkeeper chamber-seal. POST /v1/chamber-seal. $0.02 per seal. The library door POST /v1/seal adds no per-seal price. The seat is chamber-month or chamber-year.",
    { payload: { type: "object", description: "Payload to seal." } },
    ["payload"],
    true,
  ),
  tool(
    "awlpay-quote",
    "AwLPay quote. POST /v1/awlpay-quote. $0.005 per quote. The 0.5% payment rail is not a separate verb.",
    {
      amount_uusdc: num("Integer micro-USDC. 1 USDC = 1000000."),
      rail: str("tron, bitcoin, lightning, stellar, bsc, or base."),
    },
    ["amount_uusdc", "rail"],
    false,
  ),
];

function payloadOf(args) {
  const body = {};
  for (const [key, value] of Object.entries(args || {})) {
    if (DROP.includes(key)) continue;
    body[key] = value;
  }
  return body;
}

function authHeaders(args) {
  const headers = { "content-type": "application/json" };
  const payment = String((args && (args.payment || args.paymentHeader)) || "");
  if (payment) {
    headers["X-PAYMENT"] = payment;
    headers["payment-signature"] = payment;
  }
  const apiKey = String((args && (args.api_key || args.apiKey)) || "");
  const authorization = String((args && args.authorization) || "");
  if (apiKey) headers.authorization = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
  else if (authorization) headers.authorization = authorization;
  const merchant = String((args && (args.merchant_key || args.merchantKey)) || "");
  if (merchant) headers["x-merchant-key"] = merchant;
  return headers;
}

export async function postJson(url, body, args) {
  const response = await fetch(url, {
    method: "POST",
    headers: authHeaders(args),
    body: JSON.stringify(body == null ? {} : body),
    signal: AbortSignal.timeout(90000),
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text.slice(0, 4000) };
  }
  const paymentHeaders = {};
  for (const name of ["payment-required", "x-payment-required", "payment-response", "x-payment-response"]) {
    const value = response.headers.get(name);
    if (value) paymentHeaders[name] = value;
  }
  const obj = parsed && typeof parsed === "object" ? parsed : { raw: parsed };
  return { ...obj, status: response.status, payment_headers: paymentHeaders };
}

export async function dispatchToll(name, args = {}) {
  if (!TOLL_TOOLS.includes(name)) return null;
  const out = await postJson(tollUrl(name), payloadOf(args), args);
  return { tool: name, rider: riderOrigin(), ...out };
}

export async function dispatchSqueeze(args = {}) {
  const out = await postJson(`${labOrigin()}/v1/squeeze`, payloadOf(args), args);
  return { verb: "squeeze", sku: "lab-squeeze", store: labOrigin(), ...out };
}

export async function dispatchPublic(name, args = {}) {
  const path = PUBLIC_PATH[name];
  if (!path) return null;
  const out = await postJson(`${siteOrigin()}${path}`, payloadOf(args), args);
  return { verb: name, ...out };
}

const MAX_FETCH_BYTES = 8_000_000;

export async function quikgaterProxy(target, headersIn = {}) {
  const url = String(target || "").trim();
  if (!url) {
    return {
      status: 400,
      contentType: "application/json; charset=utf-8",
      body: Buffer.from(JSON.stringify({ ok: false, error: "missing_url", product: "quikgater" })),
      paymentHeaders: {},
    };
  }
  const headers = {};
  for (const name of ["x-payment", "payment-signature", "authorization"]) {
    if (headersIn[name]) headers[name] = headersIn[name];
  }
  const response = await fetch(`${workerOrigin()}/?url=${encodeURIComponent(url)}`, {
    method: "GET",
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(30000),
  });
  const body = Buffer.from(await response.arrayBuffer());
  const paymentHeaders = {};
  for (const name of ["payment-required", "x-payment-required", "payment-response", "x-payment-response"]) {
    const value = response.headers.get(name);
    if (value) paymentHeaders[name] = value;
  }
  if (body.length > MAX_FETCH_BYTES) {
    return {
      status: 413,
      contentType: "application/json; charset=utf-8",
      body: Buffer.from(JSON.stringify({ ok: false, error: "payload_too_large", max_bytes: MAX_FETCH_BYTES })),
      paymentHeaders,
    };
  }
  return {
    status: response.status,
    contentType: response.headers.get("content-type") || "application/octet-stream",
    body,
    paymentHeaders,
    worker: workerOrigin(),
  };
}

export async function dispatchFetch(args = {}) {
  const headers = {};
  const payment = String(args.payment || args.paymentHeader || "");
  if (payment) {
    headers["x-payment"] = payment;
    headers["payment-signature"] = payment;
  }
  if (args.authorization) headers.authorization = String(args.authorization);
  const proxied = await quikgaterProxy(args.url, headers);
  const text = proxied.body.toString("utf8");
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") {
      return { status: proxied.status, product: "quikgater", worker: proxied.worker, ...parsed };
    }
  } catch {
    /* body is the fetched document */
  }
  if (proxied.body.length > 1_000_000) {
    return {
      status: proxied.status,
      product: "quikgater",
      bytes: proxied.body.length,
      truncated: true,
      hint: "POST /v1/fetch for the full body",
    };
  }
  const contentType = proxied.contentType || "";
  if (contentType.includes("text") || contentType.includes("json") || contentType.includes("xml") || contentType.includes("html")) {
    return { status: proxied.status, product: "quikgater", content_type: contentType, body: text };
  }
  return {
    status: proxied.status,
    product: "quikgater",
    content_type: contentType,
    body_b64: proxied.body.toString("base64"),
    bytes: proxied.body.length,
  };
}
