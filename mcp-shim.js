#!/usr/bin/env node
/**
 * mcp-shim.js — Slid Phi Labs MCP stdio shim.
 *
 * A tiny public proxy that Glama (or any MCP host) can build and start.
 * It speaks MCP over stdio and forwards tools/list + tools/call to the
 * hosted Slid Phi Labs endpoint. The encoder and all engines stay private
 * on the hosted side; this file contains no codec code.
 *
 * Upstream: https://www.slidphilabs.com/mcp (Streamable HTTP, auth optional)
 * Override: SLIDPHI_MCP_URL env var.
 * Optional: SLIDPHI_API_KEY env var -> forwarded as Authorization: Bearer.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const UPSTREAM = process.env.SLIDPHI_MCP_URL || "https://www.slidphilabs.com/mcp";
const API_KEY = process.env.SLIDPHI_API_KEY || "";
const VERSION = "1.20.2";

let rpcId = 1;

async function upstreamRpc(method, params) {
  const body = JSON.stringify({ jsonrpc: "2.0", id: rpcId++, method, params: params || {} });
  const headers = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
  if (API_KEY) headers["Authorization"] = "Bearer " + API_KEY;
  const res = await fetch(UPSTREAM, { method: "POST", headers, body });
  if (!res.ok) throw new Error("upstream HTTP " + res.status);
  const text = await res.text();
  // Streamable HTTP may return SSE; extract the JSON-RPC payload.
  let payload = text;
  const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
  if (dataLine) payload = dataLine.slice(5).trim();
  const msg = JSON.parse(payload);
  if (msg.error) throw new Error("upstream error: " + JSON.stringify(msg.error).slice(0, 300));
  return msg.result;
}

const server = new Server(
  { name: "slid-phi-labs", version: VERSION },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const result = await upstreamRpc("tools/list", {});
  return { tools: result.tools || [] };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const result = await upstreamRpc("tools/call", {
    name,
    arguments: args || {},
  });
  // Normalize upstream result into MCP content blocks.
  if (result && Array.isArray(result.content)) return result;
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
});

async function main() {
  // Warm the upstream tool list so a dead endpoint fails fast at startup.
  await upstreamRpc("tools/list", {});
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("mcp-shim fatal:", err && err.message ? err.message : err);
  process.exit(1);
});
