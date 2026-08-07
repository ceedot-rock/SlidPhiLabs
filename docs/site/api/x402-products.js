/**
 * x402 agentic commerce — all standing Slid Phi Labs products
 *
 * GET  /api/x402-products           → full catalog (sku, price, stripe human link)
 * GET  /api/x402-products?sku=…     → one product + sample 402 accepts
 * POST /api/x402-products           → buy product
 *   body: { sku, email?, note? }
 *   no payment → 402 + accepts[] (Solana mainnet USDC + Base mainnet USDC)
 *   X-PAYMENT  → verify Solana SPL or Base USDC → entitlement / access job logged
 *
 * Humans keep Stripe buy links. Agents use this rail for every standing SKU.
 *
 * Env:
 *   X402_PAY_TO        Solana base58 receive
 *   X402_PAY_TO_BASE   Base 0x receive (or X402_PAY_TO_EVM)
 *   X402_ASSET         Solana USDC mint (default mainnet)
 *   X402_ASSET_BASE    Base USDC (default Circle mainnet)
 *   X402_NETWORK       solana-mainnet-beta (default)
 *   SOLANA_RPC_URL, BASE_RPC_URL, X402_DEV_BYPASS
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

const DEFAULT_USDC_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const DEFAULT_USDC_DEVNET = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const BASE_USDC_MAINNET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE_NETWORK = "eip155:8453";
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/** Standing products — cents match public Stripe catalog */
const CATALOG = {
  "cddg-split": {
    name: "CDDG:Split",
    amount_cents: 19900,
    stripe: "https://buy.stripe.com/14A4gA4B79lu71jdAQ6wE0f",
    kind: "license",
    blurb: "Process product — residual workloads",
  },
  "zrw-n00b": {
    name: "ZRW N00b",
    amount_cents: 7900,
    stripe: "https://buy.stripe.com/28EfZic3z69i3P72Wc6wE0b",
    kind: "license",
    blurb: "Zero Range Wave commercial entry",
  },
  "zrw-pro": {
    name: "ZRW Pro",
    amount_cents: 24900,
    stripe: "https://buy.stripe.com/cNidRaebHbtC71j8gw6wE0c",
    kind: "license",
    blurb: "ZRW Pro commercial tier",
  },
  "zrw-l33t": {
    name: "ZRW L33t$aUC3",
    amount_cents: 69900,
    stripe: "https://buy.stripe.com/14AeVe9Vr8hqadvbsI6wE0d",
    kind: "license",
    blurb: "Business / unlimited ZRW tier",
  },
  blackjack: {
    name: "Blackjack",
    amount_cents: 19900,
    stripe: "https://buy.stripe.com/7sYbJ27NjfJSbhz8gw6wE09",
    kind: "license",
    blurb: "Multi-path integer / mixed series",
  },
  "shard-zip": {
    name: "shard-zip",
    amount_cents: 19900,
    stripe: "https://buy.stripe.com/7sYbJ27NjfJSbhz8gw6wE09",
    kind: "license",
    blurb: "Adaptive structured packaging",
  },
  "shard-tsdb": {
    name: "shard-tsdb",
    amount_cents: 19900,
    stripe: "https://buy.stripe.com/7sYbJ27NjfJSbhz8gw6wE09",
    kind: "license",
    blurb: "Time-series shard packaging",
  },
  "slid-phi": {
    name: "slid-phi",
    amount_cents: 19900,
    stripe: "https://buy.stripe.com/7sYbJ27NjfJSbhz8gw6wE09",
    kind: "license",
    blurb: "Omni-Dormant pathways",
  },
  "support-integration": {
    name: "Support + Integration",
    amount_cents: 19900,
    stripe: "https://buy.stripe.com/7sYbJ27NjfJSbhz8gw6wE09",
    kind: "service",
    blurb: "Pathway choice, benches, email Q&A",
  },
  consulting: {
    name: "Consulting",
    amount_cents: 25000,
    stripe: "https://buy.stripe.com/eVqfZi0kR41a4TbgN26wE02",
    kind: "service",
    blurb: "Scoped lab session",
  },
  sponsor: {
    name: "Sponsor",
    amount_cents: 2900,
    stripe: "https://buy.stripe.com/cNi6oI8RnbtCgBTgN26wE01",
    kind: "support",
    blurb: "Support the lab",
  },
  donate: {
    name: "Donate",
    amount_cents: 2999,
    stripe: "https://buy.stripe.com/eVq9AUd7D0OY0CVdAQ6wE0a",
    kind: "support",
    blurb: "General lab support",
  },
  "try-gate": {
    retired: true,
    name: "Try Gate (retired — use free suite)",
    amount_cents: 900,
    stripe: "https://donate.stripe.com/eVq8wQffL2X60CVfIY6wE0e",
    kind: "support",
    blurb: "Unlock Free Gate evaluation seat",
  },
};

const ALIASES = {
  residual: "cddg-split",
  "residual-governance": "cddg-split",
  twin: "cddg-split",
  cddg: "cddg-split",
  split: "cddg-split",
  zrw: "zrw-n00b",
  n00b: "zrw-n00b",
  noob: "zrw-n00b",
  starting: "zrw-n00b",
  "zrw-starting-gate": "zrw-n00b",
  "starting-gate": "zrw-n00b",
  pro: "zrw-pro",
  "zrw-pro-starter": "zrw-pro",
  l33t: "zrw-l33t",
  "l33t-sauc3": "zrw-l33t",
  "zrw-l33t-unlimited": "zrw-l33t",
  unlimited: "zrw-l33t",
  support: "support-integration",
  integration: "support-integration",
  chip: "try-gate",
  "try-gate-chip-in": "try-gate",
  donation: "donate",
};

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-PAYMENT, PAYMENT-SIGNATURE, X-PAYMENT-DEV, Authorization"
  );
  res.setHeader(
    "Access-Control-Expose-Headers",
    "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT-RESPONSE"
  );
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

function resolveSku(raw) {
  const k = String(raw || "")
    .trim()
    .toLowerCase();
  if (!k) return null;
  if (CATALOG[k]) return k;
  if (ALIASES[k]) return ALIASES[k];
  return null;
}

function solanaConfig() {
  const network = process.env.X402_NETWORK || "solana-mainnet-beta";
  const isMain = /mainnet/i.test(network) || network === "solana";
  const payTo = process.env.X402_PAY_TO || "";
  const asset =
    process.env.X402_ASSET || (isMain ? DEFAULT_USDC_MAINNET : DEFAULT_USDC_DEVNET);
  const decimals = Number(process.env.X402_TOKEN_DECIMALS || 6);
  const rpc =
    process.env.SOLANA_RPC_URL ||
    (isMain ? "https://api.mainnet-beta.solana.com" : "https://api.devnet.solana.com");
  return {
    network: isMain ? "solana-mainnet-beta" : network,
    payTo,
    asset,
    decimals,
    rpc,
    enabled: !!payTo,
  };
}

function networkConfig() {
  return solanaConfig();
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
  return {
    network: BASE_NETWORK,
    payTo,
    asset,
    decimals,
    rpc,
    enabled,
  };
}

function isBaseNetwork(n) {
  const s = String(n || "").toLowerCase();
  return (
    s === "eip155:8453" ||
    s === "base" ||
    s === "base-mainnet" ||
    s === "base-mainnet-beta" ||
    s.includes("8453")
  );
}

function isSolanaNetwork(n) {
  const s = String(n || "").toLowerCase();
  return s.includes("solana") || s.startsWith("solana:");
}

function centsToRawAmount(cents, decimals) {
  const whole = BigInt(cents);
  if (decimals >= 2) return (whole * 10n ** BigInt(decimals - 2)).toString();
  return whole.toString();
}

function publicProduct(sku) {
  const p = CATALOG[sku];
  if (!p) return null;
  return {
    sku,
    name: p.name,
    amount_cents: p.amount_cents,
    amount_usd: (p.amount_cents / 100).toFixed(2),
    kind: p.kind,
    blurb: p.blurb,
    human_stripe: p.stripe,
    agent_buy: "POST /api/x402-products",
  };
}

function buildAccepts(sku) {
  const p = CATALOG[sku];
  const sol = solanaConfig();
  const base = baseConfig();
  const extra = {
    sku,
    name: p.name,
    amount_cents: p.amount_cents,
    amount_usd: (p.amount_cents / 100).toFixed(2),
    kind: p.kind,
    human_stripe: p.stripe,
    access: "https://www.slidphilabs.com/access?product=" + encodeURIComponent(sku),
  };
  const accepts = [];
  if (sol.enabled) {
    accepts.push({
      scheme: "exact",
      network: sol.network,
      maxAmountRequired: centsToRawAmount(p.amount_cents, sol.decimals),
      asset: sol.asset,
      payTo: sol.payTo,
      resource: `spl-product:${sku}`,
      description: `${p.name} · $${(p.amount_cents / 100).toFixed(2)} · Solana USDC · Slid Phi Labs`,
      mimeType: "application/json",
      extra: { ...extra, chain: "solana" },
    });
  }
  if (base.enabled) {
    accepts.push({
      scheme: "exact",
      network: base.network,
      maxAmountRequired: centsToRawAmount(p.amount_cents, base.decimals),
      asset: base.asset,
      payTo: base.payTo,
      resource: `spl-product:${sku}`,
      description: `${p.name} · $${(p.amount_cents / 100).toFixed(2)} · Base USDC · Slid Phi Labs`,
      mimeType: "application/json",
      extra: { ...extra, chain: "base", eip3009: true },
    });
  }
  if (!accepts.length) {
    accepts.push({
      scheme: "exact",
      network: sol.network,
      maxAmountRequired: centsToRawAmount(p.amount_cents, 6),
      asset: sol.asset,
      payTo: "",
      resource: `spl-product:${sku}`,
      description: `${p.name} · configure X402_PAY_TO / X402_PAY_TO_BASE`,
      mimeType: "application/json",
      extra,
    });
  }
  return {
    x402Version: 1,
    accepts,
    error: `Payment required for ${p.name}`,
  };
}

function getPaymentHeader(req) {
  const h = req.headers || {};
  return (
    h["x-payment"] ||
    h["X-PAYMENT"] ||
    h["payment-signature"] ||
    h["PAYMENT-SIGNATURE"] ||
    null
  );
}

function decodePayment(headerVal) {
  if (!headerVal) return null;
  try {
    return JSON.parse(Buffer.from(String(headerVal).trim(), "base64").toString("utf8"));
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

async function verifySolanaPayment(proof, expected) {
  const { rpc, payTo, asset } = solanaConfig();
  if (!payTo) return { ok: false, reason: "X402_PAY_TO not configured" };

  const ser = proof?.payload?.serializedTransaction || proof?.payload?.transaction;
  const sigOnly = proof?.payload?.signature || proof?.payload?.txSignature;

  if (ser && !String(ser).startsWith("0x")) {
    let signature;
    try {
      signature = await solanaRpc(rpc, "sendTransaction", [
        ser,
        { encoding: "base64", preflightCommitment: "confirmed", skipPreflight: false },
      ]);
    } catch (e) {
      const msg = String(e.message || e);
      if (sigOnly) signature = sigOnly;
      else return { ok: false, reason: `sendTransaction failed: ${msg}` };
    }
    for (let i = 0; i < 12; i++) {
      const st = await solanaRpc(rpc, "getSignatureStatuses", [
        [signature],
        { searchTransactionHistory: true },
      ]);
      const v = st?.value?.[0];
      if (v?.confirmationStatus === "confirmed" || v?.confirmationStatus === "finalized") {
        if (v.err) return { ok: false, reason: "tx failed on chain", signature };
        return { ok: true, signature, network: expected.network, payTo, asset };
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    return {
      ok: true,
      signature,
      network: expected.network,
      payTo,
      asset,
      note: "submitted; confirmation pending",
    };
  }

  if (sigOnly && !String(sigOnly).startsWith("0x")) {
    const st = await solanaRpc(rpc, "getSignatureStatuses", [
      [sigOnly],
      { searchTransactionHistory: true },
    ]);
    const v = st?.value?.[0];
    if (v && !v.err && (v.confirmationStatus === "confirmed" || v.confirmationStatus === "finalized")) {
      return { ok: true, signature: sigOnly, network: expected.network, payTo, asset };
    }
    return { ok: false, reason: "signature not confirmed", signature: sigOnly };
  }

  return { ok: false, reason: "no serializedTransaction or signature in payment payload" };
}

function padAddressTopic(addr) {
  const a = String(addr || "")
    .toLowerCase()
    .replace(/^0x/, "");
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
    return {
      ok: false,
      reason:
        "Base payment requires on-chain tx hash in payload.transaction (USDC transfer or transferWithAuthorization receipt)",
    };
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
  const logs = receipt.logs || [];
  let paid = 0n;
  for (const log of logs) {
    if (String(log.address || "").toLowerCase() !== asset) continue;
    if (!log.topics || log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) continue;
    if ((log.topics[2] || "").toLowerCase() !== toTopic) continue;
    paid += BigInt(log.data || "0x0");
  }
  if (paid < need) {
    return {
      ok: false,
      reason: `USDC Transfer to payTo insufficient: got ${paid} need ${need}`,
      signature: txHash,
    };
  }
  return {
    ok: true,
    signature: txHash,
    network: BASE_NETWORK,
    payTo: base.payTo,
    asset: base.asset,
    amount: paid.toString(),
  };
}

function selectAccept(proof, requirements) {
  const accepts = requirements?.accepts || [];
  if (!accepts.length) return null;
  const net = proof?.network || proof?.payload?.network || proof?.payload?.chain || null;
  if (net) {
    const hit = accepts.find((a) => {
      const an = String(a.network || "").toLowerCase();
      const pn = String(net).toLowerCase();
      return (
        an === pn ||
        (isBaseNetwork(an) && isBaseNetwork(pn)) ||
        (isSolanaNetwork(an) && isSolanaNetwork(pn))
      );
    });
    if (hit) return hit;
  }
  const tx =
    proof?.payload?.transaction || proof?.payload?.txHash || proof?.payload?.signature;
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

function orderId(sku) {
  return (
    "X402-" +
    sku
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "")
      .slice(0, 12) +
    "-" +
    Date.now().toString(36).toUpperCase() +
    "-" +
    Math.random().toString(36).slice(2, 6).toUpperCase()
  );
}

function catalogResponse() {
  const sol = solanaConfig();
  const base = baseConfig();
  const products = Object.keys(CATALOG)
    .filter((sku) => !CATALOG[sku].retired)
    .map((sku) => publicProduct(sku));
  const rails = [];
  if (sol.enabled) {
    rails.push({
      scheme: "exact",
      network: sol.network,
      asset: sol.asset,
      payTo: sol.payTo,
      decimals: sol.decimals,
      chain: "solana",
    });
  }
  if (base.enabled) {
    rails.push({
      scheme: "exact",
      network: base.network,
      asset: base.asset,
      payTo: base.payTo,
      decimals: base.decimals,
      chain: "base",
    });
  }
  return {
    service: "Slid Phi Labs",
    protocol: "x402",
    rail: "agent",
    human_ui: "https://www.slidphilabs.com",
    suite_jobs: "POST /api/x402-suite",
    buy_product: "POST /api/x402-products",
    payment_header: "X-PAYMENT",
    payment: rails[0] || {
      scheme: "exact",
      network: sol.network,
      asset: sol.asset,
      payTo: null,
      decimals: 6,
      configured: false,
    },
    payment_rails: rails,
    configured: rails.length > 0,
    products,
    aliases: ALIASES,
    client_compat:
      "x402 exact · Solana SPL (serialized tx) and/or Base USDC (tx hash after EIP-3009/transfer)",
    note: "Stripe for humans. Agents: POST sku → 402 accepts[] (Solana + Base mainnet) → pay → X-PAYMENT.",
  };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method === "GET") {
    const url = new URL(req.url || "/", "https://www.slidphilabs.com");
    const qSku = resolveSku(url.searchParams.get("sku") || url.searchParams.get("product"));
    if (qSku) {
      const pub = publicProduct(qSku);
      const requirements = buildAccepts(qSku);
      return json(res, 200, {
        ...pub,
        sample_402: requirements,
        how: "POST /api/x402-products with { sku } → 402; pay; retry with X-PAYMENT",
      });
    }
    return json(res, 200, catalogResponse());
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return json(res, 400, { error: "Invalid JSON" });
    }
  }
  body = body || {};

  const sku = resolveSku(body.sku || body.product || body.id);
  if (!sku || !CATALOG[sku]) {
    return json(res, 400, {
      error: "Unknown product sku",
      known: Object.keys(CATALOG),
      aliases: Object.keys(ALIASES),
    });
  }

  const email = clean(body.email, 120);
  const note = clean(body.note, 800);
  const p = CATALOG[sku];
  const requirements = buildAccepts(sku);
  const accept0 = requirements.accepts[0];

  const devHdr = req.headers["x-payment-dev"] || req.headers["X-PAYMENT-DEV"];
  const paymentHdr = getPaymentHeader(req);

  if (!paymentHdr && !(process.env.X402_DEV_BYPASS === "1" && devHdr === "ok")) {
    const sol = solanaConfig();
    const base = baseConfig();
    if (!sol.enabled && !base.enabled && process.env.X402_DEV_BYPASS !== "1") {
      return json(res, 503, {
        error: "Agentic x402 not configured",
        hint: "Set X402_PAY_TO (Solana) and/or X402_PAY_TO_BASE (EVM 0x) on Vercel",
        product: publicProduct(sku),
        human_stripe: p.stripe,
      });
    }
    const b64 = Buffer.from(JSON.stringify(requirements)).toString("base64");
    return json(res, 402, requirements, {
      "PAYMENT-REQUIRED": b64,
      "X-PAYMENT-REQUIRED": b64,
    });
  }

  let paymentResult = { ok: false };
  if (process.env.X402_DEV_BYPASS === "1" && devHdr === "ok") {
    paymentResult = { ok: true, signature: "dev-bypass", network: accept0.network };
  } else {
    const proof = decodePayment(paymentHdr);
    if (!proof) return json(res, 400, { error: "Invalid X-PAYMENT header" });
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
      return json(res, 402, {
        ...requirements,
        error: "Payment not accepted",
        detail: paymentResult.reason,
      });
    }
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(res, 400, { error: "email must be valid if provided" });
  }

  const id = orderId(sku);
  const title = `X402-PRODUCT ${id} · ${p.name}`;
  const detail = [
    `Order: ${id}`,
    `Rail: x402 agentic product`,
    `SKU: ${sku}`,
    `Name: ${p.name}`,
    `Amount: $${(p.amount_cents / 100).toFixed(2)}`,
    `Email: ${email || "(none)"}`,
    `Tx: ${paymentResult.signature || "(n/a)"}`,
    `Network: ${paymentResult.network || accept0.network}`,
    `Note: ${note || "(none)"}`,
    `Deliver: license / access — see /access?product=${sku}`,
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
      rail: "x402",
      order_id: id,
      sku,
      product: publicProduct(sku),
      payment: paymentResponse,
      notion: notion.ok,
      access_url: `https://www.slidphilabs.com/access?product=${encodeURIComponent(sku)}`,
      message: `Payment accepted for ${p.name}. Claim package on Access (email if provided).`,
    },
    {
      "PAYMENT-RESPONSE": Buffer.from(JSON.stringify(paymentResponse)).toString("base64"),
      "X-PAYMENT-RESPONSE": Buffer.from(JSON.stringify(paymentResponse)).toString("base64"),
    }
  );
}
