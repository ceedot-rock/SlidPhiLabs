#!/usr/bin/env node
/**
 * SPL Pay Per Suite — MCP server (stdio JSON-RPC / tools-list style)
 *
 * Tools:
 *   spl_pps_quote
 *   spl_pps_checkout
 *   spl_pps_submit_job
 *   spl_pps_classify
 *   spl_pps_info
 *   spl_pps_x402_info
 *   spl_pps_x402_requirements
 *   spl_pps_x402_submit
 *
 * Env:
 *   SPL_PPS_API, SPL_PPS_SITE, SPL_PPS_PAYMENT_LINK, X402_DEV_BYPASS
 */
import readline from "node:readline";
import {
  computeQuote,
  classifyBytes,
  createCheckout,
  submitJob,
  quoteRemote,
  agentDiscovery,
  x402Catalog,
  x402ProductRequirements,
  x402BuyProduct,
  x402Requirements,
  x402SubmitJob,
  X402_SUITE_URL,
  X402_PRODUCTS_URL,
  SERVICE_NAME,
  SITE_PPS,
  STRIPE_PAYMENT_LINK,
  PRODUCT_BASE,
  DATA_MULT,
  OP_MULT,
  FREE_BYTES,
  MIN_PAID_CENTS,
} from "./index.mjs";

const TOOLS = [
  {
    name: "spl_pps_info",
    description:
      "SPL Pay Per Suite overview: freemium suite (free first 1 GB then ~1.5¢/GB), Stripe (humans) + x402 (agents), products, data classes, ops. Try Gate retired.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "spl_pps_x402_info",
    description:
      "Agentic commerce discovery: standing product catalog + freemium suite jobs (free under 1 GB), headers, flow. Stripe remains for humans.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "spl_pps_x402_catalog",
    description:
      "List standing Slid Phi Labs license products agents can buy via x402 (CDDG:Split, ZRW tiers, Blackjack, shards, support, etc.). No try-gate — use freemium suite for eval.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "spl_pps_x402_buy",
    description:
      "Buy a standing license product via x402. Without paymentHeader → returns 402 requirements. With paymentHeader (or devBypass) → order_id + access_url. Not for suite jobs — use spl_pps_x402_submit.",
    inputSchema: {
      type: "object",
      properties: {
        sku: {
          type: "string",
          description:
            "cddg-split | zrw-n00b | zrw-pro | zrw-l33t | blackjack | shard-zip | shard-tsdb | slid-phi | support-integration | consulting | sponsor | donate",
        },
        email: { type: "string" },
        note: { type: "string" },
        paymentHeader: { type: "string" },
        devBypass: { type: "boolean" },
      },
      required: ["sku"],
    },
  },
  {
    name: "spl_pps_x402_requirements",
    description:
      "Probe POST /api/x402-suite. Free under 1 GB (no pay). Over free → 402 accepts[] for usage pricing (~1.5¢/GB).",
    inputSchema: {
      type: "object",
      properties: {
        product: { type: "string" },
        dataClass: { type: "string" },
        op: { type: "string" },
        bytes: { type: "number", description: "≤1GiB free; over free requires payment" },
        email: { type: "string" },
        note: { type: "string" },
      },
    },
  },
  {
    name: "spl_pps_x402_submit",
    description:
      "Submit freemium suite job via x402. Under 1 GB free (no paymentHeader). Over free: pass paymentHeader after paying, or devBypass for staging.",
    inputSchema: {
      type: "object",
      properties: {
        product: { type: "string" },
        dataClass: { type: "string" },
        op: { type: "string" },
        bytes: { type: "number" },
        email: { type: "string" },
        note: { type: "string" },
        fileName: { type: "string" },
        paymentHeader: { type: "string", description: "Base64 X-PAYMENT proof (only if over free cap)" },
        devBypass: { type: "boolean", description: "Staging only if server allows" },
      },
    },
  },
  {
    name: "spl_pps_quote",
    description:
      "Instant freemium quote: free first 1 GB ($0), then ~1.5¢/GB. Inputs: product, dataClass, op, bytes. Returns free flag + USD amount.",
    inputSchema: {
      type: "object",
      properties: {
        product: {
          type: "string",
          description: "auto | zrw | cddg-split | blackjack | shard-zip | shard-tsdb | slid-phi",
        },
        dataClass: {
          type: "string",
          description:
            "zeros | ramp | walk | mixed_ints | timeseries | json_series | binary | unknown",
        },
        op: { type: "string", description: "compress | decompress | roundtrip" },
        bytes: { type: "number", description: "Payload size in bytes (≤1GiB = free)" },
        remote: { type: "boolean", description: "If true, use live site API" },
      },
    },
  },
  {
    name: "spl_pps_checkout",
    description:
      "Checkout for suite quote. Under 1 GB returns free_showcase (no Stripe). Over free returns Stripe Checkout URL.",
    inputSchema: {
      type: "object",
      properties: {
        product: { type: "string" },
        dataClass: { type: "string" },
        op: { type: "string" },
        bytes: { type: "number" },
        email: { type: "string" },
      },
    },
  },
  {
    name: "spl_pps_submit_job",
    description:
      "Submit a Pay Per Suite job (free under 1 GB after free_showcase, or after paid). Lab runs best tool and emails results. Requires email.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string" },
        product: { type: "string" },
        dataClass: { type: "string" },
        op: { type: "string" },
        bytes: { type: "number" },
        amount_display: { type: "string" },
        tool: { type: "string" },
        fileName: { type: "string" },
        paidConfirm: { type: "boolean" },
        note: { type: "string" },
        sampleHint: { type: "string" },
      },
      required: ["email"],
    },
  },
  {
    name: "spl_pps_classify",
    description:
      "Classify a base64 sample (first few KB) into a data class and recommended tool. No proprietary encode.",
    inputSchema: {
      type: "object",
      properties: {
        sample_base64: { type: "string", description: "Base64 of file head (≤8KB recommended)" },
      },
      required: ["sample_base64"],
    },
  },
];

function ok(id, result) {
  return { jsonrpc: "2.0", id, result };
}
function err(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function callTool(name, args = {}) {
  switch (name) {
    case "spl_pps_info":
      return {
        service: SERVICE_NAME,
        site: SITE_PPS,
        pricing: {
          model: "freemium_suite_v2",
          free_cap_bytes: FREE_BYTES,
          free_cap_gb: 1,
          usd_per_gb_after_free: 0.015,
          usd_per_gb_bulk: 0.008,
          min_paid_cents: MIN_PAID_CENTS,
          try_gate: "retired",
        },
        pay_human: STRIPE_PAYMENT_LINK,
        pay_agent_products: X402_PRODUCTS_URL,
        pay_agent_jobs: X402_SUITE_URL,
        rails: { human: "stripe", agent: "x402" },
        suite_tools: Object.keys(PRODUCT_BASE),
        data_classes: Object.keys(DATA_MULT),
        ops: Object.keys(OP_MULT),
        npm: "spl-pay-per-suite",
        cli: "npx spl-pay-per-suite quote|pay|job|x402|catalog|buy",
        discovery: "https://www.slidphilabs.com/api/agent",
      };
    case "spl_pps_x402_info":
      return agentDiscovery();
    case "spl_pps_x402_catalog":
      return x402Catalog();
    case "spl_pps_x402_buy": {
      try {
        return await x402BuyProduct(args);
      } catch (e) {
        if (e.status === 402) {
          return {
            payment_required: true,
            status: 402,
            sku: args.sku,
            requirements: e.requirements,
            how: "Pay accepts[0] then call again with paymentHeader",
          };
        }
        throw e;
      }
    }
    case "spl_pps_x402_requirements":
      return x402Requirements({
        product: args.product || "auto",
        dataClass: args.dataClass || args.data_class || "unknown",
        op: args.op || "compress",
        bytes: args.bytes || 0,
        email: args.email || "",
        note: args.note || "",
      });
    case "spl_pps_x402_submit":
      return x402SubmitJob(args);
    case "spl_pps_quote": {
      const opts = {
        product: args.product || "auto",
        dataClass: args.dataClass || args.data_class || "unknown",
        op: args.op || "compress",
        bytes: args.bytes || 0,
      };
      return args.remote ? await quoteRemote(opts) : computeQuote(opts);
    }
    case "spl_pps_checkout":
      return createCheckout({
        product: args.product || "auto",
        dataClass: args.dataClass || args.data_class || "unknown",
        op: args.op || "compress",
        bytes: args.bytes || 0,
        email: args.email || "",
      });
    case "spl_pps_submit_job":
      return submitJob(args);
    case "spl_pps_classify": {
      const raw = Buffer.from(String(args.sample_base64 || ""), "base64");
      return { service: SERVICE_NAME, ...classifyBytes(raw), bytes_sampled: raw.length };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function handle(msg) {
  const { id, method, params } = msg;
  if (method === "initialize") {
    return ok(id, {
      protocolVersion: "2024-11-05",
      serverInfo: { name: "spl-pay-per-suite", version: "1.0.0" },
      capabilities: { tools: {} },
    });
  }
  if (method === "notifications/initialized" || method === "initialized") {
    return null;
  }
  if (method === "tools/list" || method === "list_tools") {
    return ok(id, { tools: TOOLS });
  }
  if (method === "tools/call" || method === "call_tool") {
    const name = params?.name || params?.tool;
    const args = params?.arguments || params?.args || {};
    try {
      const result = await callTool(name, args);
      return ok(id, {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      });
    } catch (e) {
      return err(id, -32000, e.message || String(e));
    }
  }
  if (method === "ping") return ok(id, {});
  return err(id, -32601, `Method not found: ${method}`);
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", async (line) => {
  const t = line.trim();
  if (!t) return;
  let msg;
  try {
    msg = JSON.parse(t);
  } catch {
    process.stdout.write(JSON.stringify(err(null, -32700, "Parse error")) + "\n");
    return;
  }
  const out = await handle(msg);
  if (out) process.stdout.write(JSON.stringify(out) + "\n");
});

process.stderr.write(`${SERVICE_NAME} MCP ready (stdio)\n`);
