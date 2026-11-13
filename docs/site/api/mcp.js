/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * Hosted MCP (JSON-RPC over HTTP). POST /mcp or /api/mcp
 * GET returns the server card.
 */
import { signup, login, issueAgentKey } from "./lib/lab-auth.mjs";
import { catalogTools, dispatchCatalog } from "./lib/mcp-catalogs.mjs";
import { computeQuote } from "./suite-pricing.js";
import { issueWarrant, verifyWarrant, fileReceipt, reserveWarrant, releaseReservation, revokeWarrant, productCard as warrantCard } from "./lib/warrant.mjs";
import { AGENTIC_TOOLS, dispatchAgentic } from "./lib/agentic-platform.mjs";
import { searchTavily } from "./lib/tavily.mjs";
import { encodeHosted, decodeFrame } from "./lib/specialist.mjs";
import { runHostedEncode } from "./lib/hosted-job.mjs";
import { sealEnvelope, openEnvelope } from "./lib/chamber-seal.mjs";
import { packArchive, crc32 } from "./lib/pccz.mjs";
import { unpackMembers } from "./archive.js";
import { CUNI_TOOLS, cuniVerb, dispatchCuni } from "./lib/cuni-calls.mjs";
import {
  CALL_TOOLS,
  aliasTool,
  TOLL_TOOLS,
  dispatchToll,
  dispatchFetch,
  dispatchSqueeze,
} from "./lib/call-doors.mjs";

const SITE = "https://www.slidphilabs.com";
const MCP_VERSION = "1.22.0";

const COMMERCE = [
  {
    name: "cuni_bank",
    description:
      "CuNi translate, legacy name cuni_bank. Paste N, get X, or refuse. POST /v1/translate. SKU lab-translate $0.10. Pass payment or the lab returns 402. The Studio playground stays free. Use spl_compress for byte compression.",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string", description: "Source program to run: a Python v1-subset program or .cuni source text." },
        from: { type: "string", description: "Source language: py for a Python v1-subset program, cuni for .cuni source. Defaults to py." },
        to: { type: "string", description: "Target language for the output, e.g. js, go, ts, py. Required." },
        payment: { type: "string", description: "x402 X-PAYMENT header. Omit it and the lab answers 402." },
      },
      required: ["source", "to"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  ...CUNI_TOOLS,
  { name: "spl_discover", description: "List the lab's lead and cash products, auth endpoints, and entry points (site, CuNi Studio, Agent-Rider, Chamber, MCP, x402, SKILL.md). Read-only; returns a static discovery map. Takes no arguments. Use as the first call when orienting an agent; use the *_search catalog tools for prices and details.", annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
  { name: "spl_lab_auth", description: "Explain how to mint a lab account or agent API key: the human signup/login flow and the agent_key call. Read-only; returns instructions only and creates nothing. Takes no arguments. Use to learn the auth flow; use spl_signup to create a human account or spl_agent_key to mint a key.", annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
  {
    name: "spl_signup",
    description: "Create a human lab account with an email and password. Mutating: stores a salted password hash and returns a signed session token. Email must be a valid address, password at least 8 characters; duplicate emails are rejected. Use for a human seat; use spl_agent_key for a passwordless agent key.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Account email address. Must be a valid email; duplicates are rejected with email_taken." },
        password: { type: "string", description: "Account password, at least 8 characters. Stored as a salted hash, never in plain text." },
        name: { type: "string", description: "Display name, up to 80 characters. Defaults to the part of the email before @." },
      },
      required: ["email", "password"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "spl_agent_key",
    description: "Mint a passwordless agent API key (spl_ag_*) for a named agent. Mutating: creates an agent account and returns the key once — store it, it cannot be retrieved again. Use for agent seats; use spl_signup for a human account with email and password.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Agent name, up to 80 characters. Defaults to agent." },
      },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  { name: "spl_catalog", description: "List the standing SKUs agents can buy via x402 (live product list from /api/x402-products). Read-only; returns current prices and payment rails. Takes no arguments. Use for live purchase options; use sku_search and sku_get for the catalog's price notes and links.", annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } },
  {
    name: "spl_compress",
    description: "Compress bytes with the hosted lossless engine (PCC and sibling codecs). Accepts base64 input; returns base64 packed bytes, sizes, and the method used. Read-only computation — nothing is stored. Metered: first 1 GB free once per IP, then $0.25/GB; a paid seat or x402 payment may be required (402). Use to shrink data; use spl_decompress to restore it, spl_zip to pack files.",
    inputSchema: {
      type: "object",
      properties: { data_b64: { type: "string", description: "Base64-encoded bytes to compress. Must be valid base64." } },
      required: ["data_b64"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "spl_decompress",
    description: "Restore bytes packed by spl_compress. Accepts the base64 packed output; returns the original bytes as base64 plus their length. Read-only computation — nothing is stored. Use only on output from spl_compress; use spl_unzip for .pcc archives.",
    inputSchema: {
      type: "object",
      properties: { packed_b64: { type: "string", description: "Base64-encoded packed bytes previously returned by spl_compress." } },
      required: ["packed_b64"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "spl_zip",
    description: "Pack files into a .pcc archive (the lab's zip). Each file is compressed with the hosted engine; returns the archive as base64 plus packed size and member count. Read-only computation — nothing is stored. Use to bundle multiple files; use spl_compress for a single blob, spl_unzip to restore.",
    inputSchema: {
      type: "object",
      properties: {
        files: {
          type: "array",
          description: "Files to pack. Each item: path (archive path), data_b64 (base64 file bytes; omit for directories), dir (true for a directory entry).",
          items: {
            type: "object",
            properties: {
              path: { type: "string", description: "Path inside the archive, e.g. notes/readme.txt." },
              data_b64: { type: "string", description: "Base64-encoded file bytes. Omit for directory entries." },
              dir: { type: "boolean", description: "True when this entry is a directory (no bytes). Defaults to false." },
            },
          },
        },
      },
      required: ["files"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "spl_unzip",
    description: "Restore files from a .pcc archive made by spl_zip. Accepts the archive as base64; returns each file with path and base64 bytes plus the member count. Read-only computation — nothing is stored. Use only on .pcc archives; use spl_decompress for single blobs from spl_compress.",
    inputSchema: {
      type: "object",
      properties: { packed_b64: { type: "string", description: "Base64-encoded .pcc archive previously returned by spl_zip." } },
      required: ["packed_b64"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "spl_quote",
    description: "Quote a metered PCC job before running it: price in USD for the given byte count, product, and operation. Read-only and free; returns the quote without charging or reserving anything. First 1 GB free once per IP, then $0.25/GB of input, $1 card minimum. Use before spl_compress on large inputs; use spl_catalog for standing SKUs.",
    inputSchema: {
      type: "object",
      properties: {
        bytes: { type: "number", description: "Payload bytes. First 1 GB free once per IP." },
        product: { type: "string", description: "Product to price: auto, zrw, blackjack, shard-zip, shard-tsdb, or slid-phi. Defaults to auto." },
        op: { type: "string", description: "Operation: compress, decompress, or roundtrip. Defaults to compress." },
        dataClass: { type: "string", description: "Data class of the payload (e.g. text, logs, json) when known; used to pick the best product. Defaults to unknown." },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "spl_research",
    description:
      "Default web search (Tavily). Fresh sources for any agent run. Args: query (required), max_results (1-10, default 5), search_depth (basic|advanced, default basic), include_answer (default false). Lab-metered; refuses closed when TAVILY_API_KEY is unset.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        max_results: { type: "number", description: "1-10, default 5" },
        search_depth: { type: "string", description: "basic | advanced" },
        include_answer: { type: "boolean" },
      },
      required: ["query"],
    },
  },
  {
    name: "spl_warrant_issue",
    description: "Issue a Warrant (spend mandate) for an Agent-Rider identity, capping what an agent may spend, where, and for how long. Mutating: mints a signed token. Pass a Rider JWT, or demo:true for a 10-minute shape check that issues nothing billable. Use to authorize an agent's spending before it acts; use spl_warrant_verify to check a token, spl_warrant_reserve to hold funds, spl_warrant_receipt to settle.",
    inputSchema: {
      type: "object",
      properties: {
        rider: { type: "string", description: "Agent-Rider JWT proving the identity the Warrant is issued for. Required unless demo is true." },
        demo: { type: "boolean", description: "True for a 10-minute shape check without a Rider token. Defaults to false." },
        actions: { type: "array", items: { type: "string" }, description: "Allowed action names, e.g. [\"compress\", \"quote\"]. Omit for no action restriction." },
        allow_hosts: { type: "array", items: { type: "string" }, description: "Allowed hostnames the agent may call. Omit for no host restriction." },
        max_usd: { type: "number", description: "Maximum spend in USD across the Warrant's life. Omit for no cap." },
        max_calls: { type: "number", description: "Maximum number of calls under this Warrant. Omit for no cap." },
        ttl_seconds: { type: "number", description: "Lifetime in seconds. Demo defaults to 600 (10 minutes)." },
      },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "spl_warrant_verify",
    description: "Verify a Warrant token and check it against an optional host, action, and USD cost — pass usd to enforce the spend cap BEFORE the job runs. Read-only; verifies locally and changes nothing. Returns valid true/false with the Warrant or a reason. Use before running a job under a Warrant; use spl_warrant_issue to mint one.",
    inputSchema: {
      type: "object",
      properties: {
        warrant: { type: "string", description: "Warrant token string to verify. Required." },
        host: { type: "string", description: "Hostname the job will call; checked against the Warrant's allow list when given." },
        action: { type: "string", description: "Action name the job will perform; checked against the Warrant's allowed actions when given." },
        usd: { type: "number", description: "Expected USD cost of the job; checked against the remaining spend cap when given." },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "spl_warrant_reserve",
    description: "Reserve the expected cost against a Warrant BEFORE the job runs (pre-spend cap enforcement). Mutating: holds funds and returns a reservation id. File the receipt with that id to settle without double-deducting, or release it if the job never runs. Use after verify and before the job; use spl_warrant_receipt to settle, spl_warrant_release to refund.",
    inputSchema: {
      type: "object",
      properties: {
        warrant: { type: "string", description: "Warrant token to reserve against. Required." },
        host: { type: "string", description: "Hostname the job will call; checked against the Warrant's allow list when given." },
        action: { type: "string", description: "Action name the job will perform; checked against the Warrant's allowed actions when given." },
        usd: { type: "number", description: "USD cost to hold. Required for the reservation." },
      },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "spl_warrant_release",
    description: "Refund an unsettled Warrant reservation when the job never ran. Mutating: frees the held funds; the reservation cannot be used afterward. Use only for reservations that will never settle; use spl_warrant_receipt to settle a completed job.",
    inputSchema: {
      type: "object",
      properties: {
        reservation_id: { type: "string", description: "Reservation id returned by spl_warrant_reserve. Required." },
      },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "spl_warrant_receipt",
    description: "File a receipt against a Warrant after an action, settling the spend. Mutating: deducts the USD cost — pass the reservation id from spl_warrant_reserve to settle against the reservation instead of deducting twice. Use after a job completes; use spl_warrant_reserve before it runs.",
    inputSchema: {
      type: "object",
      properties: {
        warrant: { type: "string", description: "Warrant token the receipt is filed against. Required." },
        action: { type: "string", description: "Action name that ran, e.g. compress." },
        host: { type: "string", description: "Hostname that was called." },
        usd: { type: "number", description: "USD cost to deduct. Required for settlement." },
        reservation_id: { type: "string", description: "Reservation id from spl_warrant_reserve, when the cost was pre-reserved. Settles against the reservation instead of deducting twice." },
        request_sha256: { type: "string", description: "SHA-256 hex of the request body, for the audit trail." },
        result_sha256: { type: "string", description: "SHA-256 hex of the result body, for the audit trail." },
        note: { type: "string", description: "Free-text note attached to the receipt." },
      },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  ...CALL_TOOLS,
  ...AGENTIC_TOOLS,
];

export const SERVER_CARD = {
  name: "slid-phi-labs",
  title: "Slid Phi Labs",
  description:
    "Hosted Streamable HTTP MCP for Slid Phi Labs public catalog and commerce discovery. Lookup is public; engines and customer operations remain protected.",
  version: MCP_VERSION,
  websiteUrl: SITE,
  documentationUrl: SITE + "/mcp-service",
  registry: "io.github.ceedot-rock/slid-phi-labs",
  registryUrl:
    "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.ceedot-rock/slid-phi-labs",
  transport: { type: "streamable-http", url: SITE + "/mcp" },
  endpoint: SITE + "/mcp",
  capabilities: { tools: {} },
  auth: {
    type: "optional",
    human: SITE + "/api/auth",
    agent_key: 'POST /api/auth {"action":"agent_key","name":"my-agent"}',
  },
  tools: [...COMMERCE, ...catalogTools().map((t) => ({ name: t.name, description: t.description }))],
};

export const TOOLS = [
  ...COMMERCE.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema || { type: "object", properties: {}, additionalProperties: true },
    ...(t.annotations ? { annotations: t.annotations } : {}),
  })),
  ...catalogTools(),
];

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, MCP-Protocol-Version");
}

function ok(id, result) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}
function err(id, code, message) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

async function callTool(name, args = {}, req) {
  const aliased = aliasTool(name);
  if (aliased) name = aliased;
  const cat = dispatchCatalog(name, args);
  if (cat) return cat;
  if (name === "squeeze" || name === "pccx_encode") return dispatchSqueeze(args);
  if (TOLL_TOOLS.includes(name)) return dispatchToll(name, args);
  if (name === "fetch") return dispatchFetch(args);
  if (name === "seal") {
    let obj = args.obj != null ? args.obj : args.payload;
    if (typeof obj === "string") {
      try {
        obj = JSON.parse(obj);
      } catch {
        return { ok: false, error: "seal_refused" };
      }
    }
    const envelope = sealEnvelope(obj, { keyHex: String(args.key_hex || args.keyHex || "") });
    if (!envelope) return { ok: false, error: "seal_refused" };
    return { ok: true, envelope };
  }
  if (name === "open") return openEnvelope(args.envelope, { keyHex: String(args.key_hex || args.keyHex || "") });
  if (name === "warrant_revoke") return revokeWarrant(String(args.warrant || args.token || ""));
  if (name === "spl_compress") {
    const raw = Buffer.from(String(args.data_b64 || ""), "base64");
    const job = await runHostedEncode(req || { headers: {} }, raw);
    return { status: job.status, ...job.body };
  }
  if (name === "spl_decompress") {
    const packed = Buffer.from(String(args.packed_b64 || ""), "base64");
    const raw = await decodeFrame(packed);
    return { ok: true, raw_b64: raw.toString("base64"), raw_bytes: raw.length };
  }
  if (name === "spl_zip") {
    const files = Array.isArray(args.files) ? args.files : [];
    const entries = [];
    for (const f of files) {
      const dir = Boolean(f.dir);
      const raw = dir ? Buffer.alloc(0) : Buffer.from(String(f.data_b64 || ""), "base64");
      let packed = raw;
      let stored = true;
      if (!dir && raw.length) {
        const j = await encodeHosted(raw);
        packed = Buffer.from(j.packed_b64, "base64");
        stored = false;
      }
      entries.push({
        name: f.path || f.name,
        packed,
        rawLen: raw.length,
        crc32: crc32(raw),
        stored,
        dir,
      });
    }
    const archive = packArchive(entries);
    return { ok: true, ext: ".pcc", packed_b64: archive.toString("base64"), packed_bytes: archive.length, members: entries.length };
  }
  if (name === "spl_unzip") {
    const packed = Buffer.from(String(args.packed_b64 || ""), "base64");
    const files = await unpackMembers(packed);
    return { ok: true, ext: ".pcc", files, members: files.length };
  }
  if (cuniVerb(name)) {
    return dispatchCuni(name, args);
  }
  if (name === "spl_discover") {
    return {
      lead_product: "rider",
      cash_product: "chamber",
      studio: "https://cuni-studio.fly.dev/",
      rider: "https://agentrider.fly.dev/",
      chamber: SITE + "/chamber",
      signup: SITE + "/signup",
      auth: SITE + "/api/auth",
      mcp: SITE + "/mcp",
      docs: SITE + "/mcp-service",
      registry: "io.github.ceedot-rock/slid-phi-labs",
      registryUrl:
        "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.ceedot-rock/slid-phi-labs",
      card: SITE + "/.well-known/mcp/server-card.json",
      agent: SITE + "/api/agent",
      x402: SITE + "/api/x402-products",
      skill: SITE + "/SKILL.md",
      npx: "npx -y spl-pay-per-suite mcp",
    };
  }
  if (name === "spl_lab_auth") {
    return {
      human: { post: SITE + "/api/auth", body: { action: "signup|login", email: "", password: "", name: "" } },
      agent: { post: SITE + "/api/auth", body: { action: "agent_key", name: "my-agent" } },
    };
  }
  if (name === "spl_signup") {
    return signup({ email: args.email, password: args.password, name: args.name });
  }
  if (name === "spl_agent_key") {
    return issueAgentKey({ name: args.name || "agent" });
  }
  if (name === "spl_catalog") {
    const r = await fetch(SITE + "/api/x402-products", { signal: AbortSignal.timeout(12000) });
    return r.json();
  }
  if (name === "spl_quote") {
    return computeQuote({
      product: args.product || "auto",
      dataClass: args.dataClass || args.data_class || "unknown",
      op: args.op || "compress",
      bytes: args.bytes || 0,
    });
  }
  if (name === "spl_research") {
    return searchTavily({
      query: args.query,
      max_results: args.max_results,
      search_depth: args.search_depth,
      include_answer: args.include_answer,
    });
  }
  if (name === "spl_warrant_issue") {
    if (args.demo) return issueWarrant({ demo: true, ttl_seconds: args.ttl_seconds || 600 });
    if (!args.rider) return { error: "missing_rider", product: warrantCard() };
    const { verifyRiderToken } = await import("./lib/warrant.mjs");
    const v = await verifyRiderToken(args.rider);
    if (!v.valid) return { error: "rider_invalid", reason: v.reason };
    return issueWarrant({
      rider: v.rider,
      actions: args.actions,
      allow_hosts: args.allow_hosts,
      max_usd: args.max_usd,
      max_calls: args.max_calls,
      ttl_seconds: args.ttl_seconds,
    });
  }
  if (name === "spl_warrant_verify") {
    const out = verifyWarrant(args.warrant, { host: args.host, action: args.action, usd: args.usd });
    return out.ok ? { valid: true, warrant: out.warrant } : { valid: false, reason: out.reason };
  }
  if (name === "spl_warrant_reserve") {
    return reserveWarrant({ token: args.warrant, host: args.host, action: args.action, usd: args.usd });
  }
  if (name === "spl_warrant_release") {
    return releaseReservation(args.reservation_id || args.reservation);
  }
  if (name === "spl_warrant_receipt") {
    return fileReceipt({
      token: args.warrant,
      action: args.action,
      host: args.host,
      usd: args.usd,
      reservation_id: args.reservation_id,
      request_sha256: args.request_sha256,
      result_sha256: args.result_sha256,
      note: args.note,
    });
  }
  if (name === "spl_agentic_plan" || name === "spl_agentic_run") {
    return dispatchAgentic(name, args);
  }
  throw new Error("Unknown tool: " + name);
}

async function handleRpc(msg, req) {
  const { id, method, params } = msg || {};
  if (method === "initialize") {
    const supported = ["2024-11-05", "2025-03-26", "2025-11-25"];
    const latest = "2025-11-25";
    const asked = String((params && params.protocolVersion) || "");
    const protocolVersion = supported.includes(asked) ? asked : latest;
    return ok(id, {
      protocolVersion,
      serverInfo: { name: "slid-phi-labs", version: MCP_VERSION },
      capabilities: { tools: {} },
    });
  }
  if (method === "notifications/initialized" || method === "initialized") return null;
  if (method === "tools/list" || method === "list_tools") return ok(id, { tools: TOOLS });
  if (method === "tools/call" || method === "call_tool") {
    try {
      const result = await callTool(params?.name || params?.tool, params?.arguments || params?.args || {}, req);
      return ok(id, {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      });
    } catch (e) {
      return err(id, -32000, e.message || String(e));
    }
  }
  if (method === "ping") return ok(id, {});
  return err(id, -32601, "Method not found: " + method);
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method === "GET") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify(SERVER_CARD));
  }
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: "POST JSON-RPC" }));
  }
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }
  if (!body || typeof body !== "object") {
    res.statusCode = 400;
    return res.end(JSON.stringify(err(null, -32700, "Parse error")));
  }
  const msgs = Array.isArray(body) ? body : [body];
  const out = [];
  for (const m of msgs) {
    const r = await handleRpc(m, req);
    if (r) out.push(r);
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(out.length === 1 ? out[0] : out));
}
