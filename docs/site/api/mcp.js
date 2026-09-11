/**
 * Hosted MCP (JSON-RPC over HTTP). POST /mcp or /api/mcp
 * GET returns the server card.
 */
import { signup, login, issueAgentKey } from "./lib/lab-auth.mjs";
import { catalogTools, dispatchCatalog } from "./lib/mcp-catalogs.mjs";
import { computeQuote } from "./suite-pricing.js";
import { issueWarrant, verifyWarrant, fileReceipt, productCard as warrantCard } from "./lib/warrant.mjs";
import { encodeHosted, decodeFrame } from "./lib/specialist.mjs";
import { packArchive, crc32 } from "./lib/pccz.mjs";
import { unpackMembers } from "./archive.js";

const SITE = "https://www.slidphilabs.com";
const MCP_VERSION = "1.20.1";

const COMMERCE = [
  { name: "spl_discover", description: "Lead product, cash product, auth, MCP, x402." },
  { name: "spl_lab_auth", description: "How to mint a lab account or agent API key." },
  { name: "spl_signup", description: "Create a human lab account (email + password)." },
  { name: "spl_agent_key", description: "Mint an agent API key (no password)." },
  { name: "spl_catalog", description: "Standing SKUs agents can buy via x402." },
  {
    name: "spl_compress",
    description: "Hosted lossless compression. Every dual-licensed pathway on this machine. Args: data_b64.",
    inputSchema: {
      type: "object",
      properties: { data_b64: { type: "string" } },
      required: ["data_b64"],
    },
  },
  {
    name: "spl_decompress",
    description: "Restore bytes packed by spl_compress. Args: packed_b64.",
    inputSchema: {
      type: "object",
      properties: { packed_b64: { type: "string" } },
      required: ["packed_b64"],
    },
  },
  {
    name: "spl_zip",
    description: "Pack files into a .pcc archive (our zip). Args: files: [{path, data_b64}]. Returns packed_b64.",
    inputSchema: {
      type: "object",
      properties: {
        files: {
          type: "array",
          items: {
            type: "object",
            properties: { path: { type: "string" }, data_b64: { type: "string" }, dir: { type: "boolean" } },
          },
        },
      },
      required: ["files"],
    },
  },
  {
    name: "spl_unzip",
    description: "Restore files from a .pcc archive. Args: packed_b64. Returns files: [{path, data_b64}].",
    inputSchema: {
      type: "object",
      properties: { packed_b64: { type: "string" } },
      required: ["packed_b64"],
    },
  },
  {
    name: "spl_quote",
    description: "Suite quote. First 2 GB/month free, then 8¢/GB, $1 card minimum. Args: bytes, product, op.",
    inputSchema: {
      type: "object",
      properties: {
        bytes: { type: "number", description: "Payload bytes. ≤6.9 GiB unpaid." },
        product: { type: "string", description: "auto | zrw | blackjack | shard-zip | shard-tsdb | slid-phi" },
        op: { type: "string", description: "compress | decompress | roundtrip" },
        dataClass: { type: "string" },
      },
    },
  },
  {
    name: "spl_warrant_issue",
    description: "Issue a Warrant (mandate) for a Rider identity. Pass rider JWT, or demo:true for a 10-minute shape check. Complements Agent-Rider.",
    inputSchema: {
      type: "object",
      properties: {
        rider: { type: "string", description: "X-Agent-Rider JWT" },
        demo: { type: "boolean" },
        actions: { type: "array", items: { type: "string" } },
        allow_hosts: { type: "array", items: { type: "string" } },
        max_usd: { type: "number" },
        max_calls: { type: "number" },
        ttl_seconds: { type: "number" },
      },
    },
  },
  {
    name: "spl_warrant_verify",
    description: "Verify a Warrant token. Optional host and action.",
    inputSchema: {
      type: "object",
      properties: {
        warrant: { type: "string" },
        host: { type: "string" },
        action: { type: "string" },
      },
    },
  },
  {
    name: "spl_warrant_receipt",
    description: "File a receipt against a Warrant after an action.",
    inputSchema: {
      type: "object",
      properties: {
        warrant: { type: "string" },
        action: { type: "string" },
        host: { type: "string" },
        usd: { type: "number" },
        request_sha256: { type: "string" },
        result_sha256: { type: "string" },
        note: { type: "string" },
      },
    },
  },
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

const TOOLS = [
  ...COMMERCE.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema || { type: "object", properties: {}, additionalProperties: true },
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

async function callTool(name, args = {}) {
  const cat = dispatchCatalog(name, args);
  if (cat) return cat;
  if (name === "spl_compress") {
    const raw = Buffer.from(String(args.data_b64 || ""), "base64");
    const j = await encodeHosted(raw);
    return { ok: true, packed_b64: j.packed_b64, packed_bytes: j.packed_bytes, raw_bytes: j.raw_bytes, method: j.method };
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
  if (name === "spl_discover") {
    return {
      lead_product: "pcc",
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
    const out = verifyWarrant(args.warrant, { host: args.host, action: args.action });
    return out.ok ? { valid: true, warrant: out.warrant } : { valid: false, reason: out.reason };
  }
  if (name === "spl_warrant_receipt") {
    return fileReceipt({
      token: args.warrant,
      action: args.action,
      host: args.host,
      usd: args.usd,
      request_sha256: args.request_sha256,
      result_sha256: args.result_sha256,
      note: args.note,
    });
  }
  throw new Error("Unknown tool: " + name);
}

async function handleRpc(msg) {
  const { id, method, params } = msg || {};
  if (method === "initialize") {
    return ok(id, {
      protocolVersion: "2024-11-05",
      serverInfo: { name: "slid-phi-labs", version: MCP_VERSION },
      capabilities: { tools: {} },
    });
  }
  if (method === "notifications/initialized" || method === "initialized") return null;
  if (method === "tools/list" || method === "list_tools") return ok(id, { tools: TOOLS });
  if (method === "tools/call" || method === "call_tool") {
    try {
      const result = await callTool(params?.name || params?.tool, params?.arguments || params?.args || {});
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
    const r = await handleRpc(m);
    if (r) out.push(r);
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(out.length === 1 ? out[0] : out));
}
