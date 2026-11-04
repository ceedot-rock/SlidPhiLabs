/**
 * ACN (Agent Commerce Network) — one runtime over the lab's agent pieces.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * Rider says who acts. Warrant caps what they may do. Tollkeeper prices the
 * crossing and signs a receipt. Quikgater fetches on 402-then-pay. PCC packs
 * the bytes the suite meter quotes. AWLpay names the fee and the rail, x402
 * captures agent USDC. PSI keeps the memory line. Conductor seals a
 * reproducible receipt for the whole run.
 * Additive: existing routes and tools are untouched. Defaults do no network
 * and no disk writes except the warrant paper trail, which is existing
 * server behavior (same as spl_warrant_issue / spl_warrant_receipt).
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import { ACTIONS, cleanChain, fileReceipt, hostAllowed, issueWarrant, verifyWarrant } from "./warrant.mjs";
import { computeQuote } from "../suite-pricing.js";

export const AGENTIC_VERSION = "0.1.0";
export const PLATFORM_NAME = "ACN";
export const PLATFORM_FULL_NAME = "Agent Commerce Network";
export const AWLPAY_BASE = "https://awlpay.fly.dev";

/**
 * agenTill counterpart map (read from WalletVerse source, no code copied).
 * tolls: per-tool metering, integer cents, deterministic receipts, x402.
 * grants: short-lived scoped grants, tools/scopes/exp, HMAC.
 * settle: computes and marks platform fees, never moves money.
 */
export const AGENTILL_MAP = Object.freeze({
  rider: { agentill: "core/identity", note: "signed agent identity" },
  warrant: { agentill: "core/grants", note: "short-lived scoped grants: tools/scopes/exp, HMAC" },
  tollkeeper: { agentill: "core/tolls", note: "per-tool metering, integer cents, deterministic receipts, x402" },
  quikgater: { agentill: null, note: "no counterpart; pay-per-fetch stays ACN-side" },
  pcc: { agentill: null, note: "byte metering stays ACN-side (suite meter)" },
  awlpay: { agentill: "ledger/settle + core/platformFee", note: "fee computation and mark-collected ledger; ACN executes, agenTill accounts" },
  psi: { agentill: null, note: "memory stays ACN-side" },
  conductor: { agentill: "validator/preflight", note: "plan-time validation; run receipts mirror settle ledger entries" },
});

/** Seven protection tolls, per the Tollkeeper booklet. */
export const CROSSINGS = Object.freeze([
  "prove-identity",
  "find-agent",
  "escrow",
  "delegate",
  "prove-compute",
  "stake",
  "carry-memory",
]);

/** Ten metered tools live on the Rider toll gates. */
export const TOLLHOUSE_TOOLS = Object.freeze([
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

/**
 * The seven verses as ACN stages, not absorption: each verse keeps its own
 * repo and SKU; ACN only names the verse's primary crossing so a run can
 * say { verse: "wallet" } instead of naming the crossing directly.
 */
export const VERSES = Object.freeze({
  pcc: { repo: "https://github.com/ceedot-rock/PCCVerse", crossing: "pcc-compress", note: "the Breath: codecs, coders, demos" },
  memory: { repo: "https://github.com/ceedot-rock/MemoryVerse", crossing: "carry-memory", note: "the Mind: persistent, sealed, provenanced memory" },
  cuni: { repo: "https://github.com/ceedot-rock/CuNIverse", crossing: "cuni-proof", note: "exact on every target or refuse" },
  rider: { repo: "https://github.com/ceedot-rock/RiderVerse", crossing: "prove-identity", note: "the Name: signed identity for agents" },
  l33t: { repo: "https://github.com/ceedot-rock/L33tVerse", crossing: "find-agent", note: "the SaaS supermarket for builders and agents" },
  blok: { repo: "https://github.com/ceedot-rock/BlokVerse", crossing: "stake", note: "play on-chain: the BLoK game universe" },
  wallet: { repo: "https://github.com/ceedot-rock/WalletVerse", crossing: "escrow", note: "the Wallet: value in and out for agents" },
});

export function resolveVerse(name) {
  const verse = String(name || "").trim().toLowerCase();
  if (!(verse in VERSES)) return { error: fail("tollkeeper", "unknown_verse", { verse }) };
  return { verse, crossing: VERSES[verse].crossing, repo: VERSES[verse].repo };
}

const DEFAULT_CROSSING = Object.freeze({
  fetch: "carry-memory",
  compress: "prove-compute",
  publish: "delegate",
  spend: "escrow",
  invoke: "prove-compute",
});

export function sha256hex(text) {
  return createHash("sha256").update(String(text), "utf8").digest("hex");
}

/**
 * Settle preview shared by plan and run. Rails: x402 captures agent USDC
 * for metered usage; cctp moves native USDC cross-chain (Base <-> Solana
 * via Circle CCTP V2 burn-and-mint, Iris attestation, no wrapped tokens);
 * acp opens an Agentic Checkout Session (OpenAI + Stripe:
 * POST checkout_sessions, scoped single-use payment token, merchant of
 * record stays the merchant) for SKU/seat purchases. Pure: no network.
 */
export function settlePreview(amount, spec = {}) {
  const want = String(spec.rail || "auto").toLowerCase();
  const rail = want === "awlpay" ? "awlpay" : want === "cctp" ? "cctp" : amount > 0
    ? (want === "acp" ? "acp" : want === "stripe" ? "stripe" : want === "none" ? "none" : "x402")
    : "none";
  if (rail === "awlpay") {
    const s = spec.swap || {};
    return {
      rail,
      quoted: "live-at-run",
      from_chain: s.from_chain || null,
      from_token: s.from_token || null,
      to_chain: s.to_chain || null,
      to_token: s.to_token || null,
      agentill: AGENTILL_MAP.awlpay.agentill,
      note: "Live AWLpay quote at run; fresh 402 accepts attached; payer signs X-PAYMENT. No keys on this side.",
    };
  }
  if (rail === "cctp") {
    const s = spec.swap || {};
    const from = String(s.from_chain || "").toLowerCase();
    const to = String(s.to_chain || "").toLowerCase();
    return {
      rail,
      protocol: "cctp-v2",
      token: "USDC",
      from_chain: from || null,
      from_domain: from in CCTP_DOMAINS ? CCTP_DOMAINS[from] : null,
      to_chain: to || null,
      to_domain: to in CCTP_DOMAINS ? CCTP_DOMAINS[to] : null,
      fast: s.fast === true,
      attestations: "iris-api",
      quoted: "live-at-run",
      agentill: AGENTILL_MAP.awlpay.agentill,
      note: "CCTP V2: USDC burns on the source chain and mints natively on the destination; Circle Iris attests the message before mint. No wrapped tokens, no keys on this side.",
    };
  }
  if (rail === "stripe") {
    return {
      rail,
      checkout: "stripe-checkout",
      capture: "card",
      currency: "usd",
      amount_cents: amount,
      platform_fee_cents: Math.round(amount * 0.005),
      sku: spec.sku || null,
      note: "Stripe captures the card. Same catalog, same prices; the receipt files to the warrant like every rail.",
    };
  }
  if (rail === "acp") {
    return {
      rail,
      checkout: "checkout_sessions",
      payment: "shared-payment-token (delegated, single-use)",
      merchant_of_record: "merchant",
      currency: "usd",
      amount_cents: amount,
      platform_fee_cents: Math.round(amount * 0.005),
      sku: spec.sku || null,
      note: "ACP: agent opens a checkout session; the merchant completes the order. No card credentials touch the agent.",
    };
  }
  return {
    rail,
    currency: rail === "x402" ? "USDC" : null,
    networks: rail === "x402" ? ["solana", "base"] : [],
    amount_cents: amount,
    platform_fee_cents: Math.round(amount * 0.005),
    sku: spec.sku || null,
    note: rail === "x402" ? "AWLpay free tier: 0.5% per payment, no fixed fee. Captured agent payments ride x402." : undefined,
  };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fail(stage, reason, extra = {}) {
  return { ok: false, stage, reason, ...extra };
}

function checkBase(spec) {
  const demo = spec.demo === true;
  const rider = typeof spec.rider === "string" ? spec.rider.trim() : "";
  if (!demo && !rider) return { error: fail("rider", "missing_identity") };
  const action = String(spec.action || "invoke").toLowerCase();
  if (!ACTIONS.includes(action)) return { error: fail("warrant", "action_not_allowed", { action }) };
  const host = String(spec.host || "").trim();
  if (!host) return { error: fail("warrant", "missing_host") };
  let verse = null;
  let verseCrossing = null;
  if (spec.verse != null && String(spec.verse).trim() !== "") {
    const r = resolveVerse(spec.verse);
    if (r.error) return { error: r.error };
    verse = r.verse;
    verseCrossing = r.crossing;
  }
  const crossing = String(spec.crossing || verseCrossing || DEFAULT_CROSSING[action] || "prove-compute");
  if (!CROSSINGS.includes(crossing) && !TOLLHOUSE_TOOLS.includes(crossing)) {
    return { error: fail("tollkeeper", "unknown_crossing", { crossing }) };
  }
  let url = null;
  if (spec.url != null && spec.url !== "") {
    try {
      url = new URL(String(spec.url));
    } catch {
      return { error: fail("quikgater", "bad_url", { url: String(spec.url) }) };
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { error: fail("quikgater", "bad_url", { url: String(spec.url) }) };
    }
  }
  return { demo, rider, action, host, crossing, url, verse };
}

/**
 * PSI file sink factory. Returns a memorize() that appends observatory-shaped
 * {d,c,o} lines to filePath. Opt-in only: the caller constructs it and passes
 * it as the memorize adapter, so MCP and default runs can never write to disk.
 */
export function psiFileSink(filePath) {
  const p = String(filePath || "");
  if (!p) throw new Error("psiFileSink needs a path");
  return (entry) => {
    const line = JSON.stringify({ d: String(entry.d || ""), c: String(entry.c || ""), o: String(entry.o || "") });
    fs.appendFileSync(p, line + "\n");
  };
}

/** CuNi proof check: structural only. The caller ran the check (CLI Studio);
 *  cryptographic Ed25519 verification belongs to whoever holds CuNi's pubkey.
 *  Verdict must be pass or refuse; stdout digest recorded when provided. */
export async function runCuniProof(spec, adapters = {}) {
  const { cuniVerifyFn = null } = adapters;
  const proof = spec.cuni || {};
  const receipt = proof.receipt || null;
  if (!receipt || typeof receipt !== "object") {
    return { ok: false, fail: fail("cuni-proof", "missing_receipt"), receipts: [] };
  }
  const verdict = String(receipt.verdict || "").toLowerCase();
  if (verdict !== "pass" && verdict !== "refuse") {
    return { ok: false, fail: fail("cuni-proof", "bad_verdict", { verdict: receipt.verdict || null }), receipts: [] };
  }
  let verified = { structural: true };
  if (typeof cuniVerifyFn === "function") {
    verified = await cuniVerifyFn(receipt);
    if (!verified || verified.ok !== true) {
      return { ok: false, fail: fail("cuni-proof", "verify_failed", { body: verified || null }), receipts: [] };
    }
  }
  const stdout = receipt.stdout != null ? String(receipt.stdout) : null;
  return {
    ok: true,
    receipts: [{
      stage: "cuni-proof", ok: true, verdict,
      stdout_sha256: stdout != null ? sha256hex(stdout) : null,
      signature_present: receipt.signature != null,
      verified_by: typeof cuniVerifyFn === "function" ? "caller-adapter" : "structural-only",
    }],
  };
}

/** Offline 402 responder: unpaid URL answers 402, never fetches. */
export async function planOnlyFetch(url) {
  return {
    status: 402,
    url: String(url),
    price: { note: "unpaid URL answers HTTP 402 with its price", pay_on: "base", retry: true },
  };
}

/**
 * Pure plan: no disk, no network. Shows the eight stages, the meter quote,
 * the settle preview, and the conductor digest before anything runs.
 */
export function planAgenticRun(spec = {}) {
  const base = checkBase(spec);
  if (base.error) return base.error;
  const bytes = Math.max(0, Number(spec.bytes) || 0);
  const quote = computeQuote({ bytes, product: spec.product || "auto", op: spec.op || "compress" });
  const amount = quote.amount_cents || 0;
  const settle = settlePreview(amount, spec);
  const planChain = cleanChain(spec.chain || []);
  const planShape = {
    v: AGENTIC_VERSION,
    action: base.action,
    host: base.host,
    url: base.url ? base.url.href : null,
    bytes,
    amount_cents: amount,
  };
  if (planChain.length) planShape.chain = planChain;
  const canonical = JSON.stringify(planShape);
  return {
    ok: true,
    version: AGENTIC_VERSION,
    platform: PLATFORM_NAME,
    plan: {
      stages: spec.cuni
        ? ["rider", "warrant", "tollkeeper", "quikgater", "pcc", "cuni", "awlpay", "psi", "conductor"]
        : ["rider", "warrant", "tollkeeper", "quikgater", "pcc", "awlpay", "psi", "conductor"],
      identity: base.demo ? "demo" : "rider",
      action: base.action,
      host: base.host,
      crossing: base.crossing,
      verse: base.verse,
      warrant: "verified at run",
      quote,
      settle,
      conductor: { cmd: "spl_agentic_run", digest: sha256hex(canonical) },
    },
  };
}

/**
 * Full run. Default adapters do no network: the fetch answers 402 unless a
 * fetch402 adapter is given, settle only builds the instruction unless a
 * settle adapter captures it, memory stays in-run unless a sink is given.
 * The warrant paper trail (issue / verify / receipt) is the one disk writer,
 * matching existing spl_warrant_* server behavior.
 */
/** Live AWLpay app calls. Quote is free; execute spends nothing without a
 *  payer-signed X-PAYMENT. Defaults are overridable for offline tests. */
export async function liveAwlpayQuote(swap) {
  const r = await fetch(`${AWLPAY_BASE}/api/pay/quote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      from_chain: swap.from_chain, from_token: swap.from_token,
      to_chain: swap.to_chain, to_token: swap.to_token,
      amount_cents: Math.max(0, Number(swap.amount_cents) || 0),
      tier: 0, volume_used_cents: 0, txs_used: 0,
      to_address: swap.to_address || null,
    }),
    signal: AbortSignal.timeout(30000),
  });
  return r.json();
}

export async function liveAwlpayExecute(swap, xPayment, idempotencyKey) {
  const r = await fetch(`${AWLPAY_BASE}/api/pay/execute`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(xPayment ? { "X-PAYMENT": xPayment } : {}),
    },
    body: JSON.stringify({
      from_chain: swap.from_chain, from_token: swap.from_token,
      to_chain: swap.to_chain, to_token: swap.to_token,
      amount_cents: Math.max(0, Number(swap.amount_cents) || 0),
      tier: 0, volume_used_cents: 0, txs_used: 0,
      idempotency_key: idempotencyKey || null,
      to_address: swap.to_address || null,
    }),
    signal: AbortSignal.timeout(60000),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}

/** Best-effort all-in estimate for cross-chain paths. Never throws. */
export async function liveDebridgeEstimate(swap) {
  try {
    const q = new URLSearchParams({
      srcChainId: String(swap.srcChainId || ""), srcChainTokenIn: swap.srcChainTokenIn || "",
      srcChainTokenInAmount: String(swap.srcChainTokenInAmount || ""),
      dstChainId: String(swap.dstChainId || ""), dstChainTokenOut: swap.dstChainTokenOut || "",
      dstChainTokenOutAmount: "auto",
    });
    const r = await fetch(`https://dln.debridge.finance/v1.0/dln/order/create-tx?${q}`, { signal: AbortSignal.timeout(30000) });
    const j = await r.json();
    return { available: true, estimation: j.estimation || null, usdPriceImpact: j.usdPriceImpact ?? null };
  } catch (e) {
    return { available: false, reason: String((e && e.message) || e).slice(0, 120) };
  }
}

/** CCTP V2 USDC domains (subset of the Circle supported-chains table).
 *  Excluded fail closed: BNB Smart Chain (USYC only), Stellar (address
 *  precision/encoding caveat), Sui/Aptos/Noble (V1-only per Circle). */
export const CCTP_DOMAINS = Object.freeze({
  ethereum: 0, avalanche: 1, optimism: 2, "op-mainnet": 2, arbitrum: 3,
  solana: 5, base: 6, polygon: 7, unichain: 10, linea: 11,
});

/** Source chains where Fast Transfer beats standard attestation, per the
 *  Circle supported-chains table (restricted to CCTP_DOMAINS keys).
 *  Solana is deliberately excluded: Circle marks Solana source
 *  Upfront-fees=NO, so fast-from-Solana fails closed to standard flow. */
export const CCTP_FAST_SOURCES = Object.freeze([
  "ethereum", "arbitrum", "optimism", "op-mainnet",
  "base", "unichain", "linea",
]);

/** Live Circle Iris V2 attestation read. Pure GET, never signs. Returns a
 *  normalized { status, message, attestation }; status === "complete"
 *  means the destination mint may proceed. */
export async function liveCctpAttestation({ source_domain, tx_hash }) {
  const r = await fetch(`https://iris-api.circle.com/v2/messages/${source_domain}?transactionHash=${tx_hash}`, {
    signal: AbortSignal.timeout(30000),
  });
  const body = await r.json().catch(() => null);
  const msg = body && Array.isArray(body.messages) ? body.messages[0] : body;
  return {
    status: (msg && msg.status) || null,
    message: (msg && msg.message) || null,
    attestation: (msg && msg.attestation) || null,
  };
}

/** CCTP V2 USDC settle: deposit-for-burn on the source chain, Circle Iris
 *  attestation, then mint on the destination. Deposit/mint sign, so they
 *  need caller adapters; attestation defaults to the live Iris read.
 *  Pure except through the injected adapters. Returns receipts plus
 *  a verdict, mirroring runAwlpaySettle. */
export async function runCctpSettle(spec, adapters = {}) {
  const {
    cctpDepositFn = null,
    cctpAttestationFn = liveCctpAttestation,
    cctpMintFn = null,
  } = adapters;
  const receipts = [];
  const swap = spec.swap || {};
  for (const k of ["from_chain", "to_chain"]) {
    if (!swap[k]) return { ok: false, fail: fail("cctp", "missing_swap", { need: k }), receipts };
  }
  const from = String(swap.from_chain).toLowerCase();
  const to = String(swap.to_chain).toLowerCase();
  if (!(from in CCTP_DOMAINS)) return { ok: false, fail: fail("cctp", "unsupported_chain", { chain: swap.from_chain }), receipts };
  if (!(to in CCTP_DOMAINS)) return { ok: false, fail: fail("cctp", "unsupported_chain", { chain: swap.to_chain }), receipts };
  const tokens = [swap.from_token, swap.to_token].filter(Boolean).map((t) => String(t).toUpperCase());
  if (tokens.length > 0 && !tokens.every((t) => t === "USDC")) {
    return { ok: false, fail: fail("cctp", "unsupported_token", { tokens }), receipts };
  }
  const amount_cents = Math.max(0, Number(swap.amount_cents) || 0);
  if (amount_cents <= 0) return { ok: false, fail: fail("cctp", "missing_swap", { need: "amount_cents" }), receipts };
  const fast = swap.fast === true;
  if (fast && !CCTP_FAST_SOURCES.includes(from)) {
    return { ok: false, fail: fail("cctp", "fast_unavailable", { chain: swap.from_chain }), receipts };
  }
  if (typeof cctpDepositFn !== "function" || typeof cctpMintFn !== "function") {
    return { ok: false, fail: fail("cctp", "adapter_required", { need: "cctpDepositFn+cctpMintFn" }), receipts };
  }
  const from_domain = CCTP_DOMAINS[from];
  const to_domain = CCTP_DOMAINS[to];
  const deposit = await cctpDepositFn({
    from_chain: from, from_domain, to_chain: to, to_domain,
    token: "USDC", amount_cents, fast, to_address: swap.to_address || null,
  });
  if (!deposit || deposit.ok !== true || !deposit.txHash) {
    return { ok: false, fail: fail("cctp", "deposit_failed", { body: deposit || null }), receipts };
  }
  receipts.push({ stage: "cctp-deposit", ok: true, from_domain, to_domain, token: "USDC", amount_cents, fast, tx: deposit.txHash });
  const att = await cctpAttestationFn({ source_domain: from_domain, tx_hash: deposit.txHash });
  if (!att || att.status !== "complete" || !att.attestation) {
    return { ok: false, fail: fail("cctp", "attestation_pending", { status: att ? att.status : null, tx: deposit.txHash }), receipts };
  }
  receipts.push({ stage: "cctp-attestation", ok: true, via: "iris-api", tx: deposit.txHash });
  const minted = await cctpMintFn({ to_chain: to, to_domain, message: att.message || null, attestation: att.attestation });
  if (!minted || minted.ok !== true) {
    return { ok: false, fail: fail("cctp", "mint_failed", { body: minted || null }), receipts };
  }
  receipts.push({ stage: "cctp-mint", ok: true, to_domain, tx: minted.txHash || null, agentill: AGENTILL_MAP.awlpay.agentill });
  return { ok: true, receipts, settled: { tx: minted.txHash || null, to_domain, deposit_tx: deposit.txHash } };
}

/** Live awlpay settle: quote, fresh 402 accepts, all-in math, then execute
 *  only with a payer-signed X-PAYMENT. Returns receipts plus a verdict. */
export async function runAwlpaySettle(spec, adapters = {}) {
  const {
    awlpayQuoteFn = liveAwlpayQuote,
    awlpayExecuteFn = liveAwlpayExecute,
    debridgeEstimateFn = liveDebridgeEstimate,
  } = adapters;
  const receipts = [];
  const swap = spec.swap || {};
  for (const k of ["from_chain", "from_token", "to_chain", "to_token"]) {
    if (!swap[k]) return { ok: false, fail: fail("awlpay", "missing_swap", { need: k }), receipts };
  }
  const quote = await awlpayQuoteFn({ ...swap, amount_cents: Math.max(0, Number(spec.bytes) || Number(swap.amount_cents) || 0) });
  if (!quote || quote.refused) {
    return { ok: false, fail: fail("awlpay", "quote_refused", { quote_reason: (quote && quote.reason) || null }), receipts };
  }
  receipts.push({ stage: "awlpay-quote", ok: true, path: quote.path || null, fees: quote.fees || null });

  const probe = await awlpayExecuteFn({ ...swap, amount_cents: quote.amount_cents ?? 0 }, null, spec.idempotency_key || null);
  const accepts = (probe && probe.body && probe.body.accepts) || null;
  if (!probe || probe.status !== 402 || !accepts) {
    return { ok: false, fail: fail("awlpay", "no_challenge", { status: probe ? probe.status : null }), receipts };
  }
  let allIn = { available: false, reason: "same-chain path; route price is the full cost" };
  if (swap.from_chain !== swap.to_chain && spec.debridge) {
    allIn = await debridgeEstimateFn(spec.debridge);
  }
  receipts.push({
    stage: "awlpay-fees", ok: true,
    route_price: "per 402 accepts below; flat chain fees included where listed",
    accepts: accepts.map((a) => ({ network: a.network, amount: a.amount, asset: a.asset })),
    all_in: allIn,
    agentill: AGENTILL_MAP.awlpay.agentill,
  });
  if (!spec.x_payment) {
    return { ok: false, fail: { ...fail("awlpay", "payment_required"), status: 402, accepts }, receipts };
  }
  const done = await awlpayExecuteFn({ ...swap, amount_cents: quote.amount_cents ?? 0 }, spec.x_payment, spec.idempotency_key || null);
  if (!done || done.status !== 200 || !(done.body && done.body.ok)) {
    return { ok: false, fail: fail("awlpay", "execute_failed", { status: done ? done.status : null, body: done ? done.body : null }), receipts };
  }
  return { ok: true, receipts, settled: done.body };
}

export async function runAgenticRun(spec = {}, adapters = {}) {
  const {
    verifyWarrantFn = verifyWarrant,
    issueWarrantFn = issueWarrant,
    fileReceiptFn = fileReceipt,
    fetch402 = planOnlyFetch,
    tollPrice = null,
    settleFn = null,
    memorize = null,
  } = adapters;
  const base = checkBase(spec);
  if (base.error) return { ...base.error, receipts: [], memory: [] };
  const receipts = [];
  const memory = [];
  const sink = typeof memorize === "function" ? memorize : (e) => memory.push(e);

  receipts.push({ stage: "rider", ok: true, identity: base.demo ? "demo" : "rider" });

  let token = typeof spec.warrant === "string" ? spec.warrant : null;
  let warrant;
  if (base.demo) {
    const issued = issueWarrantFn({
      demo: true,
      actions: [base.action],
      allow_hosts: [base.host],
      max_usd: spec.max_usd ?? 1,
      max_calls: spec.max_calls ?? 20,
      ttl_seconds: spec.ttl_seconds ?? 900,
    });
    if (!issued.ok) return { ...fail("warrant", issued.reason || "issue_failed"), receipts, memory };
    token = issued.token;
    warrant = issued.warrant;
  } else {
    if (!token) return { ...fail("warrant", "missing_warrant"), receipts, memory };
    const v = verifyWarrantFn(token, { host: base.host, action: base.action, actor: spec.actor, delegation_mode: spec.delegation_mode });
    if (!v.ok) return { ...fail("warrant", v.reason || "warrant_invalid"), receipts, memory };
    warrant = v.warrant;
  }
  receipts.push({
    stage: "warrant",
    ok: true,
    warrant_id: warrant.warrant_id,
    remaining_usd: warrant.remaining_usd,
    remaining_calls: warrant.remaining_calls,
  });

  const price = typeof tollPrice === "function" ? await tollPrice(base.crossing) : { listed: "at-toll-schema" };
  receipts.push({ stage: "tollkeeper", ok: true, crossing: base.crossing, price, receipt: "signed on pass" });

  let fetchedBytes = 0;
  if (base.url) {
    const first = await fetch402(base.url.href, { paid: false });
    let body = null;
    if (first && first.status === 200) {
      body = first.body;
    } else if (first && first.status === 402 && spec.pay === true) {
      const second = await fetch402(base.url.href, { paid: true, payment: first.price || null });
      if (!second || second.status !== 200) {
        return { ...fail("quikgater", "fetch_failed", { status: second ? second.status : null }), receipts, memory };
      }
      body = second.body;
    } else {
      return {
        ...fail("quikgater", "payment_required"),
        status: 402,
        price: (first && first.price) || null,
        pay_on: "base",
        retry: true,
        receipts,
        memory,
      };
    }
    fetchedBytes = body == null ? 0 : Buffer.byteLength(String(body));
    receipts.push({ stage: "quikgater", ok: true, url: base.url.href, bytes: fetchedBytes, paid: spec.pay === true });
  }

  const bytes = Math.max(fetchedBytes, Math.max(0, Number(spec.bytes) || 0));
  const quote = computeQuote({ bytes, product: spec.product || "auto", op: spec.op || "compress" });
  receipts.push({ stage: "pcc", ok: true, bytes, amount_cents: quote.amount_cents, free: quote.free });

  if (spec.cuni) {
    const proof = await runCuniProof(spec, adapters);
    receipts.push(...proof.receipts);
    if (!proof.ok) return { ...proof.fail, receipts, memory };
  }

  const amount = quote.amount_cents || 0;
  const instruction = settlePreview(amount, spec);
  let settled = null;
  if (instruction.rail === "awlpay") {
    const live = await runAwlpaySettle(spec, adapters);
    receipts.push(...live.receipts);
    if (!live.ok) return { ...live.fail, receipts, memory };
    settled = live.settled;
  } else if (instruction.rail === "cctp") {
    const live = await runCctpSettle(spec, adapters);
    receipts.push(...live.receipts);
    if (!live.ok) return { ...live.fail, receipts, memory };
    settled = live.settled;
  } else if (amount > 0 && typeof settleFn === "function") {
    settled = await settleFn(instruction);
  } else if (amount > 0 && spec.paid !== true) {
    return { ...fail("awlpay", "payment_required"), status: 402, instruction, receipts, memory };
  }
  receipts.push({ stage: "awlpay", ok: true, ...instruction, captured: settled });

  const entry = { d: today(), c: "ship", o: `agentic ${base.action} ${base.host} ${bytes}B rail=${instruction.rail}` };
  sink(entry);
  receipts.push({ stage: "psi", ok: true, logged: true });

  const runShape = {
    v: AGENTIC_VERSION,
    action: base.action,
    host: base.host,
    url: base.url ? base.url.href : null,
    bytes,
    amount_cents: amount,
  };
  const chain = cleanChain(spec.chain || []);
  if (chain.length) runShape.chain = chain;
  const canonical = JSON.stringify(runShape);
  const digest = sha256hex(canonical);
  receipts.push({ stage: "conductor", ok: true, cmd: "spl_agentic_run", seed: digest.slice(0, 16), digest, chain });

  if (token && spec.file_receipt !== false) {
    const r = fileReceiptFn({
      token,
      action: base.action,
      host: base.host,
      usd: amount / 100,
      request_sha256: digest,
      result_sha256: digest,
      note: "agentic-platform",
      actor: spec.actor,
      evidence_ids: [digest],
      parent_receipt: spec.parent_receipt || null,
    });
    receipts.push({ stage: "warrant-receipt", ok: r.ok === true, reason: r.ok ? undefined : r.reason || null });
  }
  return { ok: true, platform: PLATFORM_NAME, receipts, memory };
}

/** Recompute a conductor receipt over the run inputs. */
export function verifyConductorReceipt(runSpec, receipt) {
  const norm = cleanChain(runSpec.chain || []);
  const shape = {
    v: AGENTIC_VERSION,
    action: String(runSpec.action || "invoke").toLowerCase(),
    host: String(runSpec.host || "").trim(),
    url: runSpec.url ? String(runSpec.url) : null,
    bytes: Math.max(0, Number(runSpec.bytes) || 0),
    amount_cents: Number(runSpec.amount_cents) || 0,
  };
  if (norm.length) shape.chain = norm;
  const canonical = JSON.stringify(shape);
  const chainValid = !norm.length || JSON.stringify((receipt && receipt.chain) || null) === JSON.stringify(norm);
  return { valid: sha256hex(canonical) === (receipt ? receipt.digest : null), chain_valid: chainValid, digest: sha256hex(canonical) };
}

export const AGENTIC_TOOLS = Object.freeze([
  {
    name: "spl_agentic_plan",
    description: "Plan one ACN (Agent Commerce Network) run across Rider, Warrant, Tollkeeper, Quikgater, PCC, AWLpay, PSI, Conductor. Pure: no disk, no network.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string" },
        host: { type: "string" },
        url: { type: "string" },
        bytes: { type: "number" },
        demo: { type: "boolean" },
        rider: { type: "string" },
        crossing: { type: "string" },
        rail: { type: "string" },
        swap: { type: "object" },
        cuni: { type: "object" },
      },
    },
  },
  {
    name: "spl_agentic_run",
    description: "Run one ACN (Agent Commerce Network) run. Needs confirm:true plus demo:true or a rider+warrant pair. Unpaid steps answer 402.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string" },
        host: { type: "string" },
        url: { type: "string" },
        bytes: { type: "number" },
        demo: { type: "boolean" },
        rider: { type: "string" },
        warrant: { type: "string" },
        crossing: { type: "string" },
        pay: { type: "boolean" },
        paid: { type: "boolean" },
        rail: { type: "string" },
        swap: { type: "object" },
        x_payment: { type: "string" },
        debridge: { type: "object" },
        chain: { type: "array" },
        actor: { type: "string" },
        delegation_mode: { type: "string" },
        parent_receipt: { type: "string" },
        cuni: { type: "object" },
        confirm: { type: "boolean" },
      },
    },
  },
]);

export async function dispatchAgentic(name, args = {}, adapters = {}) {
  if (name === "spl_agentic_plan") return planAgenticRun(args);
  if (name === "spl_agentic_run") {
    if (args.confirm !== true) {
      return { ok: false, needs: "confirm", hint: "re-call with confirm:true plus demo:true or a rider+warrant pair" };
    }
    return runAgenticRun(args, adapters);
  }
  throw new Error("Unknown agentic tool: " + name);
}
