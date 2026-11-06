#!/usr/bin/env node
/**
 * spl-acn — multifaceted terminal for the SPL:ACN MCP API.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 *   spl-acn card                        # server card
 *   spl-acn catalog                     # standing SKUs (spl_catalog)
 *   spl-acn call <tool> [json-args]     # any MCP tool
 *
 * Flags: --endpoint URL, --api-key KEY (or SPL_ACN_ENDPOINT / SPL_ACN_KEY).
 * JSON on stdout, errors on stderr. Codes: 0 ok, 1 call refused, 2 bad CLI.
 */
import { createMcpClient, MCP_SDK_VERSION } from "./client.mjs";

export const CLI_VERSION = MCP_SDK_VERSION;

export function usage() {
  return [
    "spl-acn — SPL:ACN MCP terminal (card, catalog, call)",
    "",
    "Usage:",
    "  spl-acn card                    # server card",
    "  spl-acn catalog                 # standing SKUs via spl_catalog",
    "  spl-acn call <tool> [json]      # any MCP tool with JSON args",
    "",
    "Flags: --endpoint URL --api-key KEY  (env: SPL_ACN_ENDPOINT, SPL_ACN_KEY)",
    "Paid tools answer payment_required with accepts — pay, then retry.",
  ].join("\n");
}

/**
 * Run one invocation. Returns { code, json?, text?, error? }; the thin
 * main wrapper below prints. fetchFn/env injectable so tests run offline.
 */
export async function run(argv = [], opts = {}) {
  const args = Array.isArray(argv) ? argv.slice() : [];
  const env = (opts && typeof opts.env === "object" ? opts.env : null) || process.env;
  let endpoint;
  let apiKey;
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--endpoint") {
      endpoint = args[(i += 1)];
      if (endpoint == null) return { code: 2, error: "missing value: --endpoint" };
    } else if (a === "--api-key") {
      apiKey = args[(i += 1)];
      if (apiKey == null) return { code: 2, error: "missing value: --api-key" };
    } else if (a === "--help" || a === "-h") {
      return { code: 0, text: usage() };
    } else if (typeof a === "string" && a.startsWith("-")) {
      return { code: 2, error: "unknown flag: " + a };
    } else {
      positional.push(a);
    }
  }
  const [cmd, ...rest] = positional;
  if (cmd == null) return { code: 2, error: "need a command", text: usage() };
  if (!["card", "catalog", "call"].includes(cmd)) {
    return { code: 2, error: "unknown command: " + cmd, text: usage() };
  }
  const client = createMcpClient({
    ...(endpoint || env.SPL_ACN_ENDPOINT ? { endpoint: endpoint || env.SPL_ACN_ENDPOINT } : {}),
    ...(apiKey || env.SPL_ACN_KEY ? { apiKey: apiKey || env.SPL_ACN_KEY } : {}),
    ...(opts && typeof opts.fetchFn === "function" ? { fetchFn: opts.fetchFn } : {}),
  });
  if (cmd === "card") {
    const r = await client.card();
    return r.ok ? { code: 0, json: r } : { code: 1, json: r };
  }
  if (cmd === "catalog") {
    const r = await client.callTool("spl_catalog", {});
    return r.ok ? { code: 0, json: r } : { code: 1, json: r };
  }
  const [tool, rawArgs] = rest;
  if (!tool) return { code: 2, error: "need a tool name" };
  let parsed = {};
  if (rawArgs !== undefined) {
    try {
      parsed = JSON.parse(rawArgs);
    } catch {
      return { code: 2, error: "bad JSON args" };
    }
  }
  const r = await client.callTool(tool, parsed);
  return r.ok ? { code: 0, json: r } : { code: 1, json: r };
}

const isMain =
  typeof process !== "undefined" &&
  process.argv &&
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop());
if (isMain) {
  const r = await run(process.argv.slice(2));
  if (r.text) console.log(r.text);
  if (r.json !== undefined) console.log(JSON.stringify(r.json, null, 2));
  if (r.error) console.error("spl-acn: " + r.error);
  process.exit(r.code);
}
