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
