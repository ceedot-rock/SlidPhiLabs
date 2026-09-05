/**
 * Hosted MCP (JSON-RPC over HTTP). POST /mcp or /api/mcp
 * GET returns the server card.
 */
import { signup, login, issueAgentKey } from "./lib/lab-auth.mjs";
import { catalogTools, dispatchCatalog } from "./lib/mcp-catalogs.mjs";
import { computeQuote } from "./suite-pricing.js";

const SITE = "https://www.slidphilabs.com";
const MCP_VERSION = "1.20.1";

const COMMERCE = [
  { name: "spl_discover", description: "Lead product, cash product, auth, MCP, x402." },
  { name: "spl_lab_auth", description: "How to mint a lab account or agent API key." },
  { name: "spl_signup", description: "Create a human lab account (email + password)." },
  { name: "spl_agent_key", description: "Mint an agent API key (no password)." },
  { name: "spl_catalog", description: "Standing SKUs agents can buy via x402. Retired ZRW $79/$249/$699 are not sold." },
  {
    name: "spl_quote",
    description: "Suite quote. Unpaid 6.9 GB / 3 h, then ~5¢/GB (4¢ bulk). Args: bytes, product, op. No encoder.",
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
  if (name === "spl_discover") {
    return {
      lead_product: "cuni",
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
