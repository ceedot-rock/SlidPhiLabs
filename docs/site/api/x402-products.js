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
 *   X402_CLAIM_SECRET  optional HMAC for Access claim (falls back to STRIPE_* keys)
 */

import { signClaim } from "./lib/x402-claim.mjs";
import {
  buildDeliverable,
  normalizeSku as accessNormalizeSku,
} from "./access-verify.js";

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
  "chamber-day": {
    name: "Chamber · Day",
    amount_cents: 1250,
    stripe: "https://buy.stripe.com/14A4gAebHcxG0CV9kA6wE0x",
    kind: "chamber",
    blurb: "Security only · $12.50 · no TRU8 production",
    access: "https://www.slidphilabs.com/access?product=chamber-day",
    fulfill_email: "corey@slidphilabs.com",
  },
  "chamber-month": {
    name: "Chamber · Month",
    amount_cents: 8750,
    stripe: "https://buy.stripe.com/3cI5kEffL0OY4TbfIY6wE0y",
    kind: "chamber",
    blurb: "Security only · $87.50 · no TRU8 production",
    access: "https://www.slidphilabs.com/access?product=chamber-month",
    fulfill_email: "corey@slidphilabs.com",
  },
  "chamber-year": {
    name: "Chamber · Year",
    amount_cents: 95000,
    stripe: "https://buy.stripe.com/7sYfZid7D55edpHcwM6wE0z",
    kind: "chamber",
    blurb: "Security only · $950 · half of TRU8 Year · no TRU8 production",
    access: "https://www.slidphilabs.com/access?product=chamber-year",
    fulfill_email: "corey@slidphilabs.com",
  },
  "tru8-day": {
    name: "TRU8 · Day",
    amount_cents: 2499,
    stripe: "https://buy.stripe.com/4gM3cw0kR9lu4Tb54k6wE0A",
    kind: "tru8",
    blurb: "TRU8 production only · $24.99 · no Chamber seat",
    access: "https://www.slidphilabs.com/access?product=tru8-day",
    fulfill_email: "corey@slidphilabs.com",
  },
  "tru8-month": {
    name: "TRU8 · Month",
    amount_cents: 17500,
    stripe: "https://buy.stripe.com/8x23cw9Vr0OY85n54k6wE0B",
    kind: "tru8",
    blurb: "TRU8 production only · $175 · no Chamber seat",
    access: "https://www.slidphilabs.com/access?product=tru8-month",
    fulfill_email: "corey@slidphilabs.com",
  },
  "tru8-year": {
    name: "TRU8 · Year (both products + seat)",
    amount_cents: 190000,
    stripe: "https://buy.stripe.com/dRmaEYgjPbtCclDaoE6wE0C",
    kind: "both",
    blurb: "Both products + seat for full year · $1,900 · Chamber + TRU8",
    access: "https://www.slidphilabs.com/access?product=tru8-year",
    fulfill_email: "corey@slidphilabs.com",
  },
  "tru8-commercial": {
    name: "TRU8 · Year (legacy alias)",
    amount_cents: 190000,
    stripe: "https://buy.stripe.com/dRmaEYgjPbtCclDaoE6wE0C",
    kind: "both",
    retired_as: "tru8-year",
    blurb: "Alias of tru8-year $1,900 — both products for one year.",
    access: "https://www.slidphilabs.com/access?product=tru8-year",
    fulfill_email: "corey@slidphilabs.com",
  },
  "truchamber-day": {
    name: "TRU8 · Day (legacy alias)",
    amount_cents: 2499,
    stripe: "https://buy.stripe.com/4gM3cw0kR9lu4Tb54k6wE0A",
    kind: "tru8",
    retired_as: "tru8-day",
    blurb: "Alias of tru8-day.",
    access: "https://www.slidphilabs.com/access?product=tru8-day",
    fulfill_email: "corey@slidphilabs.com",
  },
  "truchamber-month": {
    name: "TRU8 · Month (legacy alias)",
    amount_cents: 17500,
    stripe: "https://buy.stripe.com/8x23cw9Vr0OY85n54k6wE0B",
    kind: "tru8",
    retired_as: "tru8-month",
    blurb: "Alias of tru8-month.",
    access: "https://www.slidphilabs.com/access?product=tru8-month",
    fulfill_email: "corey@slidphilabs.com",
  },
  "truchamber-year": {
    name: "TRU8 · Year (legacy alias)",
    amount_cents: 190000,
    stripe: "https://buy.stripe.com/dRmaEYgjPbtCclDaoE6wE0C",
    kind: "both",
    retired_as: "tru8-year",
    blurb: "Alias of tru8-year $1,900 — both products for one year.",
    access: "https://www.slidphilabs.com/access?product=tru8-year",
    fulfill_email: "corey@slidphilabs.com",
  },
  "json-chamber": {
    name: "json-chamber unlock (retired)",
    amount_cents: 9900,
    stripe: "https://buy.stripe.com/7sYbJ27NjfJSbhz8gw6wE09",
    kind: "retired",
    retired: true,
    blurb:
      "Retired public offer. $99 forever unlock undercut every paid tier. Use Chamber or TRU8 Day/Month/Year.",
    access: "https://www.slidphilabs.com/chamber",
  },
  "cddg-split": {
    name: "CDDG:Split",
    amount_cents: 19900,
    stripe: "https://buy.stripe.com/14A4gA4B79lu71jdAQ6wE0f",
    kind: "historical-process",
    blurb: "Historical process product — residual workloads. Not TruChamber. Not TRU8.",
  },
  "zrw-n00b": {
    name: "ZRW N00b",
    amount_cents: 7900,
    stripe: "https://buy.stripe.com/28EfZic3z69i3P72Wc6wE0b",
    kind: "historical-license",
    blurb: "Historical ZRW engine license (entry). Not TruChamber. Not TRU8.",
  },
  "zrw-pro": {
    name: "ZRW Pro",
    amount_cents: 24900,
    stripe: "https://buy.stripe.com/cNidRaebHbtC71j8gw6wE0c",
    kind: "historical-license",
    blurb: "Historical ZRW engine license (Pro). Not TruChamber. Not TRU8.",
  },
  "zrw-l33t": {
    name: "ZRW L33t$aUC3",
    amount_cents: 69900,
    stripe: "https://buy.stripe.com/14AeVe9Vr8hqadvbsI6wE0d",
    kind: "historical-license",
    blurb: "Historical ZRW engine license (business). Not TruChamber. Not TRU8.",
  },
  blackjack: {
    name: "Blackjack",
    amount_cents: 19900,
    stripe: "https://buy.stripe.com/00w00k6Jf8hqgBTaoE6wE0h",
    kind: "support-oss",
    oss_npm: "blackjack-compression",
    blurb:
      "$199 = commercial support / integration / indemnification for the already-public blackjack-compression library. You do not receive a secret extra engine.",
  },
  "shard-zip": {
    name: "shard-zip",
    amount_cents: 19900,
    stripe: "https://buy.stripe.com/3cI7sMd7D8hq1GZaoE6wE0i",
    kind: "support-oss",
    oss_npm: "shard-zip",
    blurb:
      "$199 = commercial support / integration / indemnification for the already-public shard-zip library. You do not receive a secret extra engine.",
  },
  "shard-tsdb": {
    name: "shard-tsdb",
    amount_cents: 19900,
    stripe: "https://buy.stripe.com/9B628sd7DeFO99r9kA6wE0j",
    kind: "support-oss",
    oss_npm: "shard-tsdb",
    blurb:
      "$199 = commercial support / integration / indemnification for the already-public shard-tsdb library. You do not receive a secret extra engine.",
  },
  "slid-phi": {
    name: "slid-phi",
    amount_cents: 19900,
    stripe: "https://buy.stripe.com/dRm6oI6JfgNWetL8gw6wE0k",
    kind: "stub",
    blurb: "Public npm stub / quote rail — not a private engine dump.",
  },
  "support-integration": {
    name: "Support + Integration",
    amount_cents: 19900,
    stripe: "https://buy.stripe.com/8x28wQebH41a85n2Wc6wE0l",
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
    blurb: "Retired. Use Suite meter on /pps (100 GB free). Not a Chamber unlock. Not a TRU8 license.",
  },
  "gao-entry": {
    name: "Great Agentic Olympiad Entry",
    amount_cents: 100,
    stripe: "https://buy.stripe.com/8x24gAd7D7dm2L31S86wE0m",
    kind: "olympiad",
    blurb:
      "$1 GAO seat — agent self-enter or human. Sponsored by Slid Phi Labs · slidphilabs.com",
    access: "https://www.slidphilabs.com/olympiad",
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
  gao: "gao-entry",
  olympiad: "gao-entry",
  "olympiad-entry": "gao-entry",
  "great-agentic-olympiad": "gao-entry",
  tru8: "truchamber-year",
  "tru8-chamber": "truchamber-year",
  license: "truchamber-year",
  studio: "truchamber-year",
  commercial: "truchamber-year",
  "tru8-commercial": "truchamber-year",
  chamber: "chamber-year",
  truchamber: "chamber-year",
  "tru-chamber": "truchamber-month",
  unlock: "truchamber-day",
  security: "chamber-year",
  "chamber-only": "chamber-year",
  both: "truchamber-year",
  full: "truchamber-year",
  day: "truchamber-day",
  "day-pass": "truchamber-day",
  month: "truchamber-month",
  monthly: "truchamber-month",
  year: "truchamber-year",
  yearly: "truchamber-year",
  annual: "truchamber-year",
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
  const payTo = (
    process.env.X402_PAY_TO ||
    process.env.PAY_SOLANA_ADDRESS ||
    process.env.BLOKZ_SOLANA_ADDRESS ||
    ""
  ).trim();
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
  const payTo = (
    process.env.X402_PAY_TO_BASE ||
    process.env.X402_PAY_TO_EVM ||
    process.env.X402_EVM_PAY_TO ||
    process.env.PAY_EVM_ADDRESS ||
    process.env.BLOKZ_WALLET_ADDRESS ||
    ""
  ).trim();
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
  const out = {
    sku,
    name: p.name,
    amount_cents: p.amount_cents,
    amount_usd: (p.amount_cents / 100).toFixed(2),
    kind: p.kind,
    blurb: p.blurb,
    human_stripe: p.stripe || null,
    agent_buy: "POST /api/x402-products",
  };
  if (p.oss_npm) out.oss_npm = p.oss_npm;
  if (p.access) out.access = p.access;
  if (sku === "gao-entry") {
    out.sponsor = "Slid Phi Labs · slidphilabs.com";
    out.olympiad = "https://www.slidphilabs.com/olympiad";
  }
  return out;
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
    human_stripe: p.stripe || null,
    access:
      p.access ||
      "https://www.slidphilabs.com/access?product=" + encodeURIComponent(sku),
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
    note: "Stripe for humans. Agents: POST sku → 402 accepts[] (Solana + Base) → pay → X-PAYMENT → claim_token + entitlement. Open access_url or GET /api/access-verify?claim=spl1.…",
    product_face: "Chamber + TRU8",
    x402_access_autoclaim: true,
    access_claim: "GET /api/access-verify?claim=<claim_token>&product=<sku>",
    fulfill_email: "corey@slidphilabs.com",
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
      known: Object.keys(CATALOG).filter((k) => !CATALOG[k].retired),
      aliases: Object.keys(ALIASES),
      suite_free: "Use POST /api/x402-suite with bytes ≤ 1GiB free — try-gate is retired",
    });
  }
  if (CATALOG[sku].retired) {
    return json(res, 410, {
      error: "product_retired",
      sku,
      message: "Try Gate is retired. Use freemium suite: free first 100 GB then ~1.5¢/GB.",
      suite: "https://www.slidphilabs.com/pps",
      x402_suite: "POST /api/x402-suite",
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
  const net = paymentResult.network || accept0.network;
  const tx = paymentResult.signature || null;

  const signed = signClaim({
    order_id: id,
    sku,
    email: email || null,
    tx,
    network: net,
    amount_cents: p.amount_cents,
  });

  const deliverable = buildDeliverable({
    paid: true,
    sku: accessNormalizeSku(sku) || sku,
    sessionId: id,
    email: email || null,
    amountTotal: p.amount_cents,
    currency: "usd",
  });
  if (deliverable.entitlement) {
    deliverable.entitlement.rail = "x402";
    deliverable.entitlement.order_id = id;
    deliverable.entitlement.tx = tx;
    deliverable.entitlement.network = net;
  }

  const claimToken = signed.ok ? signed.token : null;
  const accessUrl =
    `https://www.slidphilabs.com/access?product=${encodeURIComponent(sku)}` +
    (claimToken ? `&claim=${encodeURIComponent(claimToken)}` : "");

  const title = `X402-PRODUCT ${id} · ${p.name}`;
  const detail = [
    `Order: ${id}`,
    `Rail: x402 agentic product · auto-claim ON`,
    `SKU: ${sku}`,
    `Name: ${p.name}`,
    `Amount: $${(p.amount_cents / 100).toFixed(2)}`,
    `Email: ${email || "(none)"}`,
    `Tx: ${tx || "(n/a)"}`,
    `Network: ${net}`,
    `Claim: ${claimToken ? "issued" : "FAILED " + (signed.error || "")}`,
    `Access: ${accessUrl}`,
    `Note: ${note || "(none)"}`,
    `PACKAGE ACCESS → corey@slidphilabs.com`,
  ].join("\n");

  let notion = { ok: false };
  try {
    notion = await notionCreate(title, detail);
  } catch (e) {
    notion = { ok: false, reason: String(e.message || e).slice(0, 200) };
  }

  const paymentResponse = {
    success: true,
    transaction: tx,
    network: net,
  };

  return json(
    res,
    200,
    {
      ok: true,
      rail: "x402",
      auto_claim: true,
      order_id: id,
      sku,
      product: publicProduct(sku),
      payment: paymentResponse,
      claim_token: claimToken,
      claim_expires_at: signed.ok ? signed.expires_at : null,
      claim_error: signed.ok ? null : signed.error,
      entitlement: deliverable.entitlement || null,
      deliverable,
      notion: notion.ok,
      access_url: accessUrl,
      access_verify:
        claimToken
          ? `https://www.slidphilabs.com/api/access-verify?product=${encodeURIComponent(sku)}&claim=${encodeURIComponent(claimToken)}`
          : null,
      package_access_email: "corey@slidphilabs.com",
      message: claimToken
        ? `Payment accepted for ${p.name}. Access auto-claim ready — open access_url or use claim_token with GET /api/access-verify.`
        : `Payment accepted for ${p.name}. Claim token failed (${signed.error}); email PACKAGE ACCESS to corey@slidphilabs.com with order ${id}.`,
    },
    {
      "PAYMENT-RESPONSE": Buffer.from(JSON.stringify(paymentResponse)).toString("base64"),
      "X-PAYMENT-RESPONSE": Buffer.from(JSON.stringify(paymentResponse)).toString("base64"),
    }
  );
}
