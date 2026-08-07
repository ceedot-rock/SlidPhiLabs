/**
 * SPL Pay Per Suite — agentic commerce (x402)
 *
 * Humans: Stripe on /pps
 * Agents: POST /api/x402-suite
 *   1) No payment → 402 + requirements (compatible with x402-client payFetch)
 *   2) X-PAYMENT / PAYMENT-SIGNATURE header → verify Solana SPL transfer → job intake
 *
 * Env:
 *   X402_PAY_TO          Solana recipient pubkey (required for live 402)
 *   X402_ASSET           SPL mint (default: USDC mainnet mint EPjFW… (override with X402_ASSET))
 *   X402_NETWORK         solana-devnet | solana-mainnet-beta (default solana-mainnet-beta)
 *   X402_TOKEN_DECIMALS  default 6 (USDC)
 *   SOLANA_RPC_URL       RPC for send+confirm
 *   X402_DEV_BYPASS      if "1", accept X-PAYMENT-DEV: ok for dry-run (staging only)
 *   NOTION_TOKEN         optional job log
 */
const DB = (
  process.env.NOTION_GROK_NOTES_DB ||
  process.env.NOTION_GROK_NOTES_PAGE_ID ||
  "d428f47a-3c51-49b1-914e-cbd7f90809b0"
).replace(
  /^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/i,
  "$1-$2-$3-$4-$5"
);
const NOTION_VERSION = "2022-06-28";

const PRODUCT_BASE = {
  auto: 99,
  zrw: 99,
  "cddg-split": 299,
  blackjack: 149,
  "shard-zip": 149,
  "shard-tsdb": 149,
  "slid-phi": 149,
};
const DATA_MULT = {
  zeros: 0.9,
  ramp: 0.95,
  walk: 1.0,
  mixed_ints: 1.05,
  timeseries: 1.05,
  json_series: 1.0,
  binary: 1.1,
  unknown: 1.0,
};
const OP_MULT = {
  compress: 1.0,
  decompress: 0.75,
  roundtrip: 1.2,
};
const MIN_CENTS = 50;
const MAX_CENTS = 1_000_000;
const MAX_BYTES = 100 * 1024 * 1024 * 1024; // 100 GB

// USDC mainnet mint (override with X402_ASSET). Devnet USDC often custom.
const DEFAULT_USDC_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const DEFAULT_USDC_DEVNET = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const BASE_USDC_MAINNET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE_NETWORK = "eip155:8453";
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-PAYMENT, PAYMENT-SIGNATURE, X-PAYMENT-DEV, Authorization"
  );
  res.setHeader("Access-Control-Expose-Headers", "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT-RESPONSE");
}

function json(res, status, body, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

function clean(s, max = 2000) {
  return String(s || "")
    .trim()
    .slice(0, max);
}

function sizeFeeCents(bytes) {
  const b = Math.max(0, Number(bytes) || 0);
  const free = 50 * 1024 * 1024;
  const billable = Math.max(0, b - free);
  if (billable <= 0) return 0;
  const gb = billable / (1024 * 1024 * 1024);
  if (gb <= 10) return Math.round(gb * 12);
  if (gb <= 100) return Math.round(10 * 12 + (gb - 10) * 4);
  return Math.round(10 * 12 + 90 * 4 + (gb - 100) * 1.5);
}

function computeQuote({ product = "auto", dataClass = "unknown", op = "compress", bytes = 0 } = {}) {
  const prod = PRODUCT_BASE[product] != null ? product : "auto";
  const cls = DATA_MULT[dataClass] != null ? dataClass : "unknown";
  const operation = OP_MULT[op] != null ? op : "compress";
  const b = Math.max(0, Math.min(Number(bytes) || 0, MAX_BYTES));
  const base = PRODUCT_BASE[prod];
  const size = sizeFeeCents(b);
  const raw = Math.round((base + size) * DATA_MULT[cls] * OP_MULT[operation]);
  const cents = Math.min(MAX_CENTS, Math.max(MIN_CENTS, raw));
  return {
    ok: true,
    service: "SPL Pay Per Suite",
    currency: "usd",
    amount_cents: cents,
    amount_display: (cents / 100).toFixed(2),
    breakdown: {
      product: prod,
      product_base_cents: base,
      size_cents: size,
      data_class: cls,
      data_multiplier: DATA_MULT[cls],
      op: operation,
      op_multiplier: OP_MULT[operation],
      bytes: b,
      mb: +(b / (1024 * 1024)).toFixed(4),
    },
  };
}

function networkConfig() {
  const network = process.env.X402_NETWORK || "solana-mainnet-beta";
  const isMain = /mainnet/i.test(network) || network === "solana";
  const payTo = process.env.X402_PAY_TO || "";
  const asset =
    process.env.X402_ASSET || (isMain ? DEFAULT_USDC_MAINNET : DEFAULT_USDC_DEVNET);
  const decimals = Number(process.env.X402_TOKEN_DECIMALS || 6);
  const rpc =
    process.env.SOLANA_RPC_URL ||
    (isMain ? "https://api.mainnet-beta.solana.com" : "https://api.devnet.solana.com");
  return { network: isMain ? "solana-mainnet-beta" : network, payTo, asset, decimals, rpc, enabled: !!payTo };
}

function baseConfig() {
  const payTo =
    process.env.X402_PAY_TO_BASE ||
    process.env.X402_PAY_TO_EVM ||
    process.env.X402_EVM_PAY_TO ||
    "";
  const asset = process.env.X402_ASSET_BASE || BASE_USDC_MAINNET;
  const decimals = Number(process.env.X402_TOKEN_DECIMALS || 6);
  const rpc = process.env.BASE_RPC_URL || "https://mainnet.base.org";
  const enabled = process.env.X402_BASE_ENABLED !== "0" && !!payTo;
  return { network: BASE_NETWORK, payTo, asset, decimals, rpc, enabled };
}

function isBaseNetwork(n) {
  const s = String(n || "").toLowerCase();
  return s === "eip155:8453" || s === "base" || s === "base-mainnet" || s.includes("8453");
}

function isSolanaNetwork(n) {
  const s = String(n || "").toLowerCase();
  return s.includes("solana") || s.startsWith("solana:");
}

/** USD cents → raw SPL integer string */
function centsToRawAmount(cents, decimals) {
  // amount = cents/100 * 10^decimals
  const whole = BigInt(cents);
  // cents * 10^(decimals-2) when decimals >= 2
  if (decimals >= 2) {
    return (whole * 10n ** BigInt(decimals - 2)).toString();
  }
  return whole.toString();
}

function buildAccepts(quote) {
  const sol = networkConfig();
  const base = baseConfig();
  const extra = {
    amount_cents: quote.amount_cents,
    amount_usd: quote.amount_display,
    quote: quote.breakdown,
    service: "SPL Pay Per Suite",
    human_checkout: "https://www.slidphilabs.com/pps",
  };
  const accepts = [];
  if (sol.enabled || sol.payTo) {
    accepts.push({
      scheme: "exact",
      network: sol.network,
      maxAmountRequired: centsToRawAmount(quote.amount_cents, sol.decimals),
      asset: sol.asset,
      payTo: sol.payTo,
      resource: "spl-pay-per-suite",
      description: `SPL Pay Per Suite · $${quote.amount_display} · Solana USDC`,
      mimeType: "application/json",
      extra: { ...extra, chain: "solana" },
    });
  }
  if (base.enabled) {
    accepts.push({
      scheme: "exact",
      network: base.network,
      maxAmountRequired: centsToRawAmount(quote.amount_cents, base.decimals),
      asset: base.asset,
      payTo: base.payTo,
      resource: "spl-pay-per-suite",
      description: `SPL Pay Per Suite · $${quote.amount_display} · Base USDC`,
      mimeType: "application/json",
      extra: { ...extra, chain: "base", eip3009: true },
    });
  }
  if (!accepts.length) {
    accepts.push({
      scheme: "exact",
      network: sol.network,
      maxAmountRequired: centsToRawAmount(quote.amount_cents, 6),
      asset: sol.asset,
      payTo: "",
      resource: "spl-pay-per-suite",
      description: "Configure X402_PAY_TO / X402_PAY_TO_BASE",
      mimeType: "application/json",
      extra,
    });
  }
  return {
    x402Version: 1,
    accepts,
    error: "Payment required for agentic suite job",
  };
}

function getPaymentHeader(req) {
  const h = req.headers || {};
  return (
    h["x-payment"] ||
    h["X-PAYMENT"] ||
    h["payment-signature"] ||
    h["PAYMENT-SIGNATURE"] ||
    h["x-payment-signature"] ||
    null
  );
}

function decodePayment(headerVal) {
  if (!headerVal) return null;
  try {
    const raw = Buffer.from(String(headerVal).trim(), "base64").toString("utf8");
    return JSON.parse(raw);
  } catch {
    try {
      return JSON.parse(String(headerVal));
    } catch {
      return null;
    }
  }
}

async function solanaRpc(rpc, method, params) {
  const r = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = await r.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.result;
}

/**
 * Verify payment proof from x402-client:
 * { x402Version, scheme, network, payload: { serializedTransaction } }
 * Broadcast + confirm, then accept.
 */
async function verifySolanaPayment(proof, expected) {
  const { rpc, payTo, asset } = networkConfig();
  if (!payTo) {
    return { ok: false, reason: "X402_PAY_TO not configured on server" };
  }

  const ser = proof?.payload?.serializedTransaction || proof?.payload?.transaction;
  const sigOnly = proof?.payload?.signature || proof?.payload?.txSignature;

  if (ser) {
    // send raw if not already on chain
    let signature;
    try {
      signature = await solanaRpc(rpc, "sendTransaction", [
        ser,
        { encoding: "base64", preflightCommitment: "confirmed", skipPreflight: false },
      ]);
    } catch (e) {
      // may already be submitted — try extract signature via simulate or re-throw if no sig
      const msg = String(e.message || e);
      if (/already|duplicate|been processed/i.test(msg) && sigOnly) {
        signature = sigOnly;
      } else if (sigOnly) {
        signature = sigOnly;
      } else {
        // still try confirm path if client only signed
        return { ok: false, reason: `sendTransaction failed: ${msg}` };
      }
    }

    // wait confirm (poll)
    for (let i = 0; i < 12; i++) {
      const st = await solanaRpc(rpc, "getSignatureStatuses", [[signature], { searchTransactionHistory: true }]);
      const v = st?.value?.[0];
      if (v?.confirmationStatus === "confirmed" || v?.confirmationStatus === "finalized") {
        if (v.err) return { ok: false, reason: "tx failed on chain", signature };
        return {
          ok: true,
          signature,
          network: expected.network,
          amount: expected.maxAmountRequired,
          payTo,
          asset,
        };
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    // optimistic accept if submitted (agentic latency) — still return signature
    return {
      ok: true,
      signature,
      network: expected.network,
      amount: expected.maxAmountRequired,
      payTo,
      asset,
      note: "submitted; confirmation pending",
    };
  }

  if (sigOnly) {
    const st = await solanaRpc(rpc, "getSignatureStatuses", [[sigOnly], { searchTransactionHistory: true }]);
    const v = st?.value?.[0];
    if (v && !v.err && (v.confirmationStatus === "confirmed" || v.confirmationStatus === "finalized")) {
      return { ok: true, signature: sigOnly, network: expected.network, payTo, asset };
    }
    return { ok: false, reason: "signature not confirmed", signature: sigOnly };
  }

  return { ok: false, reason: "no serializedTransaction or signature in payment payload" };
}

async function notionCreate(title, note) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return { ok: false, reason: "no_token" };
  const r = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      parent: { database_id: DB },
      properties: {
        Name: { title: [{ text: { content: title.slice(0, 200) } }] },
        Note: { rich_text: [{ text: { content: note.slice(0, 1900) } }] },
        Priority: { select: { name: "High" } },
        Status: { select: { name: "New" } },
      },
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.message || `Notion ${r.status}`);
  return { ok: true, id: data.id };
}

function jobId() {
  return (
    "X402-" +
    Date.now().toString(36).toUpperCase() +
    "-" +
    Math.random().toString(36).slice(2, 8).toUpperCase()
  );
}

function parseBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return null;
    }
  }
  return body || {};
}

function discovery() {
  const { network, payTo, asset, decimals } = networkConfig();
  return {
    service: "SPL Pay Per Suite",
    agentic_commerce: true,
    protocol: "x402",
    human_ui: "https://www.slidphilabs.com/pps",
    endpoints: {
      quote: "POST /api/ppp-quote",
      agent_job: "POST /api/x402-suite",
      stripe_job: "POST /api/ppp-job",
      stripe_checkout: "POST /api/ppp-checkout",
    },
    flow: [
      "POST /api/x402-suite with job JSON (no payment) → 402 + accepts[]",
      "Pay via x402-client payFetch or sign SPL transfer for maxAmountRequired",
      "Retry same POST with X-PAYMENT header (base64 payment proof)",
      "200 + job_id — lab fulfills offline / email",
    ],
    payment: {
      scheme: "exact",
      network,
      asset,
      payTo: payTo || null,
      decimals,
      configured: !!payTo,
    },
    client: {
      npm_hint: "use x402-client payFetch against this URL",
      mcp: "spl_pps_x402_job / spl_pps_x402_info",
      header: "X-PAYMENT",
    },
    note: "Stripe remains for humans. x402 is agent rail only.",
  };
}


function padAddressTopic(addr) {
  const a = String(addr || "").toLowerCase().replace(/^0x/, "");
  return "0x" + a.padStart(64, "0");
}

async function ethRpc(rpc, method, params) {
  const r = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = await r.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.result;
}

async function verifyBasePayment(proof, expected) {
  const base = baseConfig();
  if (!base.payTo) return { ok: false, reason: "X402_PAY_TO_BASE not configured" };
  const asset = (expected.asset || base.asset).toLowerCase();
  const payTo = (expected.payTo || base.payTo).toLowerCase();
  const need = BigInt(expected.maxAmountRequired || "0");
  const txHash =
    proof?.payload?.transaction ||
    proof?.payload?.txHash ||
    proof?.payload?.tx ||
    (typeof proof?.payload?.signature === "string" &&
    String(proof.payload.signature).startsWith("0x") &&
    String(proof.payload.signature).length === 66
      ? proof.payload.signature
      : null);
  if (!txHash || !String(txHash).startsWith("0x")) {
    return { ok: false, reason: "Base requires payload.transaction tx hash" };
  }
  let receipt = null;
  for (let i = 0; i < 8; i++) {
    receipt = await ethRpc(base.rpc, "eth_getTransactionReceipt", [txHash]);
    if (receipt && receipt.status) break;
    await new Promise((r) => setTimeout(r, 750));
  }
  if (!receipt) return { ok: false, reason: "tx not found on Base", signature: txHash };
  if (receipt.status !== "0x1") return { ok: false, reason: "tx failed on Base", signature: txHash };
  const toTopic = padAddressTopic(payTo);
  let paid = 0n;
  for (const log of receipt.logs || []) {
    if (String(log.address || "").toLowerCase() !== asset) continue;
    if (!log.topics || log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) continue;
    if ((log.topics[2] || "").toLowerCase() !== toTopic) continue;
    paid += BigInt(log.data || "0x0");
  }
  if (paid < need) {
    return { ok: false, reason: `USDC to payTo insufficient: ${paid} < ${need}`, signature: txHash };
  }
  return { ok: true, signature: txHash, network: BASE_NETWORK, payTo: base.payTo, asset: base.asset };
}

function selectAccept(proof, requirements) {
  const accepts = requirements?.accepts || [];
  if (!accepts.length) return null;
  const net = proof?.network || proof?.payload?.network || proof?.payload?.chain || null;
  if (net) {
    const hit = accepts.find((a) => {
      const an = String(a.network || "").toLowerCase();
      const pn = String(net).toLowerCase();
      return an === pn || (isBaseNetwork(an) && isBaseNetwork(pn)) || (isSolanaNetwork(an) && isSolanaNetwork(pn));
    });
    if (hit) return hit;
  }
  const tx = proof?.payload?.transaction || proof?.payload?.txHash || proof?.payload?.signature;
  if (typeof tx === "string" && tx.startsWith("0x") && tx.length === 66) {
    return accepts.find((a) => isBaseNetwork(a.network)) || accepts[0];
  }
  if (proof?.payload?.serializedTransaction) {
    return accepts.find((a) => isSolanaNetwork(a.network)) || accepts[0];
  }
  return accepts[0];
}

async function verifyPayment(proof, requirements) {
  const expected = selectAccept(proof, requirements);
  if (!expected) return { ok: false, reason: "no accepts" };
  if (isBaseNetwork(expected.network)) return verifyBasePayment(proof, expected);
  return verifySolanaPayment(proof, expected);
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method === "GET") {
    return json(res, 200, discovery());
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const body = parseBody(req);
  if (body === null) return json(res, 400, { error: "Invalid JSON" });

  const product = clean(body.product || "auto", 40);
  const dataClass = clean(body.dataClass || body.data_class || "unknown", 40);
  const op = clean(body.op || "compress", 20);
  const bytes = Number(body.bytes) || 0;
  const email = clean(body.email, 120);
  const fileName = clean(body.fileName || body.file_name || "", 200);
  const note = clean(body.note, 800);
  const sampleHint = clean(body.sampleHint || body.sample_hint || "", 400);
  const tool = clean(body.tool || product, 40);

  const quote = computeQuote({ product, dataClass, op, bytes });
  const requirements = buildAccepts(quote);
  const accept0 = requirements.accepts[0];
  const { payTo } = networkConfig();

  // Dev bypass for staging agents
  const devHdr = req.headers["x-payment-dev"] || req.headers["X-PAYMENT-DEV"];
  const paymentHdr = getPaymentHeader(req);

  if (!paymentHdr && !(process.env.X402_DEV_BYPASS === "1" && devHdr === "ok")) {
    if (!payTo && process.env.X402_DEV_BYPASS !== "1") {
      return json(res, 503, {
        error: "Agentic x402 not configured",
        hint: "Set X402_PAY_TO (Solana address) on Vercel. Humans use https://www.slidphilabs.com/pps",
        quote,
        discovery: discovery(),
      });
    }
    const b64 = Buffer.from(JSON.stringify(requirements)).toString("base64");
    return json(res, 402, requirements, {
      "PAYMENT-REQUIRED": b64,
      "X-PAYMENT-REQUIRED": b64,
    });
  }

  // Payment present — verify
  let paymentResult = { ok: false };
  if (process.env.X402_DEV_BYPASS === "1" && devHdr === "ok") {
    paymentResult = { ok: true, signature: "dev-bypass", network: accept0.network, note: "X402_DEV_BYPASS" };
  } else {
    const proof = decodePayment(paymentHdr);
    if (!proof) {
      return json(res, 400, { error: "Invalid X-PAYMENT header (expected base64 JSON proof)" });
    }
    try {
      paymentResult = await verifyPayment(proof, requirements);
    } catch (e) {
      return json(res, 402, {
        ...requirements,
        error: "Payment verification failed",
        detail: String(e.message || e).slice(0, 300),
      });
    }
    if (!paymentResult.ok) {
      return json(
        res,
        402,
        {
          ...requirements,
          error: "Payment not accepted",
          detail: paymentResult.reason,
        },
        {
          "PAYMENT-REQUIRED": Buffer.from(JSON.stringify(requirements)).toString("base64"),
        }
      );
    }
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(res, 400, { error: "email must be valid if provided" });
  }

  const id = jobId();
  const title = `X402-JOB ${id} · ${op} · ${tool}`;
  const detail = [
    `Job: ${id}`,
    `Rail: x402 agentic`,
    `Email: ${email || "(none — agent job)"}`,
    `Amount: $${quote.amount_display} (${quote.amount_cents} cents)`,
    `Token raw: ${accept0.maxAmountRequired}`,
    `Network: ${accept0.network}`,
    `PayTo: ${accept0.payTo}`,
    `Asset: ${accept0.asset}`,
    `Tx: ${paymentResult.signature || "(n/a)"}`,
    `Op: ${op}`,
    `Tool: ${tool}`,
    `Product: ${product}`,
    `Data class: ${dataClass}`,
    `Bytes: ${bytes}`,
    `File: ${fileName || "(none)"}`,
    `Sample: ${sampleHint || "(none)"}`,
    `Note: ${note || "(none)"}`,
    `Payment note: ${paymentResult.note || ""}`,
  ].join("\n");

  let notion = { ok: false };
  try {
    notion = await notionCreate(title, detail);
  } catch (e) {
    notion = { ok: false, reason: String(e.message || e).slice(0, 200) };
  }

  const paymentResponse = {
    success: true,
    transaction: paymentResult.signature,
    network: paymentResult.network || accept0.network,
  };

  return json(
    res,
    200,
    {
      ok: true,
      service: "SPL Pay Per Suite",
      rail: "x402",
      job_id: id,
      quote,
      payment: paymentResponse,
      notion: notion.ok,
      message:
        "Agent job accepted. Lab runs the best available tool for your data class. Results email if provided.",
      human_ui: "https://www.slidphilabs.com/pps",
    },
    {
      "PAYMENT-RESPONSE": Buffer.from(JSON.stringify(paymentResponse)).toString("base64"),
      "X-PAYMENT-RESPONSE": Buffer.from(JSON.stringify(paymentResponse)).toString("base64"),
    }
  );
}
