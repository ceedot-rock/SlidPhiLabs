/** ACN. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-"));
process.env.WARRANT_DIR = dir;
process.env.WARRANT_SECRET = "test-agentic-secret-32bytes-min!!";

const {
  planAgenticRun,
  runAgenticRun,
  verifyConductorReceipt,
  dispatchAgentic,
  CROSSINGS,
  TOLLHOUSE_TOOLS,
  VERSES,
  resolveVerse,
} = await import("./agentic-platform.mjs");

test("toll tables match the booklets", () => {
  assert.equal(CROSSINGS.length, 7);
  assert.equal(TOLLHOUSE_TOOLS.length, 10);
  assert.ok(TOLLHOUSE_TOOLS.includes("awlpay-quote"));
});

test("plan is pure and shows eight stages", () => {
  const p = planAgenticRun({ demo: true, action: "fetch", host: "www.slidphilabs.com", url: "https://example.com/a" });
  assert.equal(p.ok, true);
  assert.deepEqual(p.plan.stages, ["rider", "warrant", "tollkeeper", "quikgater", "pcc", "awlpay", "psi", "conductor"]);
  assert.equal(p.plan.settle.rail, "none");
  assert.match(p.plan.conductor.digest, /^[a-f0-9]{64}$/);
});

test("plan rejects missing identity, bad action, bad crossing", () => {
  assert.equal(planAgenticRun({ action: "invoke", host: "h.test" }).reason, "missing_identity");
  assert.equal(planAgenticRun({ demo: true, action: "hack", host: "h.test" }).reason, "action_not_allowed");
  assert.equal(planAgenticRun({ demo: true, action: "invoke", host: "h.test", crossing: "nope" }).reason, "unknown_crossing");
  assert.equal(planAgenticRun({ demo: true, action: "fetch", host: "h.test", url: "ftp://x" }).reason, "bad_url");
});

test("seven verses resolve to honest crossings", () => {
  assert.deepEqual(Object.keys(VERSES), ["pcc", "memory", "cuni", "rider", "l33t", "blok", "wallet"]);
  assert.equal(resolveVerse("wallet").crossing, "escrow");
  assert.equal(resolveVerse("  PCC ").crossing, "pcc-compress");
  assert.equal(resolveVerse("memory").crossing, "carry-memory");
  assert.equal(resolveVerse("cuni").crossing, "cuni-proof");
  assert.equal(resolveVerse("rider").crossing, "prove-identity");
  assert.equal(resolveVerse("l33t").crossing, "find-agent");
  assert.equal(resolveVerse("blok").crossing, "stake");
  for (const v of Object.values(VERSES)) {
    assert.match(v.repo, /^https:\/\/github\.com\/ceedot-rock\/\w+$/);
    assert.ok(CROSSINGS.includes(v.crossing) || TOLLHOUSE_TOOLS.includes(v.crossing));
  }
  assert.equal(resolveVerse("nope").error.reason, "unknown_verse");
});

test("plan accepts verse, explicit crossing wins, unknown verse fails", () => {
  const w = planAgenticRun({ demo: true, action: "spend", host: "awlpay.fly.dev", verse: "wallet" });
  assert.equal(w.ok, true);
  assert.equal(w.plan.crossing, "escrow");
  assert.equal(w.plan.verse, "wallet");
  const over = planAgenticRun({ demo: true, action: "spend", host: "awlpay.fly.dev", verse: "wallet", crossing: "delegate" });
  assert.equal(over.plan.crossing, "delegate");
  assert.equal(over.plan.verse, "wallet");
  assert.equal(planAgenticRun({ demo: true, action: "spend", host: "h.test", verse: "nope" }).reason, "unknown_verse");
});

test("unpaid fetch answers 402 with receipts so far", async () => {
  const r = await runAgenticRun({ demo: true, action: "fetch", host: "www.slidphilabs.com", url: "https://example.com/a" });
  assert.equal(r.ok, false);
  assert.equal(r.stage, "quikgater");
  assert.equal(r.status, 402);
  assert.ok(r.receipts.some((s) => s.stage === "tollkeeper" && s.ok));
});

test("paid fetch plus settle plus memory complete offline", async () => {
  const mem = [];
  let captured = null;
  const fetch402 = async (url, { paid }) =>
    paid ? { status: 200, body: "hello page" } : { status: 402, price: { cents: 3 } };
  const r = await runAgenticRun(
    { demo: true, action: "fetch", host: "www.slidphilabs.com", url: "https://example.com/a", pay: true },
    { fetch402, memorize: (e) => mem.push(e), settleFn: async (i) => { captured = i; return { captured: true }; } },
  );
  assert.equal(r.ok, true);
  assert.equal(mem.length, 1);
  assert.match(mem[0].d, /^\d{4}-\d{2}-\d{2}$/);
  const stages = r.receipts.map((s) => s.stage);
  for (const s of ["rider", "warrant", "tollkeeper", "quikgater", "pcc", "awlpay", "psi", "conductor", "warrant-receipt"]) {
    assert.ok(stages.includes(s), "missing " + s);
  }
  assert.equal(captured, null);
});

test("big metered run stops at awlpay 402 unless captured", async () => {
  const unpaid = await runAgenticRun({ demo: true, action: "compress", host: "h.test", bytes: 3 * 1024 * 1024 * 1024 });
  assert.equal(unpaid.ok, false);
  assert.equal(unpaid.stage, "awlpay");
  assert.equal(unpaid.status, 402);
  assert.equal(unpaid.instruction.rail, "x402");
  let captured = null;
  const paid = await runAgenticRun(
    { demo: true, action: "compress", host: "h.test", bytes: 3 * 1024 * 1024 * 1024 },
    { settleFn: async (i) => { captured = i; return { captured: true }; } },
  );
  assert.equal(paid.ok, true);
  assert.equal(captured.rail, "x402");
  assert.equal(captured.platform_fee_cents, Math.round(captured.amount_cents * 0.005));
});

test("conductor receipt verifies over run inputs", () => {
  const p = planAgenticRun({ demo: true, action: "invoke", host: "h.test", bytes: 10 });
  const good = verifyConductorReceipt({ action: "invoke", host: "h.test", bytes: 10, amount_cents: 0 }, p.plan.conductor);
  assert.equal(good.valid, true);
  const bad = verifyConductorReceipt({ action: "invoke", host: "evil.test", bytes: 10, amount_cents: 0 }, p.plan.conductor);
  assert.equal(bad.valid, false);
});

test("agentill map covers every stage", async () => {
  const { AGENTILL_MAP } = await import("./agentic-platform.mjs");
  for (const s of ["rider", "warrant", "tollkeeper", "quikgater", "pcc", "awlpay", "psi", "conductor"]) {
    assert.ok(s in AGENTILL_MAP, "missing " + s);
  }
  assert.equal(AGENTILL_MAP.warrant.agentill, "core/grants");
  assert.equal(AGENTILL_MAP.tollkeeper.agentill, "core/tolls");
});

const SWAP = {
  from_chain: "base", from_token: "USDC", to_chain: "solana", to_token: "SOL",
  amount_cents: 50, to_address: "TestAddr11111111111111111111111111111111",
};
const fakeQuote = async () => ({ amount_cents: 50, path: [{ chain: "base" }], fees: { free: { fee_cents: 0 } } });
const fake402 = async () => ({ status: 402, body: { accepts: [{ network: "eip155:8453", amount: "10000", asset: "0xabc" }] } });
const fakeGatedExec = async (swap, xPayment) => xPayment
  ? ({ status: 200, body: { ok: true, receipt_id: "r1" } })
  : ({ status: 402, body: { accepts: [{ network: "eip155:8453", amount: "10000", asset: "0xabc" }] } });
const fakeDebridge = async () => ({ available: true, usdPriceImpact: -35.5 });

test("awlpay plan is pure intent, run needs swap", async () => {
  const p = planAgenticRun({ demo: true, action: "invoke", host: "h.test", rail: "awlpay", swap: SWAP });
  assert.equal(p.ok, true);
  assert.equal(p.platform, "ACN");
  assert.equal(p.plan.settle.rail, "awlpay");
  assert.equal(p.plan.settle.quoted, "live-at-run");
  const r = await runAgenticRun({ demo: true, action: "invoke", host: "h.test", rail: "awlpay" });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "missing_swap");
});

test("awlpay run stops at 402 with accepts and all-in math", async () => {
  const r = await runAgenticRun(
    { demo: true, action: "invoke", host: "h.test", rail: "awlpay", swap: SWAP, debridge: { srcChainId: "8453" } },
    { awlpayQuoteFn: fakeQuote, awlpayExecuteFn: fake402, debridgeEstimateFn: fakeDebridge },
  );
  assert.equal(r.ok, false);
  assert.equal(r.stage, "awlpay");
  assert.equal(r.status, 402);
  assert.equal(r.accepts.length, 1);
  const fees = r.receipts.find((s) => s.stage === "awlpay-fees");
  assert.equal(fees.all_in.usdPriceImpact, -35.5);
  assert.match(fees.agentill, /ledger\/settle/);
});

test("awlpay run executes with payer proof", async () => {
  const mem = [];
  const r = await runAgenticRun(
    { demo: true, action: "invoke", host: "h.test", rail: "awlpay", swap: SWAP, x_payment: "proof" },
    { awlpayQuoteFn: fakeQuote, awlpayExecuteFn: fakeGatedExec, memorize: (e) => mem.push(e) },
  );
  assert.equal(r.ok, true);
  assert.equal(r.platform, "ACN");
  assert.equal(mem.length, 1);
  const stages = r.receipts.map((s) => s.stage);
  for (const s of ["awlpay-quote", "awlpay-fees", "awlpay", "psi", "conductor"]) {
    assert.ok(stages.includes(s), "missing " + s);
  }
});

test("awlpay run refuses bad quotes", async () => {
  const r = await runAgenticRun(
    { demo: true, action: "invoke", host: "h.test", rail: "awlpay", swap: SWAP },
    { awlpayQuoteFn: async () => ({ refused: true, reason: "price_disagreement" }) },
  );
  assert.equal(r.ok, false);
  assert.equal(r.reason, "quote_refused");
});

test("dispatch needs confirm and rejects unknown tools", async () => {
  const need = await dispatchAgentic("spl_agentic_run", { demo: true });
  assert.equal(need.needs, "confirm");
  await assert.rejects(() => dispatchAgentic("spl_nope", {}), /Unknown agentic tool/);
});

test("platform is ACN and acp rail is selectable", async () => {
  const { PLATFORM_NAME, PLATFORM_FULL_NAME, settlePreview } = await import("./agentic-platform.mjs");
  assert.equal(PLATFORM_NAME, "ACN");
  assert.equal(PLATFORM_FULL_NAME, "Agent Commerce Network");
  const auto = settlePreview(200, {});
  assert.equal(auto.rail, "x402");
  const stripe = settlePreview(200, { rail: "stripe", sku: "rider-crew" });
  assert.equal(stripe.rail, "stripe");
  assert.equal(stripe.capture, "card");
  assert.equal(stripe.amount_cents, 200);
  const acp = settlePreview(200, { rail: "acp", sku: "rider-crew" });
  assert.equal(acp.rail, "acp");
  assert.equal(acp.checkout, "checkout_sessions");
  assert.equal(acp.merchant_of_record, "merchant");
  const plan = planAgenticRun({ demo: true, action: "invoke", host: "h.test", bytes: 3 * 1024 * 1024 * 1024, rail: "acp" });
  assert.equal(plan.platform, "ACN");
  assert.equal(plan.plan.settle.rail, "acp");
  let captured = null;
  const run = await runAgenticRun(
    { demo: true, action: "invoke", host: "h.test", bytes: 3 * 1024 * 1024 * 1024, rail: "acp" },
    { settleFn: async (i) => { captured = i; return { captured: true }; } },
  );
  assert.equal(run.ok, true);
  assert.equal(run.platform, "ACN");
  assert.equal(captured.rail, "acp");
});

const CCTP_SWAP = {
  from_chain: "base", from_token: "USDC", to_chain: "solana", to_token: "USDC",
  amount_cents: 50, to_address: "TestAddr11111111111111111111111111111111",
};
const fakeCctpDeposit = async (d) => {
  fakeCctpDeposit.seen = d;
  return { ok: true, txHash: "0xburntx", messageHash: "0xmsg" };
};
const fakeCctpAttest = async () => ({ status: "complete", message: "0xmsg", attestation: "0xatt" });
const fakeCctpMint = async (m) => {
  fakeCctpMint.seen = m;
  return { ok: true, txHash: "sol-mint-tx" };
};
const cctpAdapters = () => ({ cctpDepositFn: fakeCctpDeposit, cctpAttestationFn: fakeCctpAttest, cctpMintFn: fakeCctpMint });

test("cctp plan previews Base-Solana domains and iris attestations", () => {
  const p = planAgenticRun({ demo: true, action: "invoke", host: "h.test", rail: "cctp", swap: CCTP_SWAP });
  assert.equal(p.ok, true);
  assert.equal(p.plan.settle.rail, "cctp");
  assert.equal(p.plan.settle.protocol, "cctp-v2");
  assert.equal(p.plan.settle.token, "USDC");
  assert.equal(p.plan.settle.from_domain, 6);
  assert.equal(p.plan.settle.to_domain, 5);
  assert.equal(p.plan.settle.attestations, "iris-api");
  assert.equal(p.plan.settle.quoted, "live-at-run");
  const rev = planAgenticRun({ demo: true, action: "invoke", host: "h.test", rail: "cctp", swap: { ...CCTP_SWAP, from_chain: "solana", to_chain: "base", fast: true } });
  assert.equal(rev.plan.settle.from_domain, 5);
  assert.equal(rev.plan.settle.to_domain, 6);
  assert.equal(rev.plan.settle.fast, true);
});

test("cctp run validates swap, USDC-only, and known domains", async () => {
  const noSwap = await runAgenticRun({ demo: true, action: "invoke", host: "h.test", rail: "cctp" }, cctpAdapters());
  assert.equal(noSwap.ok, false);
  assert.equal(noSwap.reason, "missing_swap");
  const wrapped = await runAgenticRun({ demo: true, action: "invoke", host: "h.test", rail: "cctp", swap: { ...CCTP_SWAP, to_token: "SOL" } }, cctpAdapters());
  assert.equal(wrapped.ok, false);
  assert.equal(wrapped.reason, "unsupported_token");
  const unknown = await runAgenticRun({ demo: true, action: "invoke", host: "h.test", rail: "cctp", swap: { ...CCTP_SWAP, to_chain: "hyperliquid" } }, cctpAdapters());
  assert.equal(unknown.ok, false);
  assert.equal(unknown.reason, "unsupported_chain");
});

test("cctp run burns, attests, and mints with receipts", async () => {
  const mem = [];
  const r = await runAgenticRun(
    { demo: true, action: "invoke", host: "h.test", rail: "cctp", swap: CCTP_SWAP },
    { ...cctpAdapters(), memorize: (e) => mem.push(e) },
  );
  assert.equal(r.ok, true);
  assert.equal(mem.length, 1);
  const stages = r.receipts.map((s) => s.stage);
  for (const s of ["cctp-deposit", "cctp-attestation", "cctp-mint", "awlpay", "psi", "conductor"]) {
    assert.ok(stages.includes(s), "missing " + s);
  }
  assert.equal(fakeCctpDeposit.seen.from_domain, 6);
  assert.equal(fakeCctpDeposit.seen.to_domain, 5);
  assert.equal(fakeCctpMint.seen.attestation, "0xatt");
  const settle = r.receipts.find((s) => s.stage === "awlpay");
  assert.equal(settle.rail, "cctp");
  assert.equal(settle.captured.tx, "sol-mint-tx");
  const mint = r.receipts.find((s) => s.stage === "cctp-mint");
  assert.match(mint.agentill, /ledger\/settle/);
});

test("cctp run surfaces pending attestation without minting", async () => {
  let minted = false;
  const r = await runAgenticRun(
    { demo: true, action: "invoke", host: "h.test", rail: "cctp", swap: CCTP_SWAP },
    { ...cctpAdapters(), cctpAttestationFn: async () => ({ status: "pending" }), cctpMintFn: async () => { minted = true; return { ok: true }; } },
  );
  assert.equal(r.ok, false);
  assert.equal(r.reason, "attestation_pending");
  assert.equal(minted, false);
  assert.ok(r.receipts.some((s) => s.stage === "cctp-deposit"));
});

test("cctp fast transfer is gated per source chain", async () => {
  const slow = await runAgenticRun(
    { demo: true, action: "invoke", host: "h.test", rail: "cctp", swap: { ...CCTP_SWAP, from_chain: "polygon", fast: true } },
    cctpAdapters(),
  );
  assert.equal(slow.ok, false);
  assert.equal(slow.reason, "fast_unavailable");
  // Solana source fails closed to standard flow: Circle marks Solana
  // Upfront-fees=NO, so fast-from-Solana is not offered.
  const sol = await runAgenticRun(
    { demo: true, action: "invoke", host: "h.test", rail: "cctp", swap: { ...CCTP_SWAP, from_chain: "solana", to_chain: "base", fast: true } },
    cctpAdapters(),
  );
  assert.equal(sol.ok, false);
  assert.equal(sol.reason, "fast_unavailable");
  const fast = await runAgenticRun(
    { demo: true, action: "invoke", host: "h.test", rail: "cctp", swap: { ...CCTP_SWAP, fast: true } },
    cctpAdapters(),
  );
  assert.equal(fast.ok, true);
});

test("cctp run needs deposit and mint adapters", async () => {
  const r = await runAgenticRun(
    { demo: true, action: "invoke", host: "h.test", rail: "cctp", swap: CCTP_SWAP },
    { cctpAttestationFn: fakeCctpAttest },
  );
  assert.equal(r.ok, false);
  assert.equal(r.reason, "adapter_required");
});


test("chain rides verify, receipts, and conductor seals", async () => {
  const chain = [{ actor: "demo", mode: "self" }, { actor: "agent-a", mode: "act-for" }];
  const r = await runAgenticRun({ demo: true, action: "invoke", host: "h.test", bytes: 10, actor: "agent-a", chain, file_receipt: false });
  assert.equal(r.ok, true);
  const cond = r.receipts.find((s) => s.stage === "conductor");
  assert.deepEqual(cond.chain, [{ actor: "demo", mode: "self" }, { actor: "agent-a", mode: "act-for" }]);
  const v = verifyConductorReceipt({ action: "invoke", host: "h.test", bytes: 10, amount_cents: 0, chain }, cond);
  assert.equal(v.valid, true);
  assert.equal(v.chain_valid, true);
  const bad = verifyConductorReceipt({ action: "invoke", host: "h.test", bytes: 10, amount_cents: 0, chain: [{ actor: "demo" }, { actor: "agent-x" }] }, cond);
  assert.equal(bad.chain_valid, false);
});


test("cuni proof needs a well-formed receipt", async () => {
  const { runCuniProof } = await import("./agentic-platform.mjs");
  const missing = await runCuniProof({});
  assert.equal(missing.ok, false);
  assert.equal(missing.fail.reason, "missing_receipt");
  const bad = await runCuniProof({ cuni: { receipt: { verdict: "maybe" } } });
  assert.equal(bad.ok, false);
  assert.equal(bad.fail.reason, "bad_verdict");
  const nope = await runCuniProof(
    { cuni: { receipt: { verdict: "pass", stdout: "42", signature: "sig" } } },
    { cuniVerifyFn: async () => ({ ok: false, reason: "drift" }) },
  );
  assert.equal(nope.ok, false);
  assert.equal(nope.fail.reason, "verify_failed");
});

test("cuni proof records pass with stdout digest", async () => {
  const { runCuniProof, sha256hex } = await import("./agentic-platform.mjs");
  const r = await runCuniProof(
    { cuni: { receipt: { verdict: "pass", stdout: "42", signature: "sig" } } },
    { cuniVerifyFn: async () => ({ ok: true }) },
  );
  assert.equal(r.ok, true);
  assert.equal(r.receipts[0].stage, "cuni-proof");
  assert.equal(r.receipts[0].stdout_sha256, sha256hex("42"));
  assert.equal(r.receipts[0].signature_present, true);
  assert.equal(r.receipts[0].verified_by, "caller-adapter");
  const structural = await runCuniProof({ cuni: { receipt: { verdict: "refuse" } } });
  assert.equal(structural.ok, true);
  assert.equal(structural.receipts[0].verified_by, "structural-only");
});

test("cuni stage joins the run when spec carries one", async () => {
  const p = planAgenticRun({ demo: true, action: "invoke", host: "h.test", cuni: { receipt: { verdict: "pass" } } });
  assert.ok(p.plan.stages.includes("cuni"));
  const r = await runAgenticRun(
    { demo: true, action: "invoke", host: "h.test", bytes: 10, file_receipt: false, cuni: { receipt: { verdict: "pass" } } },
  );
  assert.equal(r.ok, true);
  assert.ok(r.receipts.some((s) => s.stage === "cuni-proof"));
});

test("psi file sink appends observatory lines, opt-in only", async () => {
  const { psiFileSink } = await import("./agentic-platform.mjs");
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "psi-")), "obs.jsonl");
  const mem = [];
  const r = await runAgenticRun(
    { demo: true, action: "invoke", host: "h.test", bytes: 10, file_receipt: false },
    { memorize: (e) => { mem.push(e); psiFileSink(f)(e); } },
  );
  assert.equal(r.ok, true);
  const lines = fs.readFileSync(f, "utf8").trim().split("\n");
  assert.equal(lines.length, 1);
  const logged = JSON.parse(lines[0]);
  assert.match(logged.d, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(logged.c, "ship");
  assert.throws(() => psiFileSink(""), /needs a path/);
});

const ACN_ORDER = [
  "rider", "warrant", "warrant-template", "standing-rider", "tollkeeper",
  "reputation", "quikgater", "tool-registry", "agent-directory",
  "agent-messaging", "context", "benchhaus", "private-bench", "pcc", "cuni",
  "awlpay", "solana", "payout", "dispute", "audit-export", "ops-feed",
  "async-runs", "sandbox", "depot-receipts", "depot-billing",
  "conductor-tasks", "conductor-review", "mcp-catalog", "storefront-skills",
  "psi", "conductor",
];

async function acnFixtures() {
  const { createToolRegistry } = await import("./tool-registry.mjs");
  const { createAgentDirectory } = await import("./agent-directory.mjs");
  const { createOpsFeed } = await import("./ops-feed.mjs");
  const { createRunManager } = await import("./async-runs.mjs");
  const { createMcpCatalog } = await import("./mcp-catalog.mjs");
  const registry = createToolRegistry();
  assert.equal(registry.register({ id: "pcc-compress", version: "1.0.0", price_cents: 5, endpoint: "https://tools.test/pcc" }).ok, true);
  const mcpCatalog = createMcpCatalog({
    seed: [{ name: "pcc_compress", version: "1.0.0", endpoint: "https://tools.test/mcp", price_cents: 25, protocol: "streamable-http", auth: "api-key" }],
  });
  const directory = createAgentDirectory();
  assert.equal(directory.register({ rider_id: "agent-1", endpoint: "https://agents.test/a1", score: 80 }).ok, true);
  const payoutsDir = fs.mkdtempSync(path.join(os.tmpdir(), "acn-payouts-"));
  const disputesDir = fs.mkdtempSync(path.join(os.tmpdir(), "acn-disputes-"));
  const fixedNow = () => "2026-01-01T00:00:00.000Z";
  return {
    spec: {
      demo: true, action: "invoke", host: "h.test", file_receipt: false,
      url: "https://example.com/a", pay: true,
      warrantTemplate: "compress",
      standingRider: {
        safeguards: { spendCapCents: 100, allowedCrossings: ["escrow"], velocityPerMin: 5, allowedTools: ["pcc-compress"] },
        waiver: { accepted: true, version: "waiver-v1" },
      },
      reputation: "op1",
      tool: { id: "pcc-compress", version: "1.0.0" },
      agent: "agent-1",
      message: { from_rider: "a", to_rider: "b", offer: { sku: "x", amount_cents: 5 }, nonce: "acn-n-1" },
      context: { text: "hello world hello world hello", query: "hello" },
      benchhaus: {},
      privateBench: {},
      cuni: { receipt: { verdict: "pass" } },
      solana: { amount_cents: 50 },
      payout: { rider_id: "op1", amount_cents: 100, rail: "base_evm", to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
      dispute: { order_id: "ord-1", reason: "test dispute", amount_cents: 50 },
      audit: "op1",
      ops: { type: "run_completed", detail: {} },
      asyncRun: { task: "demo" },
      sandbox: { items: [{ name: "demo" }] },
      depotReceipt: { op: "publish", team: "acme", sha256: "ab".repeat(32), bytes: 100 },
      depotBilling: { team: "acme", month: "2026-11", receipts: [], seats: 3 },
      conductorTask: { prompt: "ship it" },
      conductorReview: { diff: "+ hello\n" },
      mcpTool: { name: "pcc_compress", version: "1.0.0" },
      sku: "gitdepot",
    },
    adapters: {
      standingRider: { store: new Map() },
      reputation: { ledgerPath: path.join(fs.mkdtempSync(path.join(os.tmpdir(), "acn-rep-")), "rep.jsonl") },
      toolRegistry: registry,
      agentDirectory: directory,
      privateBench: {
        source: "test",
        attest: true,
        fixtures: {
          plan: { passed: 1, n: 1 }, retrieval: { passed: 1, n: 1 },
          state: { passed: 1, n: 1 }, refusal: { passed: 1, n: 1 },
        },
      },
      solanaEnv: { X402_PAY_TO: "TestPayTo1111111111111111111111111111111" },
      payouts: { dir: payoutsDir, now: fixedNow, id: () => "po_test1" },
      disputes: { dir: disputesDir, now: fixedNow, id: () => "dp_test1" },
      opsFeed: createOpsFeed({ now: fixedNow }),
      runManager: createRunManager({ now: fixedNow }),
      mcpCatalog,
      fetch402: async () => ({ status: 200, body: "hi" }),
    },
  };
}

test("optional acn stages join plan and run in order", async () => {
  const { spec, adapters } = await acnFixtures();
  const p = planAgenticRun(spec, adapters);
  assert.equal(p.ok, true);
  assert.deepEqual(p.plan.stages, ACN_ORDER);
  assert.equal(p.plan.warrantTemplate.params.actions.join(","), "compress");
  assert.match(p.plan.standingRider.safeguards_hash, /^[a-f0-9]{64}$/);
  assert.equal(p.plan.privateBench.siascore, 100);
  assert.equal(p.plan.solana.mode, "receive");
  assert.equal(p.plan.sandbox.mode, "sandbox");
  assert.equal(p.plan.depotReceipt.quoted_cents, 0);
  assert.equal(p.plan.depotBilling.amount_cents, 0);
  assert.equal(p.plan.conductorTask.prompt, "ship it");
  assert.equal(p.plan.conductorReview.verdict, "approve");
  assert.equal(p.plan.mcpTool.name, "pcc_compress");
  assert.equal(p.plan.sku.amount_cents, 1500);
  const r = await runAgenticRun(spec, adapters);
  assert.equal(r.ok, true);
  const wantReceipts = ACN_ORDER.map((s) => (s === "cuni" ? "cuni-proof" : s));
  assert.deepEqual(r.receipts.map((s) => s.stage), wantReceipts);
  const byStage = Object.fromEntries(r.receipts.map((s) => [s.stage, s]));
  assert.equal(byStage["standing-rider"].mode, "issued");
  assert.equal(byStage["standing-rider"].safeguards_hash, p.plan.standingRider.safeguards_hash);
  assert.equal(byStage.reputation.score, 0.5); // unknown rider: neutral bootstrap prior, never 1.0
  assert.equal(byStage["tool-registry"].version, "1.0.0");
  assert.equal(byStage["agent-directory"].score, 80);
  assert.equal(byStage["agent-messaging"].kind, "draft");
  assert.equal(byStage["private-bench"].provenance, "held-out:test");
  assert.equal(byStage["private-bench"].verified, true);
  assert.equal(byStage.solana.instruction.to, "TestPayTo1111111111111111111111111111111");
  assert.equal(byStage.payout.intent_id, "po_test1");
  assert.equal(byStage.payout.requires, "operator_signature");
  assert.equal(byStage.dispute.dispute_id, "dp_test1");
  assert.equal(byStage["audit-export"].spend_cents, 0);
  assert.equal(byStage["ops-feed"].seq, 1);
  assert.match(byStage["async-runs"].run_id, /^run_\d+$/);
  assert.equal(byStage.sandbox.spend_cents, 0);
  assert.equal(byStage["depot-receipts"].quoted_cents, 0);
  assert.equal(byStage["depot-receipts"].bytes, 100);
  assert.equal(byStage["depot-billing"].amount_cents, 0);
  assert.match(byStage["conductor-tasks"].task_id, /^task_\d+$/);
  assert.equal(byStage["conductor-tasks"].branch, "conductor/task-0001");
  assert.equal(byStage["conductor-review"].verdict, "approve");
  assert.equal(byStage["mcp-catalog"].version, "1.0.0");
  assert.equal(byStage["mcp-catalog"].protocol, "streamable-http");
  assert.equal(byStage["storefront-skills"].amount_cents, 1500);
  const pcc = byStage.pcc;
  const cond = byStage.conductor;
  const v = verifyConductorReceipt(
    { action: "invoke", host: "h.test", url: byStage.quikgater.url, bytes: pcc.bytes, amount_cents: pcc.amount_cents },
    cond,
  );
  assert.equal(v.valid, true);
});

test("optional acn stages fail closed", async () => {
  const base = { demo: true, action: "invoke", host: "h.test", bytes: 10, file_receipt: false };
  const { createOpsFeed } = await import("./ops-feed.mjs");
  const { createToolRegistry } = await import("./tool-registry.mjs");
  const { createMcpCatalog } = await import("./mcp-catalog.mjs");
  const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "acn-fail-"));
  const run = (spec, adapters = {}) => runAgenticRun({ ...base, ...spec }, adapters);

  assert.equal((await run({ payout: { rider_id: "op1", amount_cents: 1, rail: "base_evm", to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" } })).reason, "below_minimum");
  assert.equal((await run({ privateBench: {} })).reason, "no_public_fixture");
  assert.equal((await run({ tool: { id: "nope" } })).reason, "adapter_required");
  assert.equal((await run({ tool: { id: "nope" } }, { toolRegistry: createToolRegistry() })).reason, "unknown_tool");
  assert.equal((await run({ agent: "ghost" })).reason, "adapter_required");
  assert.equal((await run({ dispute: { order_id: "ord-x", reason: "r" } }, { disputes: { dir: tmp() } })).reason, "unknown_order");
  assert.equal((await run({ message: { from_rider: "a" } })).reason, "bad_envelope");
  assert.equal((await run({ sandbox: { items: [] } }, { sandbox: { settleFn: {} } })).reason, "sandbox_refuses_live_adapter");
  assert.equal((await run({ solana: { amount_cents: 50 } }, { solanaEnv: {} })).reason, "rail_disabled");
  assert.equal((await run({ standingRider: "sr_nope" })).reason, "unknown_rider");
  assert.equal((await run({ reputation: 42 })).reason, "missing_rider_id");
  assert.equal((await run({ ops: { type: "nope" } }, { opsFeed: createOpsFeed({}) })).reason, "unknown_event");
  assert.equal((await run({ ops: { type: "run_completed" } })).reason, "adapter_required");
  assert.equal((await run({ audit: 42 })).reason, "missing_identity");
  assert.equal((await run({ asyncRun: "x" })).reason, "invalid_spec");
  assert.equal((await run({ warrantTemplate: "nope" })).reason, "unknown_template");
  assert.equal((await run({ warrantTemplate: { id: "compress", overrides: { max_usd: 999 } } })).reason, "widening_denied");
  assert.equal((await run({ depotReceipt: { op: "rm", team: "acme", sha256: "ab".repeat(32), bytes: 1 } })).reason, "bad_receipt");
  assert.equal((await run({ depotBilling: { team: "acme", month: "nope", receipts: [] } })).reason, "bad_invoice");
  assert.equal((await run({ conductorTask: { prompt: "" } })).reason, "bad_task");
  assert.equal((await run({ conductorReview: { diff: 42 } })).reason, "invalid_diff");
  assert.equal((await run({ mcpTool: { name: "pcc_compress", version: "1.0.0" } })).reason, "adapter_required");
  assert.equal((await run({ mcpTool: { name: "ghost", version: "1.0.0" } }, { mcpCatalog: createMcpCatalog() })).reason, "unknown_tool");
  assert.equal((await run({ mcpTool: { name: "pcc_compress" } })).reason, "bad_tool");
  assert.equal((await run({ sku: "nope" })).reason, "unknown_sku");
  assert.equal((await run({ sku: 42 })).reason, "bad_sku");
});

test("agentill map covers every wired stage", async () => {
  const { AGENTILL_MAP } = await import("./agentic-platform.mjs");
  for (const s of ACN_ORDER) {
    assert.ok(s in AGENTILL_MAP, "missing " + s);
  }
});

test("token-budget plans as opt-in stage with preview", () => {
  const p = planAgenticRun({ demo: true, action: "invoke", host: "h.test", tokenBudget: { cap_tokens: 100, key: "demo" } });
  assert.equal(p.ok, true);
  assert.ok(p.plan.stages.includes("token-budget"));
  assert.equal(p.plan.tokenBudget.tool, "token-budget");
  assert.equal(p.plan.tokenBudget.cap_tokens, 100);
  const bad = planAgenticRun({ demo: true, action: "invoke", host: "h.test", tokenBudget: { cap_tokens: -1 } });
  assert.equal(bad.plan.tokenBudget.reason, "bad_budget");
});

test("token-budget run charges, memoizes, and reports usage", async () => {
  const memo = {};
  const store = {
    lookup: (d) => (d in memo ? memo[d] : null),
    record: (d, r) => { memo[d] = r; },
  };
  const compressFn = ({ text }) => ({ ok: true, output: text.slice(0, 4) });
  const spec = {
    demo: true, action: "invoke", host: "h.test",
    tokenBudget: { cap_tokens: 1000, key: "demo", text: "hello world hello", query: "q" },
  };
  const first = await runAgenticRun(spec, { tokenMemo: store, tokenCompressFn: compressFn });
  assert.equal(first.ok, true);
  const tb1 = first.receipts.find((s) => s.stage === "token-budget");
  assert.equal(tb1.memo_hit, false);
  assert.ok(tb1.charged_tokens > 0);
  const second = await runAgenticRun(spec, { tokenMemo: store, tokenCompressFn: compressFn });
  const tb2 = second.receipts.find((s) => s.stage === "token-budget");
  assert.equal(tb2.memo_hit, true);
  assert.equal(tb2.charged_tokens, 0);
  assert.equal(second.usage.stages_metered, 1);
  assert.equal(second.usage.memo_hits, 1);
  assert.equal(second.usage.charged_tokens_est, 0);
});

test("token-budget run fails closed over cap", async () => {
  const r = await runAgenticRun({
    demo: true, action: "invoke", host: "h.test",
    tokenBudget: { cap_tokens: 2, key: "demo", charge_tokens: 50 },
  });
  assert.equal(r.ok, false);
  assert.equal(r.stage, "token-budget");
  assert.equal(r.reason, "budget_exceeded");
});

test("depot-store plans and publishes through the adapter", async () => {
  const seen = [];
  const fetchFn = async (url, opts = {}) => {
    seen.push({ url, method: (opts && opts.method) || "GET" });
    return { ok: true, status: 200, json: async () => ({ published: "run-1", sha256: "ab".repeat(32), size: 4, team: "lab" }) };
  };
  const adapters = { depotStore: { endpoint: "https://depot.example", key: "k", fetchFn } };
  const spec = { demo: true, action: "invoke", host: "h.test", depotStore: { op: "publish", name: "run-1", bytes: "abcd" } };
  const p = planAgenticRun(spec, adapters);
  assert.equal(p.ok, true);
  assert.ok(p.plan.stages.includes("depot-store"));
  assert.equal(p.plan.depotStore.op, "publish");
  const r = await runAgenticRun(spec, adapters);
  assert.equal(r.ok, true);
  const hit = r.receipts.find((s) => s.stage === "depot-store");
  assert.equal(hit.op, "publish");
  assert.equal(hit.name, "run-1");
  const denied = await runAgenticRun(spec, {});
  assert.equal(denied.ok, false);
  assert.equal(denied.stage, "depot-store");
  assert.equal(denied.reason, "adapter_required");
});

test("chamber-seal plans and seals through the adapter key", async () => {
  const keyHex = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const adapters = { chamberSeal: { keyHex } };
  const spec = { demo: true, action: "invoke", host: "h.test", chamberSeal: { seal: { sku: "chamber-year", usd: 200 } } };
  const p = planAgenticRun(spec, adapters);
  assert.equal(p.ok, true);
  assert.ok(p.plan.stages.includes("chamber-seal"));
  assert.equal(p.plan.chamberSeal.mode, "seal");
  const r = await runAgenticRun(spec, adapters);
  assert.equal(r.ok, true);
  const hit = r.receipts.find((s) => s.stage === "chamber-seal");
  assert.equal(hit.mode, "sealed");
  assert.match(hit.sha256, /^[0-9a-f]{64}$/);
  const denied = await runAgenticRun(spec, {});
  assert.equal(denied.ok, false);
  assert.equal(denied.stage, "chamber-seal");
  assert.equal(denied.reason, "adapter_required");
});

test("membership resolves the founding tier and refuses the spent grant", async () => {
  const { issueFoundingGrant } = await import("./founding-grants.mjs");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "acn-member-"));
  const issued = issueFoundingGrant({ seq: 1, rider_id: "rider-1" }, { dir });
  assert.equal(issued.ok, true);
  const adapters = { membership: { dir } };
  const p = planAgenticRun({ demo: true, action: "invoke", host: "h.test", membership: { grant_seq: 1 } }, adapters);
  assert.equal(p.ok, true);
  assert.ok(p.plan.stages.includes("membership"));
  assert.equal(p.plan.membership.tier, "founding");
  const r = await runAgenticRun({ demo: true, action: "invoke", host: "h.test", membership: { grant_seq: 1, spent_cents: 100 } }, adapters);
  assert.equal(r.ok, true);
  const hit = r.receipts.find((s) => s.stage === "membership");
  assert.equal(hit.tier, "founding");
  assert.equal(hit.remaining_cents, 2400);
  const over = await runAgenticRun({ demo: true, action: "invoke", host: "h.test", membership: { grant_seq: 1, spent_cents: 99999 } }, adapters);
  assert.equal(over.ok, false);
  assert.equal(over.stage, "membership");
  assert.equal(over.reason, "cap_exceeded");
  const free = await runAgenticRun({ demo: true, action: "invoke", host: "h.test", membership: {} }, adapters);
  assert.equal(free.ok, true);
  assert.equal(free.receipts.find((s) => s.stage === "membership").tier, "free");
});

test("rider-paid-call plans the envelope and completes with adapters", async () => {
  const tx = "0x" + "ab".repeat(32);
  const sig = "0x" + "cd".repeat(65);
  const payment = { txHash: tx, payerSig: sig, amount_cents: 25, rail: "base" };
  const adapters = {
    riderPaidCall: {
      verifyRider: () => ({ ok: true, rider_id: "rider-1" }),
      verifyChain: () => ({ ok: true, tx, rail: "base", paid_cents: 25 }),
    },
  };
  const spec = { demo: true, action: "invoke", host: "h.test", riderPaidCall: { rider: "rider-1", payment } };
  const p = planAgenticRun(spec, adapters);
  assert.equal(p.ok, true);
  assert.ok(p.plan.stages.includes("rider-paid-call"));
  assert.equal(p.plan.riderPaidCall.tool, "rider-paid-call");
  const r = await runAgenticRun(spec, adapters);
  assert.equal(r.ok, true);
  const hit = r.receipts.find((s) => s.stage === "rider-paid-call");
  assert.equal(hit.rider_id, "rider-1");
  assert.equal(hit.tx, tx);
  const denied = await runAgenticRun(spec, {});
  assert.equal(denied.ok, false);
  assert.equal(denied.stage, "rider-paid-call");
  assert.equal(denied.reason, "adapter_required");
});
