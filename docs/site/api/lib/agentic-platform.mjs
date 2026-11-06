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
import { computeQuote, capStatus } from "../suite-pricing.js";
import { compressContext, compressContextAsync, verifyCompression, CONTEXT_VERSION } from "./context-compress.mjs";
import { defaultProductionRerankFn } from "./rerank-http.mjs";
import { runBenchhaus, BENCHHAUS_VERSION } from "./benchhaus.mjs";
import { issueStandingRider, verifyStandingRider, safeguardsHash, STANDING_RIDER_VERSION, STANDING_WAIVER_VERSION } from "./standing-rider.mjs";
import { operatorReputation, REPUTATION_VERSION } from "./reputation-ledger.mjs";
import { runPrivateBench, PRIVATE_BENCH_VERSION } from "./private-bench.mjs";
import { quotePayout, PAYOUTS_VERSION } from "./operator-payouts.mjs";
import { recordKnownOrder, openDispute, DISPUTES_VERSION } from "./refund-disputes.mjs";
import { solanaRailConfig, buildReceiveInstruction, verifySolanaReceipt, RAIL_VERSION } from "./solana-rail.mjs";
import { TOOL_REGISTRY_VERSION } from "./tool-registry.mjs";
import { AGENT_DIRECTORY_VERSION } from "./agent-directory.mjs";
import { expandTemplate, WARRANT_TEMPLATES_VERSION } from "./warrant-templates.mjs";
import { createMessenger, digestEnvelope, MESSAGING_VERSION } from "./agent-messaging.mjs";
import { createRunManager, submitRun as singletonSubmitRun } from "./async-runs.mjs";
import { OPS_EVENTS } from "./ops-feed.mjs";
import { buildAuditPack } from "./audit-export.mjs";
import { dryRun, SANDBOX_MODE } from "./sandbox-mode.mjs";
import { buildDepotReceipt } from "./depot-receipts.mjs";
import { buildMonthlyInvoice, buildMonthlyInvoiceAsync } from "./depot-billing.mjs";
import { createTaskManager, TASK_VERSION } from "./conductor-tasks.mjs";
import { reviewChanges, reviewChangesAsync, REVIEW_VERSION } from "./conductor-review.mjs";
import { MCP_CATALOG_VERSION } from "./mcp-catalog.mjs";
import { createSkuCatalog, quoteSku as defaultQuoteSku, STOREFRONT_SKILLS_VERSION } from "./storefront-skills.mjs";
import { createTokenBudget, memoizedCompress, TOKEN_BUDGET_VERSION } from "./token-budget.mjs";
import { createDepotStore, DEPOT_STORE_VERSION } from "./depot-store.mjs";
import { sealEnvelope, openEnvelope, CHAMBER_SEAL_VERSION } from "./chamber-seal.mjs";
import { foundingStatus, checkGrantSpend, FOUNDING_GRANTS_VERSION } from "./founding-grants.mjs";

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
  context: { agentill: null, note: "context compression stays ACN-side (suite meter)" },
  benchhaus: { agentill: null, note: "benchhaus eval stays ACN-side (suite meter)" },
  cuni: { agentill: null, note: "exactness proof stays ACN-side" },
  conductor: { agentill: "validator/preflight", note: "plan-time validation; run receipts mirror settle ledger entries" },
  "warrant-template": { agentill: "core/grants", note: "prebuilt per-vertical bundles expand to issue params, narrow-only" },
  "standing-rider": { agentill: "core/identity", note: "standing safeguards + waiver-gated rider issuance" },
  reputation: { agentill: null, note: "operator reputation stays ACN-side (suite ledger)" },
  "tool-registry": { agentill: null, note: "tool discovery stays ACN-side" },
  "agent-directory": { agentill: null, note: "agent discovery stays ACN-side" },
  "agent-messaging": { agentill: null, note: "agent negotiation envelopes stay ACN-side" },
  "private-bench": { agentill: null, note: "held-out eval stays ACN-side (suite meter)" },
  solana: { agentill: "ledger/settle + core/platformFee", note: "receive-only Solana USDC rail; ACN builds, operator signs" },
  payout: { agentill: "ledger/settle + core/platformFee", note: "unsigned USDC payout intents; ACN quotes, operator signs" },
  dispute: { agentill: "ledger/settle + core/platformFee", note: "disputes open against known orders; refunds unsigned" },
  "audit-export": { agentill: null, note: "audit packs stay ACN-side" },
  "ops-feed": { agentill: null, note: "ops event feed stays ACN-side" },
  "async-runs": { agentill: null, note: "background run queue stays ACN-side" },
  sandbox: { agentill: null, note: "sandbox dry-run previews stay ACN-side" },
  "depot-receipts": { agentill: null, note: "gitdepot storage receipts stay ACN-side (suite meter)" },
  "depot-billing": { agentill: null, note: "gitdepot monthly invoices stay ACN-side (suite ledger)" },
  "conductor-tasks": { agentill: "validator/preflight", note: "task lifecycle receipts mirror conductor preflight" },
  "conductor-review": { agentill: "validator/preflight", note: "diff review gate stays ACN-side; verdict mirrors preflight" },
  "mcp-catalog": { agentill: null, note: "version-pinned MCP discovery stays ACN-side" },
  "storefront-skills": { agentill: null, note: "frozen SKU quotes stay ACN-side" },
  "token-budget": { agentill: null, note: "per-agent token budgets + memo receipts stay ACN-side (suite meter)" },
  "depot-store": { agentill: null, note: "live gitdepot blob publish/retrieve stays ACN-side (adapter, no network by default)" },
  "chamber-seal": { agentill: null, note: "two-key JSON seals for run artifacts stay ACN-side" },
  membership: { agentill: null, note: "founding-grant tier check stays ACN-side (suite ledger)" },
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

/**
 * Tollbooth spend-guard. The module holds no cross-run ledger:
 * cumulative spend arrives caller-supplied via spec ({ spend:
 * { spent_cents, cap_cents } } or top-level spent_cents / cap_cents)
 * or via adapters ({ spendFn(spec) } or { getSpend(spec) }), the same
 * injectable pattern as compressFn/settleFn. spendStatus() adds the
 * current quote amount to prior spend and runs capStatus on the total.
 * Fraction >= 1.0 fails closed (cap_exceeded); >= 0.8 trips a
 * velocity_exceeded warning receipt without failing.
 */
export const SPEND_ALERT_FRACTION = 0.8;

function spendFromSpec(spec = {}) {
  if (spec && typeof spec.spend === "object" && spec.spend !== null) {
    return { spent_cents: spec.spend.spent_cents, cap_cents: spec.spend.cap_cents };
  }
  if (spec && (spec.spent_cents != null || spec.cap_cents != null)) {
    return { spent_cents: spec.spent_cents, cap_cents: spec.cap_cents };
  }
  return null;
}

function spendAdapterFn(adapters = {}) {
  if (!adapters || typeof adapters !== "object") return null;
  if (typeof adapters.spendFn === "function") return adapters.spendFn;
  if (typeof adapters.getSpend === "function") return adapters.getSpend;
  return null;
}

export function spendStatus(spend, amount_cents) {
  const spent = Math.max(0, Number(spend.spent_cents) || 0);
  const cumulative = spent + Math.max(0, Number(amount_cents) || 0);
  const status = spend.cap_cents != null
    ? capStatus({ spent_cents: cumulative, cap_cents: Number(spend.cap_cents) })
    : capStatus({ spent_cents: cumulative });
  return { ...status, spent_cents: cumulative };
}

/** Sync spend resolve for planAgenticRun (plan is pure/sync: async
 *  adapter results are skipped here and enforced at run). */
function resolveSpendSync(spec, adapters = {}) {
  const f = spendAdapterFn(adapters);
  if (f) {
    try {
      const s = f(spec);
      if (s && typeof s.then === "function") return null;
      if (s && typeof s === "object") return { spent_cents: s.spent_cents, cap_cents: s.cap_cents, source: "adapter" };
    } catch (e) {
      return { error: String((e && e.message) || e).slice(0, 200) };
    }
  }
  const s = spendFromSpec(spec);
  if (s) return { ...s, source: "spec" };
  return null;
}

async function resolveSpend(spec, adapters = {}) {
  const f = spendAdapterFn(adapters);
  if (f) {
    try {
      const s = await f(spec);
      if (s && typeof s === "object") return { spent_cents: s.spent_cents, cap_cents: s.cap_cents, source: "adapter" };
    } catch (e) {
      return { error: String((e && e.message) || e).slice(0, 200) };
    }
  }
  const s = spendFromSpec(spec);
  if (s) return { ...s, source: "spec" };
  return null;
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
/** Stage list. Defaults are frozen by contract: every stage after rider/
 *  warrant/tollkeeper/quikgater/pcc/awlpay/psi/conductor joins only on
 *  opt-in (the matching spec field is present). */
function planStages(spec = {}) {
  const stages = ["rider", "warrant"];
  if (spec.warrantTemplate) stages.push("warrant-template");
  if (spec.standingRider) stages.push("standing-rider");
  stages.push("tollkeeper");
  if (spec.reputation) stages.push("reputation");
  stages.push("quikgater");
  if (spec.tool) stages.push("tool-registry");
  if (spec.agent) stages.push("agent-directory");
  if (spec.message) stages.push("agent-messaging");
  if (spec.context) stages.push("context");
  if (spec.benchhaus) stages.push("benchhaus");
  if (spec.privateBench) stages.push("private-bench");
  stages.push("pcc");
  if (spec.cuni) stages.push("cuni");
  stages.push("awlpay");
  if (spec.solana) stages.push("solana");
  if (spec.payout) stages.push("payout");
  if (spec.dispute) stages.push("dispute");
  if (spec.audit) stages.push("audit-export");
  if (spec.ops) stages.push("ops-feed");
  if (spec.asyncRun) stages.push("async-runs");
  if (spec.sandbox) stages.push("sandbox");
  if (spec.depotReceipt) stages.push("depot-receipts");
  if (spec.depotBilling) stages.push("depot-billing");
  if (spec.conductorTask) stages.push("conductor-tasks");
  if (spec.conductorReview) stages.push("conductor-review");
  if (spec.mcpTool) stages.push("mcp-catalog");
  if (spec.sku) stages.push("storefront-skills");
  if (spec.tokenBudget) stages.push("token-budget");
  if (spec.depotStore) stages.push("depot-store");
  if (spec.chamberSeal) stages.push("chamber-seal");
  if (spec.membership) stages.push("membership");
  stages.push("psi", "conductor");
  return stages;
}

/** Spec normalizers for the optional ACN stages. Each accepts the compact
 *  scalar form or the object form; anything else normalizes to null and the
 *  stage then fails closed at plan/run time. */
function riderIdLike(v) {
  if (typeof v === "string") {
    const s = v.trim();
    return s || null;
  }
  if (v && typeof v === "object") {
    for (const k of ["rider_id", "operator", "operator_id"]) {
      if (typeof v[k] === "string" && v[k].trim()) return v[k].trim();
    }
  }
  return null;
}

function warrantTemplateSel(v) {
  if (typeof v === "string") {
    const id = v.trim();
    return id ? { id, overrides: {} } : null;
  }
  if (v && typeof v === "object") {
    const id = typeof v.id === "string" ? v.id.trim() : (typeof v.template === "string" ? v.template.trim() : "");
    if (!id) return null;
    const o = v.overrides;
    return { id, overrides: o && typeof o === "object" ? o : {} };
  }
  return null;
}

function objLike(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : null;
}

/** conductorTask accepts a bare prompt string or { prompt }. */
function conductorPromptLike(v) {
  if (typeof v === "string") {
    const s = v.trim();
    return s || null;
  }
  if (v && typeof v === "object" && typeof v.prompt === "string" && v.prompt.trim()) {
    return v.prompt.trim();
  }
  return null;
}

/** sku accepts a bare SKU string or { sku, qty }. */
function skuSel(v) {
  if (typeof v === "string") {
    const s = v.trim();
    return s ? { sku: s, qty: 1 } : null;
  }
  if (v && typeof v === "object") {
    const sku = typeof v.sku === "string" ? v.sku.trim() : "";
    if (!sku) return null;
    const qty = v.qty == null ? 1 : Number(v.qty);
    return { sku, qty };
  }
  return null;
}

/** tokenBudget accepts a bare cap number or { cap_tokens, key, charge_tokens, text?, query?, digest? }. */
function tokenBudgetSel(v) {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
    return { cap_tokens: v, key: "anon", charge_tokens: 0, query: "" };
  }
  const o = objLike(v);
  if (!o) return null;
  const cap = o.cap_tokens == null ? 0 : Number(o.cap_tokens);
  if (!Number.isFinite(cap) || cap < 0) return null;
  const charge = o.charge_tokens == null ? 0 : Number(o.charge_tokens);
  if (!Number.isFinite(charge) || charge < 0) return null;
  const out = {
    cap_tokens: cap,
    key: typeof o.key === "string" && o.key.trim() ? o.key.trim() : "anon",
    charge_tokens: Math.floor(charge),
    query: typeof o.query === "string" ? o.query : "",
  };
  if (typeof o.text === "string") out.text = o.text;
  if (typeof o.digest === "string" && o.digest) out.digest = o.digest;
  return out;
}

/** Pure context preview for plan output. No disk, no network: forwards the
 *  reranker tier/topK but never a model adapter (plan stays offline). */
function planContextPreview(spec = {}) {
  if (!spec.context || typeof spec.context.text !== "string") return null;
  const c = compressContext({
    text: spec.context.text,
    query: spec.context.query || "",
    targetRatio: spec.context.targetRatio,
    maxTokens: spec.context.maxTokens,
    reranker: spec.context.reranker,
    rerankTopK: spec.context.rerankTopK,
    ...(typeof spec.context.rerankFn === "function" ? { rerankFn: spec.context.rerankFn } : {}),
  });
  if (!c || c.ok !== true || c.refused) return { refused: true, reason: (c && c.reason) || "compress_failed" };
  return { refused: false, inTokens: c.inTokens, outTokens: c.outTokens, ratio: c.ratio, digest: c.digest, tool: "context-compress", toolVersion: CONTEXT_VERSION, reranker: c.reranker, rescored: c.rescored };
}

/** Pure previews for the optional ACN stages. No disk, no network: ledger
 *  writers (payout/dispute), ledger readers (reputation/audit), and
 *  registry lookups (tool/agent) preview as intent only; the pure
 *  expand/hash/eval/dry-run helpers run inline. Never throws. */
function planAcnPreviews(spec = {}, adapters = {}) {
  const out = {};
  if (spec.warrantTemplate) {
    const sel = warrantTemplateSel(spec.warrantTemplate);
    if (!sel) {
      out.warrantTemplate = { tool: "warrant-templates", toolVersion: WARRANT_TEMPLATES_VERSION, refused: true, reason: "bad_template" };
    } else {
      const e = expandTemplate(sel.id, sel.overrides);
      out.warrantTemplate = e && e.ok === true
        ? { tool: "warrant-templates", toolVersion: WARRANT_TEMPLATES_VERSION, template: sel.id, params: e.params }
        : { tool: "warrant-templates", toolVersion: WARRANT_TEMPLATES_VERSION, refused: true, reason: (e && e.reason) || "expand_failed" };
    }
  }
  if (spec.standingRider) {
    const s = objLike(spec.standingRider);
    try {
      if (s && s.safeguards && typeof s.safeguards === "object") {
        out.standingRider = { tool: "standing-rider", toolVersion: STANDING_RIDER_VERSION, safeguards_hash: safeguardsHash(s.safeguards), waiver_version: STANDING_WAIVER_VERSION };
      } else {
        const id = riderIdLike(spec.standingRider);
        out.standingRider = id
          ? { tool: "standing-rider", toolVersion: STANDING_RIDER_VERSION, rider_id: id }
          : { tool: "standing-rider", toolVersion: STANDING_RIDER_VERSION, refused: true, reason: "bad_standing_rider" };
      }
    } catch {
      out.standingRider = { tool: "standing-rider", toolVersion: STANDING_RIDER_VERSION, refused: true, reason: "preview_failed" };
    }
  }
  if (spec.reputation) {
    const id = riderIdLike(spec.reputation);
    out.reputation = id
      ? { tool: "reputation-ledger", toolVersion: REPUTATION_VERSION, rider_id: id }
      : { tool: "reputation-ledger", toolVersion: REPUTATION_VERSION, refused: true, reason: "bad_reputation" };
  }
  if (spec.tokenBudget) {
    const sel = tokenBudgetSel(spec.tokenBudget);
    out.tokenBudget = sel
      ? { tool: "token-budget", toolVersion: TOKEN_BUDGET_VERSION, key: sel.key, cap_tokens: sel.cap_tokens }
      : { tool: "token-budget", toolVersion: TOKEN_BUDGET_VERSION, refused: true, reason: "bad_budget" };
  }
  if (spec.depotStore) {
    const ds = objLike(spec.depotStore) || {};
    const op = typeof ds.op === "string" ? ds.op : "";
    out.depotStore = ["publish", "retrieve", "list"].includes(op)
      ? { tool: "depot-store", toolVersion: DEPOT_STORE_VERSION, op }
      : { tool: "depot-store", toolVersion: DEPOT_STORE_VERSION, refused: true, reason: "bad_op" };
  }
  if (spec.chamberSeal) {
    const cs = objLike(spec.chamberSeal) || {};
    const mode = "seal" in cs ? "seal" : ("open" in cs ? "open" : null);
    out.chamberSeal = mode
      ? { tool: "chamber-seal", toolVersion: CHAMBER_SEAL_VERSION, mode }
      : { tool: "chamber-seal", toolVersion: CHAMBER_SEAL_VERSION, refused: true, reason: "bad_spec" };
  }
  if (spec.membership) {
    const ms = objLike(spec.membership) || {};
    const seq = Number(ms.grant_seq);
    out.membership = Number.isSafeInteger(seq) && seq >= 1
      ? { tool: "founding-grants", toolVersion: FOUNDING_GRANTS_VERSION, tier: "founding", grant_seq: seq }
      : { tool: "founding-grants", toolVersion: FOUNDING_GRANTS_VERSION, tier: "free" };
  }
  if (spec.tool) {
    const t = objLike(spec.tool);
    const id = t && typeof t.id === "string" ? t.id.trim() : "";
    out.tool = id
      ? { tool: "tool-registry", toolVersion: TOOL_REGISTRY_VERSION, id, version: typeof t.version === "string" ? t.version : null }
      : { tool: "tool-registry", toolVersion: TOOL_REGISTRY_VERSION, refused: true, reason: "bad_tool" };
  }
  if (spec.agent) {
    const id = riderIdLike(spec.agent);
    out.agent = id
      ? { tool: "agent-directory", toolVersion: AGENT_DIRECTORY_VERSION, rider_id: id }
      : { tool: "agent-directory", toolVersion: AGENT_DIRECTORY_VERSION, refused: true, reason: "bad_agent" };
  }
  if (spec.message) {
    const m = objLike(spec.message) || {};
    const okShape = typeof m.from_rider === "string" && m.from_rider.trim()
      && typeof m.to_rider === "string" && m.to_rider.trim()
      && typeof m.nonce === "string" && m.nonce.trim()
      && m.offer && typeof m.offer === "object";
    try {
      out.message = okShape
        ? { tool: "agent-messaging", toolVersion: MESSAGING_VERSION, digest: digestEnvelope(m, typeof adapters.hashFn === "function" ? adapters.hashFn : undefined) }
        : { tool: "agent-messaging", toolVersion: MESSAGING_VERSION, refused: true, reason: "bad_envelope" };
    } catch {
      out.message = { tool: "agent-messaging", toolVersion: MESSAGING_VERSION, refused: true, reason: "preview_failed" };
    }
  }
  if (spec.privateBench) {
    try {
      const inner = objLike(spec.privateBench) || {};
      const b = runPrivateBench(inner, objLike(adapters.privateBench) || {});
      out.privateBench = b && b.ok === true
        ? { tool: "private-bench", toolVersion: PRIVATE_BENCH_VERSION, siascore: b.siascore, coverage_pct: b.coverage_pct, provenance: b.provenance, digest: b.digest }
        : { tool: "private-bench", toolVersion: PRIVATE_BENCH_VERSION, refused: true, reason: (b && b.reason) || "bench_failed" };
    } catch {
      out.privateBench = { tool: "private-bench", toolVersion: PRIVATE_BENCH_VERSION, refused: true, reason: "bench_failed" };
    }
  }
  if (spec.solana) {
    const s = objLike(spec.solana) || {};
    try {
      if (typeof s.tx === "string" && s.tx.trim()) {
        out.solana = { tool: "solana-rail", toolVersion: RAIL_VERSION, mode: "verify" };
      } else {
        const cfg = solanaRailConfig(adapters.solanaEnv || process.env);
        out.solana = { tool: "solana-rail", toolVersion: RAIL_VERSION, mode: "receive", enabled: cfg.enabled, network: cfg.network };
      }
    } catch {
      out.solana = { tool: "solana-rail", toolVersion: RAIL_VERSION, refused: true, reason: "preview_failed" };
    }
  }
  if (spec.payout) {
    const p = objLike(spec.payout) || {};
    out.payout = { tool: "operator-payouts", toolVersion: PAYOUTS_VERSION, rail: typeof p.rail === "string" ? p.rail : null, amount_cents: Number(p.amount_cents) || 0 };
  }
  if (spec.dispute) {
    const d = objLike(spec.dispute) || {};
    const id = typeof d.order_id === "string" ? d.order_id.trim() : "";
    out.dispute = id
      ? { tool: "refund-disputes", toolVersion: DISPUTES_VERSION, order_id: id }
      : { tool: "refund-disputes", toolVersion: DISPUTES_VERSION, refused: true, reason: "bad_dispute" };
  }
  if (spec.audit) {
    const id = riderIdLike(spec.audit);
    out.audit = id
      ? { tool: "audit-export", identity: id }
      : { tool: "audit-export", refused: true, reason: "bad_audit" };
  }
  if (spec.ops) {
    const o = objLike(spec.ops) || {};
    out.ops = typeof o.type === "string" && o.type
      ? { tool: "ops-feed", type: o.type }
      : { tool: "ops-feed", refused: true, reason: "bad_ops" };
  }
  if (spec.asyncRun) {
    out.asyncRun = objLike(spec.asyncRun)
      ? { tool: "async-runs", staged: true }
      : { tool: "async-runs", refused: true, reason: "bad_async_spec" };
  }
  if (spec.sandbox) {
    try {
      const d = dryRun(objLike(spec.sandbox) || {}, objLike(adapters.sandbox) || {});
      out.sandbox = d && d.ok === true
        ? { tool: "sandbox-mode", mode: SANDBOX_MODE, spend_cents: 0, would_be_cents: d.would_be_cents }
        : { tool: "sandbox-mode", refused: true, reason: (d && d.error) || "dry_run_failed" };
    } catch {
      out.sandbox = { tool: "sandbox-mode", refused: true, reason: "dry_run_failed" };
    }
  }
  if (spec.depotReceipt) {
    try {
      const priceOpts = typeof adapters.depotPriceFn === "function"
        ? { priceFn: adapters.depotPriceFn }
        : (objLike(adapters.depot) || {});
      const r = buildDepotReceipt(objLike(spec.depotReceipt) || {}, priceOpts);
      out.depotReceipt = r
        ? { tool: "depot-receipts", op: r.op, bytes: r.bytes, quoted_cents: r.quoted_cents }
        : { tool: "depot-receipts", refused: true, reason: "bad_receipt" };
    } catch {
      out.depotReceipt = { tool: "depot-receipts", refused: true, reason: "preview_failed" };
    }
  }
  if (spec.depotBilling) {
    try {
      const inv = buildMonthlyInvoice(objLike(spec.depotBilling) || {}, objLike(adapters.depotBilling) || {});
      out.depotBilling = inv
        ? { tool: "depot-billing", team: inv.team, pooled_gb: inv.pooled_gb, overage_gb: inv.overage_gb, amount_cents: inv.amount_cents }
        : { tool: "depot-billing", refused: true, reason: "bad_invoice" };
    } catch {
      out.depotBilling = { tool: "depot-billing", refused: true, reason: "preview_failed" };
    }
  }
  if (spec.conductorTask) {
    const prompt = conductorPromptLike(spec.conductorTask);
    out.conductorTask = prompt
      ? { tool: "conductor-tasks", toolVersion: TASK_VERSION, prompt }
      : { tool: "conductor-tasks", toolVersion: TASK_VERSION, refused: true, reason: "bad_task" };
  }
  if (spec.conductorReview) {
    try {
      const rv = reviewChanges(objLike(spec.conductorReview) || {}, objLike(adapters.conductorReview) || {});
      out.conductorReview = rv && rv.ok === true
        ? { tool: "conductor-review", toolVersion: REVIEW_VERSION, verdict: rv.verdict, findings: rv.findings.length }
        : { tool: "conductor-review", toolVersion: REVIEW_VERSION, refused: true, reason: (rv && rv.error) || "review_failed" };
    } catch {
      out.conductorReview = { tool: "conductor-review", toolVersion: REVIEW_VERSION, refused: true, reason: "preview_failed" };
    }
  }
  if (spec.mcpTool) {
    const t = objLike(spec.mcpTool) || {};
    const name = typeof t.name === "string" ? t.name.trim() : "";
    const version = typeof t.version === "string" ? t.version : null;
    out.mcpTool = name && version
      ? { tool: "mcp-catalog", toolVersion: MCP_CATALOG_VERSION, name, version }
      : { tool: "mcp-catalog", toolVersion: MCP_CATALOG_VERSION, refused: true, reason: "bad_tool" };
  }
  if (spec.sku) {
    try {
      const sel = skuSel(spec.sku);
      const catalog = (adapters.skuCatalog && typeof adapters.skuCatalog.quoteSku === "function")
        ? adapters.skuCatalog
        : (objLike(adapters.sku) ? createSkuCatalog(objLike(adapters.sku)) : null);
      const q = catalog
        ? catalog.quoteSku(sel ? sel.sku : "", sel || {})
        : defaultQuoteSku(sel ? sel.sku : "", sel || {});
      out.sku = q && q.ok === true
        ? { tool: "storefront-skills", toolVersion: STOREFRONT_SKILLS_VERSION, ...q.quote }
        : { tool: "storefront-skills", toolVersion: STOREFRONT_SKILLS_VERSION, refused: true, reason: (q && q.reason) || "quote_failed" };
    } catch {
      out.sku = { tool: "storefront-skills", toolVersion: STOREFRONT_SKILLS_VERSION, refused: true, reason: "preview_failed" };
    }
  }
  return out;
}

export function planAgenticRun(spec = {}, adapters = {}) {
  const base = checkBase(spec);
  if (base.error) return base.error;
  const bytes = Math.max(0, Number(spec.bytes) || 0);
  const quote = computeQuote({ bytes, product: spec.product || "auto", op: spec.op || "compress" });
  const spendSync = resolveSpendSync(spec, adapters);
  if (spendSync && spendSync.error) {
    return { ...fail("tollkeeper", "cap_exceeded", { error: "spend_adapter_failed", detail: spendSync.error }) };
  }
  let spendGuard = null;
  if (spendSync) {
    const st = spendStatus(spendSync, quote.amount_cents || 0);
    if (st.fraction >= 1) {
      return { ...fail("tollkeeper", "cap_exceeded", { spent_cents: st.spent_cents, cap_cents: st.cap_cents, fraction: st.fraction }) };
    }
    spendGuard = {
      spent_cents: st.spent_cents,
      cap_cents: st.cap_cents,
      fraction: st.fraction,
      remaining_cents: st.remaining_cents,
      alert: st.alert,
      warning: st.fraction >= SPEND_ALERT_FRACTION ? "velocity_exceeded" : null,
    };
  }
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
  const ctxPreview = planContextPreview(spec);
  let benchPreview = null;
  if (spec.benchhaus) {
    try {
      const inner = spec.benchhaus && typeof spec.benchhaus === "object" ? { benchhaus: spec.benchhaus } : {};
      const b = runBenchhaus(inner);
      benchPreview = b && b.ok === true
        ? { tool: "benchhaus", toolVersion: BENCHHAUS_VERSION, siascore: b.siascore, coverage_pct: b.coverage_pct, digest: b.digest }
        : { tool: "benchhaus", toolVersion: BENCHHAUS_VERSION, refused: true, reason: (b && b.reason) || "bench_failed" };
    } catch {
      benchPreview = { tool: "benchhaus", toolVersion: BENCHHAUS_VERSION, refused: true, reason: "bench_failed" };
    }
  }
  return {
    ok: true,
    version: AGENTIC_VERSION,
    platform: PLATFORM_NAME,
    plan: {
      stages: planStages(spec),
      identity: base.demo ? "demo" : "rider",
      action: base.action,
      host: base.host,
      crossing: base.crossing,
      verse: base.verse,
      warrant: "verified at run",
      quote,
      settle,
      conductor: { cmd: "spl_agentic_run", digest: sha256hex(canonical) },
      ...(ctxPreview ? { context: ctxPreview } : {}),
      ...(benchPreview ? { benchhaus: benchPreview } : {}),
      ...planAcnPreviews(spec, adapters),
      ...(spendGuard ? { spendGuard } : {}),
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
    benchhausFn = null,
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

  if (spec.warrantTemplate) {
    const sel = warrantTemplateSel(spec.warrantTemplate);
    if (!sel) return { ...fail("warrant-template", "bad_template"), receipts, memory };
    const e = expandTemplate(sel.id, sel.overrides);
    if (!e || e.ok !== true) return { ...fail("warrant-template", (e && e.reason) || "expand_failed"), receipts, memory };
    receipts.push({
      stage: "warrant-template", ok: true, tool: "warrant-templates", toolVersion: WARRANT_TEMPLATES_VERSION,
      template: sel.id, params: e.params,
    });
  }

  if (spec.standingRider) {
    const srAdapters = objLike(adapters.standingRider) || {};
    const s = objLike(spec.standingRider);
    let sr;
    if (s && s.safeguards && typeof s.safeguards === "object") {
      sr = issueStandingRider({ safeguards: s.safeguards, waiver: s.waiver }, srAdapters);
      if (!sr || sr.ok !== true) return { ...fail("standing-rider", (sr && (sr.reason || sr.error)) || "issue_failed"), receipts, memory };
      receipts.push({
        stage: "standing-rider", ok: true, tool: "standing-rider", toolVersion: STANDING_RIDER_VERSION,
        mode: "issued", rider_id: sr.receipt.rider_id,
        safeguards_hash: sr.receipt.safeguards_hash, waiver_version: sr.receipt.waiver_version,
      });
    } else {
      const id = riderIdLike(spec.standingRider);
      if (!id) return { ...fail("standing-rider", "missing_rider_id"), receipts, memory };
      sr = verifyStandingRider(id, srAdapters);
      if (!sr || sr.ok !== true) return { ...fail("standing-rider", (sr && (sr.reason || sr.error)) || "verify_failed", { rider_id: id }), receipts, memory };
      receipts.push({
        stage: "standing-rider", ok: true, tool: "standing-rider", toolVersion: STANDING_RIDER_VERSION,
        mode: "verified", rider_id: sr.rider_id,
        safeguards_hash: sr.safeguards_hash, waiver_version: sr.waiver_version,
      });
    }
  }

  const price = typeof tollPrice === "function" ? await tollPrice(base.crossing) : { listed: "at-toll-schema" };
  receipts.push({ stage: "tollkeeper", ok: true, crossing: base.crossing, price, receipt: "signed on pass" });

  const spend = await resolveSpend(spec, adapters);
  if (spend && spend.error) {
    return { ...fail("tollkeeper", "cap_exceeded", { error: "spend_adapter_failed", detail: spend.error }), receipts, memory };
  }
  if (spend) {
    const estQuote = computeQuote({ bytes: Math.max(0, Number(spec.bytes) || 0), product: spec.product || "auto", op: spec.op || "compress" });
    const early = spendStatus(spend, estQuote.amount_cents || 0);
    if (early.fraction >= 1) {
      return { ...fail("tollkeeper", "cap_exceeded", { spent_cents: early.spent_cents, cap_cents: early.cap_cents, fraction: early.fraction }), receipts, memory };
    }
  }

  if (spec.reputation) {
    const id = riderIdLike(spec.reputation);
    if (!id) return { ...fail("reputation", "missing_rider_id"), receipts, memory };
    let rep;
    try {
      rep = operatorReputation(id, objLike(adapters.reputation) || {});
    } catch (e) {
      return { ...fail("reputation", "ledger_read_failed", { error: String((e && e.message) || e).slice(0, 200) }), receipts, memory };
    }
    if (!rep || rep.ok !== true) return { ...fail("reputation", (rep && (rep.reason || rep.error)) || "lookup_failed", { rider_id: id }), receipts, memory };
    receipts.push({
      stage: "reputation", ok: true, tool: "reputation-ledger", toolVersion: REPUTATION_VERSION,
      rider_id: rep.rider_id, runs: rep.runs, disputes: rep.disputes, refunds: rep.refunds, score: rep.score,
    });
  }

  let fetchedBytes = 0;
  let fetchedBody = null;
  if (base.url) {
    const first = await fetch402(base.url.href, { paid: false });
    let body = null;
    if (first && first.status === 200) {
      body = first.body;
      fetchedBody = body;
    } else if (first && first.status === 402 && spec.pay === true) {
      const second = await fetch402(base.url.href, { paid: true, payment: first.price || null });
      if (!second || second.status !== 200) {
        return { ...fail("quikgater", "fetch_failed", { status: second ? second.status : null }), receipts, memory };
      }
      body = second.body;
      fetchedBody = body;
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

  if (spec.tool) {
    const t = objLike(spec.tool) || {};
    const id = typeof t.id === "string" ? t.id.trim() : "";
    if (!id) return { ...fail("tool-registry", "bad_tool"), receipts, memory };
    const registry = adapters.toolRegistry;
    if (!registry || typeof registry.get !== "function") {
      return { ...fail("tool-registry", "adapter_required", { need: "toolRegistry" }), receipts, memory };
    }
    const hit = registry.get(id, typeof t.version === "string" ? t.version : undefined);
    if (!hit || hit.ok !== true) return { ...fail("tool-registry", (hit && hit.reason) || "unknown_tool", { id }), receipts, memory };
    receipts.push({
      stage: "tool-registry", ok: true, tool: "tool-registry", toolVersion: TOOL_REGISTRY_VERSION,
      id: hit.tool.id, version: hit.tool.version, price_cents: hit.tool.price_cents, endpoint: hit.tool.endpoint,
    });
  }

  if (spec.agent) {
    const id = riderIdLike(spec.agent);
    if (!id) return { ...fail("agent-directory", "missing_rider_id"), receipts, memory };
    const directory = adapters.agentDirectory;
    if (!directory || typeof directory.get !== "function") {
      return { ...fail("agent-directory", "adapter_required", { need: "agentDirectory" }), receipts, memory };
    }
    const hit = directory.get(id);
    if (!hit || hit.ok !== true) return { ...fail("agent-directory", (hit && hit.reason) || "unknown_agent", { rider_id: id }), receipts, memory };
    receipts.push({
      stage: "agent-directory", ok: true, tool: "agent-directory", toolVersion: AGENT_DIRECTORY_VERSION,
      rider_id: hit.agent.rider_id, score: hit.agent.score, endpoint: hit.agent.endpoint,
    });
  }

  if (spec.message) {
    const m = objLike(spec.message);
    if (!m) return { ...fail("agent-messaging", "bad_envelope"), receipts, memory };
    const messenger = (adapters.messenger && typeof adapters.messenger.draft === "function" && typeof adapters.messenger.ack === "function")
      ? adapters.messenger
      : createMessenger(typeof adapters.hashFn === "function" ? { hashFn: adapters.hashFn } : undefined);
    const out = m.ack === true ? messenger.ack(m) : messenger.draft(m);
    if (!out || out.ok !== true) return { ...fail("agent-messaging", (out && out.reason) || "bad_envelope"), receipts, memory };
    receipts.push({
      stage: "agent-messaging", ok: true, tool: "agent-messaging", toolVersion: MESSAGING_VERSION,
      kind: out.envelope.kind, digest: out.envelope.digest,
    });
  }

  let contextText = null;
  if (spec.context) {
    const input = typeof spec.context.text === "string" ? spec.context.text : (fetchedBody != null ? String(fetchedBody) : "");
    if (input) {
      const compressFn = typeof adapters.compressFn === "function" ? adapters.compressFn : (s) => compressContextAsync(s);
      const prodRerankFn =
        typeof spec.context.rerankFn === "function" || typeof adapters.rerankFn === "function"
          ? null
          : defaultProductionRerankFn();
      const c = await compressFn({
        text: input,
        query: spec.context.query || "",
        targetRatio: spec.context.targetRatio,
        maxTokens: spec.context.maxTokens,
        reranker: spec.context.reranker,
        rerankTopK: spec.context.rerankTopK,
        ...(prodRerankFn ? { rerankFn: prodRerankFn } : {}),
        ...(typeof spec.context.rerankFn === "function" ? { rerankFn: spec.context.rerankFn } : {}),
        ...(typeof adapters.rerankFn === "function" ? { rerankFn: adapters.rerankFn } : {}),
      });
      if (!c || c.ok !== true) return { ...fail("context", "compress_failed"), receipts, memory };
      if (c.refused) return { ...fail("context", c.reason || "refused"), receipts, memory };
      const v = verifyCompression({ input, output: c.output, query: spec.context.query || "" });
      if (!v.ok) return { ...fail("context", "verify_failed", { checks: v.checks }), receipts, memory };
      contextText = c.output;
      receipts.push({
        stage: "context", ok: true, tool: "context-compress", toolVersion: CONTEXT_VERSION,
        inTokens: c.inTokens, outTokens: c.outTokens, ratio: c.ratio, reranker: c.reranker, rescored: c.rescored,
        kept: c.kept.length, dropped: c.dropped.length, verified: true, digest: c.digest,
      });
    }
  }

  if (spec.tokenBudget) {
    const sel = tokenBudgetSel(spec.tokenBudget);
    if (!sel) return { ...fail("token-budget", "bad_budget"), receipts, memory };
    const tbAdapter = objLike(adapters.tokenBudget);
    const tb = tbAdapter && typeof tbAdapter.charge === "function" && typeof tbAdapter.status === "function"
      ? tbAdapter
      : createTokenBudget({
        capTokens: sel.cap_tokens,
        ...(objLike(adapters.tokenBudgetStore) ? { store: adapters.tokenBudgetStore } : {}),
      });
    let memoHit = false;
    let digest = sel.digest || null;
    let tokens = sel.charge_tokens;
    if (typeof sel.text === "string") {
      const m = memoizedCompress(
        { text: sel.text, query: sel.query, ...(sel.digest ? { digest: sel.digest } : {}) },
        {
          ...(adapters.tokenMemo ? { memo: adapters.tokenMemo } : {}),
          ...(typeof adapters.tokenCompressFn === "function" ? { compressFn: adapters.tokenCompressFn } : {}),
        },
      );
      if (!m.ok) return { ...fail("token-budget", m.error, { detail: m.detail }), receipts, memory };
      memoHit = m.hit;
      digest = m.digest;
      tokens = m.recompute_tokens;
    }
    const ch = tb.charge(sel.key, tokens);
    if (!ch.ok) {
      return { ...fail("token-budget", "budget_exceeded", { key: ch.key, used_tokens: ch.used_tokens, cap_tokens: ch.cap_tokens, wanted_tokens: ch.wanted_tokens }), receipts, memory };
    }
    receipts.push({
      stage: "token-budget", ok: true, tool: "token-budget", toolVersion: TOKEN_BUDGET_VERSION,
      key: ch.key, charged_tokens: tokens, used_tokens: ch.used_tokens, cap_tokens: ch.cap_tokens,
      fraction: ch.fraction, ...(ch.warn ? { warn: true } : {}), memo_hit: memoHit,
      ...(digest ? { digest } : {}),
    });
  }

  if (spec.benchhaus) {
    const runFn = typeof benchhausFn === "function" ? benchhausFn : (s) => runBenchhaus(s);
    const bhSpec = spec.benchhaus && typeof spec.benchhaus === "object" ? spec.benchhaus : {};
    let b;
    try {
      b = await runFn(bhSpec);
    } catch (e) {
      return { ...fail("benchhaus", "bench_failed", { error: String((e && e.message) || e).slice(0, 200) }), receipts, memory };
    }
    if (!b || b.ok !== true) return { ...fail("benchhaus", (b && b.reason) || "bench_failed"), receipts, memory };
    receipts.push({
      stage: "benchhaus", ok: true, tool: "benchhaus", toolVersion: BENCHHAUS_VERSION,
      suites: b.suites, siascore: b.siascore, coverage_pct: b.coverage_pct, verified: true, digest: b.digest,
    });
  }

  if (spec.privateBench) {
    const pbAdapters = objLike(adapters.privateBench) || {};
    const pbSpec = objLike(spec.privateBench) || {};
    const runFn = typeof adapters.privateBenchFn === "function" ? adapters.privateBenchFn : (s) => runPrivateBench(s, pbAdapters);
    let pb;
    try {
      pb = await runFn(pbSpec);
    } catch (e) {
      return { ...fail("private-bench", "bench_failed", { error: String((e && e.message) || e).slice(0, 200) }), receipts, memory };
    }
    if (!pb || pb.ok !== true) return { ...fail("private-bench", (pb && (pb.reason || pb.error)) || "bench_failed"), receipts, memory };
    receipts.push({
      stage: "private-bench", ok: true, tool: "private-bench", toolVersion: PRIVATE_BENCH_VERSION,
      suites: pb.suites, siascore: pb.siascore, coverage_pct: pb.coverage_pct,
      provenance: pb.provenance, verified: pb.verified === true,
      ...(pb.verified === true ? {} : { attest_reason: pb.attest_reason || "no_adapter_attestation" }),
      digest: pb.digest,
    });
  }

  const rawBytes = Math.max(fetchedBytes, Math.max(0, Number(spec.bytes) || 0));
  const bytes = contextText != null ? Buffer.byteLength(contextText) : rawBytes;
  const quote = computeQuote({ bytes, product: spec.product || "auto", op: spec.op || "compress" });
  receipts.push({ stage: "pcc", ok: true, bytes, amount_cents: quote.amount_cents, free: quote.free });

  if (spec.cuni) {
    const proof = await runCuniProof(spec, adapters);
    receipts.push(...proof.receipts);
    if (!proof.ok) return { ...proof.fail, receipts, memory };
  }

  const amount = quote.amount_cents || 0;
  const instruction = settlePreview(amount, spec);
  if (spend && !spend.error) {
    const late = spendStatus(spend, amount);
    if (late.fraction >= 1) {
      return { ...fail("awlpay", "cap_exceeded", { spent_cents: late.spent_cents, cap_cents: late.cap_cents, fraction: late.fraction }), receipts, memory };
    }
    if (late.fraction >= SPEND_ALERT_FRACTION) {
      receipts.push({
        stage: "tollkeeper", ok: true, warning: "velocity_exceeded",
        spent_cents: late.spent_cents, cap_cents: late.cap_cents,
        fraction: late.fraction, remaining_cents: late.remaining_cents,
      });
    }
  }
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

  if (spec.solana) {
    const s = objLike(spec.solana) || {};
    if (typeof s.tx === "string" && s.tx.trim()) {
      const vr = typeof adapters.verifySolanaReceiptFn === "function"
        ? await adapters.verifySolanaReceiptFn({ tx: s.tx, expected: s.expected })
        : await verifySolanaReceipt(
          { tx: s.tx, expected: s.expected },
          typeof adapters.verifyReceipt === "function" ? { verifyReceipt: adapters.verifyReceipt } : {},
        );
      if (!vr || vr.ok !== true) return { ...fail("solana", (vr && (vr.error || vr.reason)) || "verify_failed", { tx: s.tx }), receipts, memory };
      receipts.push({
        stage: "solana", ok: true, tool: "solana-rail", toolVersion: RAIL_VERSION,
        mode: "verified", tx: s.tx,
      });
    } else {
      const bi = buildReceiveInstruction({ amount_cents: s.amount_cents }, adapters.solanaEnv || process.env);
      if (!bi || bi.ok !== true) return { ...fail("solana", (bi && (bi.error || bi.reason)) || "rail_disabled"), receipts, memory };
      receipts.push({
        stage: "solana", ok: true, tool: "solana-rail", toolVersion: RAIL_VERSION,
        mode: "receive", instruction: bi.instruction,
      });
    }
  }

  if (spec.payout) {
    const p = objLike(spec.payout);
    if (!p) return { ...fail("payout", "bad_payout"), receipts, memory };
    const q = quotePayout(
      { rider_id: p.rider_id, amount_cents: p.amount_cents, rail: p.rail, to: p.to },
      objLike(adapters.payouts) || {},
    );
    if (!q || q.ok !== true) return { ...fail("payout", (q && (q.error || q.reason)) || "quote_failed"), receipts, memory };
    receipts.push({
      stage: "payout", ok: true, tool: "operator-payouts", toolVersion: PAYOUTS_VERSION,
      intent_id: q.intent.id, rail: q.intent.rail, chain: q.intent.chain,
      amount_cents: q.intent.amount_cents, amount_raw: q.intent.amount_raw,
      to: q.intent.to, requires: "operator_signature", status: q.intent.status,
    });
  }

  if (spec.dispute) {
    const d = objLike(spec.dispute);
    if (!d) return { ...fail("dispute", "bad_dispute"), receipts, memory };
    const dAdapters = objLike(adapters.disputes) || {};
    if (d.amount_cents != null) {
      const reg = recordKnownOrder(
        { order_id: d.order_id, amount_cents: d.amount_cents, chain: d.chain ?? null, refund_to: d.refund_to ?? null, agent_id: d.agent_id ?? null },
        dAdapters,
      );
      if (!reg || reg.ok !== true) return { ...fail("dispute", (reg && (reg.error || reg.reason)) || "order_failed", { order_id: d.order_id }), receipts, memory };
    }
    const opened = openDispute({ order_id: d.order_id, reason: d.reason }, dAdapters);
    if (!opened || opened.ok !== true) return { ...fail("dispute", (opened && (opened.error || opened.reason)) || "open_failed", { order_id: d.order_id }), receipts, memory };
    receipts.push({
      stage: "dispute", ok: true, tool: "refund-disputes", toolVersion: DISPUTES_VERSION,
      dispute_id: opened.dispute.id, order_id: opened.dispute.order_id, status: opened.dispute.status,
    });
  }

  if (spec.audit) {
    const id = riderIdLike(spec.audit);
    if (!id) return { ...fail("audit-export", "missing_identity"), receipts, memory };
    let pack;
    try {
      pack = await buildAuditPack({ rider_id: id }, { readers: objLike(adapters.auditReaders) || {} });
    } catch (e) {
      return { ...fail("audit-export", "reader_failed", { error: String((e && e.message) || e).slice(0, 200) }), receipts, memory };
    }
    if (!pack || pack.ok !== true) return { ...fail("audit-export", (pack && (pack.error || pack.reason)) || "reader_failed", { identity: id }), receipts, memory };
    receipts.push({
      stage: "audit-export", ok: true, tool: "audit-export",
      identity: pack.pack.identity, spend_cents: pack.pack.spend_cents,
      runs: pack.pack.runs.length, disputes: pack.pack.disputes.length,
      receipts_digests: pack.pack.receipts_digests.length,
    });
  }

  if (spec.ops) {
    const o = objLike(spec.ops);
    if (!o || typeof o.type !== "string" || !o.type) return { ...fail("ops-feed", "bad_ops"), receipts, memory };
    const feed = adapters.opsFeed;
    if (!feed || typeof feed.emit !== "function") {
      return { ...fail("ops-feed", "adapter_required", { need: "opsFeed" }), receipts, memory };
    }
    const emitted = feed.emit(o.type, objLike(o.detail) || {});
    if (!emitted || emitted.ok !== true) {
      return { ...fail("ops-feed", (emitted && (emitted.error || emitted.reason)) || "unknown_event", { type: o.type }), receipts, memory };
    }
    receipts.push({
      stage: "ops-feed", ok: true, tool: "ops-feed",
      type: emitted.event.type, seq: emitted.event.seq, persisted: emitted.persisted,
    });
  }

  if (spec.asyncRun) {
    const q = objLike(spec.asyncRun);
    if (!q) return { ...fail("async-runs", "invalid_spec"), receipts, memory };
    const submit = adapters.runManager && typeof adapters.runManager.submitRun === "function"
      ? (s) => adapters.runManager.submitRun(s)
      : singletonSubmitRun;
    const queued = submit(q);
    if (!queued || queued.ok !== true) return { ...fail("async-runs", (queued && (queued.error || queued.reason)) || "queue_failed"), receipts, memory };
    receipts.push({
      stage: "async-runs", ok: true, tool: "async-runs",
      run_id: queued.run_id, status: queued.status,
    });
  }

  if (spec.sandbox) {
    const s = objLike(spec.sandbox);
    if (!s) return { ...fail("sandbox", "invalid_spec"), receipts, memory };
    let sb;
    try {
      sb = dryRun(s, objLike(adapters.sandbox) || {});
    } catch (e) {
      return { ...fail("sandbox", "dry_run_failed", { error: String((e && e.message) || e).slice(0, 200) }), receipts, memory };
    }
    if (!sb || sb.ok !== true) return { ...fail("sandbox", (sb && (sb.error || sb.reason)) || "dry_run_failed"), receipts, memory };
    receipts.push({
      stage: "sandbox", ok: true, tool: "sandbox-mode",
      mode: sb.mode, spend_cents: 0, would_be_cents: sb.would_be_cents,
    });
  }

  if (spec.depotReceipt) {
    const priceOpts = typeof adapters.depotPriceFn === "function"
      ? { priceFn: adapters.depotPriceFn }
      : (objLike(adapters.depot) || {});
    const r = buildDepotReceipt(objLike(spec.depotReceipt) || {}, priceOpts);
    if (!r) return { ...fail("depot-receipts", "bad_receipt"), receipts, memory };
    receipts.push({
      stage: "depot-receipts", ok: true, tool: "depot-receipts",
      op: r.op, team_sha: r.team_sha, blob_sha256: r.blob_sha256,
      bytes: r.bytes, quoted_cents: r.quoted_cents,
    });
  }

  if (spec.depotBilling) {
    const bOpts = objLike(adapters.depotBilling) || {};
    const inv = await buildMonthlyInvoiceAsync(objLike(spec.depotBilling) || {}, bOpts);
    if (!inv) return { ...fail("depot-billing", "bad_invoice"), receipts, memory };
    receipts.push({
      stage: "depot-billing", ok: true, tool: "depot-billing",
      team: inv.team, pooled_gb: inv.pooled_gb, overage_gb: inv.overage_gb, amount_cents: inv.amount_cents,
    });
  }

  if (spec.depotStore) {
    const ds = objLike(spec.depotStore) || {};
    const op = typeof ds.op === "string" ? ds.op : "";
    const storeOpts = objLike(adapters.depotStore) || {};
    if (!storeOpts.endpoint || !storeOpts.key) {
      return { ...fail("depot-store", "adapter_required", { need: "depotStore.endpoint+key" }), receipts, memory };
    }
    const store = createDepotStore({
      endpoint: storeOpts.endpoint,
      key: storeOpts.key,
      ...(typeof storeOpts.fetchFn === "function" ? { fetchFn: storeOpts.fetchFn } : {}),
    });
    if (op === "publish") {
      const r = await store.publish(ds);
      if (!r || r.ok !== true) return { ...fail("depot-store", (r && r.reason) || "publish_failed"), receipts, memory };
      receipts.push({
        stage: "depot-store", ok: true, tool: "depot-store", toolVersion: DEPOT_STORE_VERSION,
        op: "publish", name: r.name, sha256: r.sha256, size: r.size,
      });
    } else if (op === "retrieve") {
      const r = await store.retrieve(ds.sha256);
      if (!r || r.ok !== true) return { ...fail("depot-store", (r && r.reason) || "retrieve_failed"), receipts, memory };
      receipts.push({
        stage: "depot-store", ok: true, tool: "depot-store", toolVersion: DEPOT_STORE_VERSION,
        op: "retrieve", sha256: r.sha256, size: r.size,
      });
    } else if (op === "list") {
      const r = await store.list();
      if (!r || r.ok !== true) return { ...fail("depot-store", (r && r.reason) || "list_failed"), receipts, memory };
      receipts.push({
        stage: "depot-store", ok: true, tool: "depot-store", toolVersion: DEPOT_STORE_VERSION,
        op: "list", count: r.depots.length,
      });
    } else {
      return { ...fail("depot-store", "bad_op"), receipts, memory };
    }
  }

  if (spec.chamberSeal) {
    const cs = objLike(spec.chamberSeal) || {};
    const csOpts = objLike(adapters.chamberSeal) || {};
    const keyHex = typeof csOpts.keyHex === "string" ? csOpts.keyHex : null;
    if (!keyHex) {
      return { ...fail("chamber-seal", "adapter_required", { need: "chamberSeal.keyHex" }), receipts, memory };
    }
    if ("seal" in cs) {
      const env = sealEnvelope(cs.seal, { keyHex });
      if (!env) return { ...fail("chamber-seal", "bad_payload"), receipts, memory };
      receipts.push({
        stage: "chamber-seal", ok: true, tool: "chamber-seal", toolVersion: CHAMBER_SEAL_VERSION,
        mode: "sealed", sha256: env.sha256,
      });
    } else if ("open" in cs) {
      const opened = openEnvelope(cs.open, { keyHex });
      if (!opened || opened.ok !== true) {
        return { ...fail("chamber-seal", (opened && opened.reason) || "open_failed"), receipts, memory };
      }
      receipts.push({
        stage: "chamber-seal", ok: true, tool: "chamber-seal", toolVersion: CHAMBER_SEAL_VERSION,
        mode: "opened",
      });
    } else {
      return { ...fail("chamber-seal", "bad_spec"), receipts, memory };
    }
  }

  if (spec.membership) {
    const ms = objLike(spec.membership) || {};
    const grantOpts = objLike(adapters.membership) || {};
    const grantAdapters = {
      ...(grantOpts.dir ? { dir: grantOpts.dir } : {}),
      ...(typeof grantOpts.nowMs === "function" ? { nowMs: grantOpts.nowMs } : {}),
    };
    if (ms.grant_seq == null) {
      receipts.push({
        stage: "membership", ok: true, tool: "founding-grants", toolVersion: FOUNDING_GRANTS_VERSION,
        tier: "free",
      });
    } else {
      const st = foundingStatus({ seq: Number(ms.grant_seq) }, grantAdapters);
      if (!st.ok) return { ...fail("membership", st.error || "grant_check_failed"), receipts, memory };
      if (!st.active) return { ...fail("membership", "grant_expired"), receipts, memory };
      let remaining = st.caps.monthly_cap_cents;
      if (ms.spent_cents != null) {
        const chk = checkGrantSpend(
          { seq: Number(ms.grant_seq), spent_cents: ms.spent_cents }, grantAdapters,
        );
        if (!chk.ok) return { ...fail("membership", chk.error || "spend_check_failed"), receipts, memory };
        remaining = chk.remaining_cents;
      }
      receipts.push({
        stage: "membership", ok: true, tool: "founding-grants", toolVersion: FOUNDING_GRANTS_VERSION,
        tier: "founding", grant_seq: st.seq, rider_id: st.rider_id,
        remaining_ms: st.remaining_ms, remaining_cents: remaining,
      });
    }
  }

  if (spec.conductorTask) {
    const prompt = conductorPromptLike(spec.conductorTask);
    if (!prompt) return { ...fail("conductor-tasks", "bad_task"), receipts, memory };
    const manager = (adapters.taskManager && typeof adapters.taskManager.intentTask === "function")
      ? adapters.taskManager
      : createTaskManager(objLike(adapters.conductorTasks) || {});
    const it = manager.intentTask({ prompt });
    if (!it || it.ok !== true) return { ...fail("conductor-tasks", (it && it.error) || "intent_failed"), receipts, memory };
    receipts.push({
      stage: "conductor-tasks", ok: true, tool: "conductor-tasks", toolVersion: TASK_VERSION,
      task_id: it.task_id, branch: it.branch, status: it.status, digest: it.digest,
    });
  }

  if (spec.conductorReview) {
    const rvOpts = objLike(adapters.conductorReview) || {};
    const rv = await reviewChangesAsync(objLike(spec.conductorReview) || {}, rvOpts);
    if (!rv || rv.ok !== true) return { ...fail("conductor-review", (rv && rv.error) || "review_failed"), receipts, memory };
    receipts.push({
      stage: "conductor-review", ok: true, tool: "conductor-review", toolVersion: REVIEW_VERSION,
      verdict: rv.verdict, findings: rv.findings,
    });
  }

  if (spec.mcpTool) {
    const t = objLike(spec.mcpTool) || {};
    const name = typeof t.name === "string" ? t.name.trim() : "";
    const version = typeof t.version === "string" ? t.version : undefined;
    if (!name || !version) return { ...fail("mcp-catalog", "bad_tool"), receipts, memory };
    const catalog = adapters.mcpCatalog;
    if (!catalog || typeof catalog.get !== "function") {
      return { ...fail("mcp-catalog", "adapter_required", { need: "mcpCatalog" }), receipts, memory };
    }
    const hit = catalog.get(name, version);
    if (!hit || hit.ok !== true) return { ...fail("mcp-catalog", (hit && hit.reason) || "unknown_tool", { name }), receipts, memory };
    receipts.push({
      stage: "mcp-catalog", ok: true, tool: "mcp-catalog", toolVersion: MCP_CATALOG_VERSION,
      name: hit.tool.name, version: hit.tool.version, price_cents: hit.tool.price_cents,
      endpoint: hit.tool.endpoint, protocol: hit.tool.protocol,
    });
  }

  if (spec.sku) {
    const sel = skuSel(spec.sku);
    if (!sel) return { ...fail("storefront-skills", "bad_sku"), receipts, memory };
    const catalog = (adapters.skuCatalog && typeof adapters.skuCatalog.quoteSku === "function")
      ? adapters.skuCatalog
      : (objLike(adapters.sku) ? createSkuCatalog(objLike(adapters.sku)) : { quoteSku: defaultQuoteSku });
    const q = catalog.quoteSku(sel.sku, { qty: sel.qty });
    if (!q || q.ok !== true) return { ...fail("storefront-skills", (q && q.reason) || "quote_failed", { sku: sel.sku }), receipts, memory };
    receipts.push({
      stage: "storefront-skills", ok: true, tool: "storefront-skills", toolVersion: STOREFRONT_SKILLS_VERSION,
      sku: q.quote.sku, qty: q.quote.qty, unit_cents: q.quote.unit_cents, amount_cents: q.quote.amount_cents,
    });
  }

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
  const metered = receipts.filter((s) => s.stage === "token-budget" && s.ok);
  const usage = {
    stages_metered: metered.length,
    charged_tokens_est: metered.reduce((n, s) => n + (Number(s.charged_tokens) || 0), 0),
    memo_hits: metered.filter((s) => s.memo_hit === true).length,
  };
  return { ok: true, platform: PLATFORM_NAME, receipts, memory, usage };
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
    description: "Plan one ACN (Agent Commerce Network) run across Rider, Warrant, Tollkeeper, Quikgater, PCC, AWLpay, PSI, Conductor, plus optional stages (warrant-template, standing-rider, reputation, tool-registry, agent-directory, agent-messaging, private-bench, solana, payout, dispute, audit-export, ops-feed, async-runs, sandbox, depot-receipts, depot-billing, conductor-tasks, conductor-review, mcp-catalog, storefront-skills, token-budget, depot-store, chamber-seal, membership) when the matching spec field is present. Pure: no disk, no network.",
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
        warrantTemplate: { type: ["string", "object"] },
        standingRider: { type: ["string", "object"] },
        reputation: { type: ["string", "object"] },
        tool: { type: "object" },
        agent: { type: ["string", "object"] },
        message: { type: "object" },
        privateBench: { type: "object" },
        solana: { type: "object" },
        payout: { type: "object" },
        dispute: { type: "object" },
        audit: { type: ["string", "object"] },
        ops: { type: "object" },
        asyncRun: { type: "object" },
        sandbox: { type: "object" },
        depotReceipt: { type: "object" },
        depotBilling: { type: "object" },
        conductorTask: { type: ["string", "object"] },
        conductorReview: { type: "object" },
        mcpTool: { type: "object" },
        sku: { type: ["string", "object"] },
        tokenBudget: { type: "object" },
        depotStore: { type: "object" },
        chamberSeal: { type: "object" },
        membership: { type: "object" },
      },
    },
  },
  {
    name: "spl_agentic_context",
    description: "Compress LLM context extractively (BM25-lite filter + cross-encoder rerank + dedup), verify by construction, quote on input bytes. Pure: no disk, no network.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        query: { type: "string" },
        targetRatio: { type: "number" },
        maxTokens: { type: "number" },
        reranker: { type: "string" },
        rerankTopK: { type: "number" },
        used_bytes: { type: "number" },
        sku: { type: "string" },
      },
      required: ["text"],
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
        warrantTemplate: { type: ["string", "object"] },
        standingRider: { type: ["string", "object"] },
        reputation: { type: ["string", "object"] },
        tool: { type: "object" },
        agent: { type: ["string", "object"] },
        message: { type: "object" },
        privateBench: { type: "object" },
        solana: { type: "object" },
        payout: { type: "object" },
        dispute: { type: "object" },
        audit: { type: ["string", "object"] },
        ops: { type: "object" },
        asyncRun: { type: "object" },
        sandbox: { type: "object" },
        depotReceipt: { type: "object" },
        depotBilling: { type: "object" },
        conductorTask: { type: ["string", "object"] },
        conductorReview: { type: "object" },
        mcpTool: { type: "object" },
        sku: { type: ["string", "object"] },
        tokenBudget: { type: "object" },
        depotStore: { type: "object" },
        chamberSeal: { type: "object" },
        membership: { type: "object" },
        confirm: { type: "boolean" },
      },
    },
  },
]);

export async function dispatchAgentic(name, args = {}, adapters = {}) {
  if (name === "spl_agentic_plan") return planAgenticRun(args);
  if (name === "spl_agentic_context") {
    const prodRerankFn =
      typeof args.rerankFn === "function" || typeof adapters.rerankFn === "function"
        ? null
        : defaultProductionRerankFn();
    const c = await compressContextAsync({
      text: args.text ?? "",
      query: args.query || "",
      targetRatio: args.targetRatio,
      maxTokens: args.maxTokens,
      reranker: args.reranker,
      rerankTopK: args.rerankTopK,
      ...(prodRerankFn ? { rerankFn: prodRerankFn } : {}),
      ...(typeof args.rerankFn === "function" ? { rerankFn: args.rerankFn } : {}),
      ...(typeof adapters.rerankFn === "function" ? { rerankFn: adapters.rerankFn } : {}),
    });
    if (!c || c.ok !== true || c.refused) {
      return { ok: false, stage: "context", reason: (c && c.reason) || "compress_failed" };
    }
    const v = verifyCompression({ input: args.text ?? "", output: c.output, query: args.query || "" });
    const quote = computeQuote({
      bytes: Buffer.byteLength(String(args.text ?? "")),
      product: "auto", op: "compress",
      ...(args.used_bytes != null ? { used_bytes: args.used_bytes } : {}),
      ...(args.sku ? { sku: args.sku } : {}),
    });
    return { ok: v.ok, stage: "context", tool: "context-compress", toolVersion: CONTEXT_VERSION, ...c, verified: v.ok, checks: v.checks, quote };
  }
  if (name === "spl_agentic_run") {
    if (args.confirm !== true) {
      return { ok: false, needs: "confirm", hint: "re-call with confirm:true plus demo:true or a rider+warrant pair" };
    }
    return runAgenticRun(args, adapters);
  }
  throw new Error("Unknown agentic tool: " + name);
}
