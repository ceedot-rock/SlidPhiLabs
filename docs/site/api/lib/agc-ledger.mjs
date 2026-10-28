/**
 * AGC credit ledger — prepaid lab credits, minted only by verified x402 USDC.
 *
 * One file per agent_id on AUTH_DIR (/data on Fly, tmp fallback), JSON:
 *   { agent_id, balance, minted_total, spent_total, orders: {order_id: {...}},
 *     receipts: [ {id, kind: mint|debit, credits, ref, memo, t} ] }
 * Writes are atomic (tmp + rename). Mint is idempotent on order_id AND on
 * payment tx: same tx can never mint twice. Debit fails closed on
 * insufficient balance. No float anywhere — integer credits only.
 *
 * 1 credit = 1 US cent of lab services. Hops stay USDC-only (see Rider
 * PAYMENT_PATHS 410 reject.agc_removed); AGC is the closed-loop unit for
 * services: board tools, lab verbs, PCC/PSI metered work.
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync, renameSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export const AGC_PER_PACK = 1000; // agc-pack: $10.00 -> 1000 credits
export const AGENT_RE = /^[0-9a-f]{16}$/i; // Rider agent_id shape
export const ORDER_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

function rootDir() {
  const d = process.env.AUTH_DIR || (existsSync("/data") ? "/data" : null);
  if (d) {
    try {
      if (!existsSync(d)) mkdirSync(d, { recursive: true, mode: 0o700 });
      return d;
    } catch {
      /* fall through */
    }
  }
  const fallback = process.env.AGC_DIR || join(tmpdir(), "spl-agc");
  if (!existsSync(fallback)) mkdirSync(fallback, { recursive: true, mode: 0o700 });
  return fallback;
}

function ledgerDir() {
  const d = join(rootDir(), "agc-ledger");
  if (!existsSync(d)) mkdirSync(d, { recursive: true, mode: 0o700 });
  return d;
}

function fileFor(agentId) {
  const safe = String(agentId).toLowerCase().replace(/[^0-9a-f]/g, "").slice(0, 32) || "unknown";
  return join(ledgerDir(), `agc_${safe}.json`);
}

function blank(agentId) {
  return { agent_id: agentId, balance: 0, minted_total: 0, spent_total: 0, orders: {}, receipts: [] };
}

function load(agentId) {
  const f = fileFor(agentId);
  if (!existsSync(f)) return blank(agentId);
  try {
    const o = JSON.parse(readFileSync(f, "utf8"));
    if (!o || typeof o.balance !== "number" || !o.orders) return blank(agentId);
    if (!Array.isArray(o.receipts)) o.receipts = [];
    return o;
  } catch {
    return blank(agentId);
  }
}

function save(o) {
  const f = fileFor(o.agent_id);
  const tmp = f + ".tmp-" + process.pid;
  writeFileSync(tmp, JSON.stringify(o), { mode: 0o600 });
  renameSync(tmp, f);
}

function receipt(o, kind, credits, ref, memo) {
  const r = {
    id: `agc-${kind}-${o.receipts.length + 1}-${Date.now()}`,
    kind,
    credits,
    ref: ref || null,
    memo: memo || null,
    balance_after: o.balance,
    t: new Date().toISOString(),
  };
  o.receipts.push(r);
  return r;
}

/** Mint credits from a verified x402 purchase. Idempotent on order_id and tx. */
export function mintAgc({ agent_id, order_id, tx, network, credits = AGC_PER_PACK, pack_sku = "agc-pack" }) {
  const agentId = String(agent_id || "").toLowerCase();
  if (!AGENT_RE.test(agentId)) return { ok: false, error: "bad_agent_id" };
  if (!ORDER_RE.test(String(order_id || ""))) return { ok: false, error: "bad_order_id" };
  const n = Math.floor(Number(credits));
  if (!Number.isSafeInteger(n) || n <= 0) return { ok: false, error: "bad_credits" };
  const o = load(agentId);
  if (o.orders[order_id]) {
    return { ok: true, duplicate: true, balance: o.balance, receipt: o.orders[order_id].receipt };
  }
  for (const [oid, rec] of Object.entries(o.orders)) {
    if (tx && rec.tx && rec.tx === tx) {
      return { ok: true, duplicate: true, balance: o.balance, receipt: rec.receipt, via_order: oid };
    }
  }
  o.balance += n;
  o.minted_total += n;
  const r = receipt(o, "mint", n, String(order_id), `${pack_sku} · tx ${tx || "n/a"} · ${network || "n/a"}`);
  o.orders[order_id] = { credits: n, tx: tx || null, network: network || null, sku: pack_sku, receipt: r };
  save(o);
  return { ok: true, balance: o.balance, receipt: r };
}

/** Spend credits. Fails closed when balance is short. Idempotent on ref. */
export function debitAgc({ agent_id, credits, ref, memo }) {
  const agentId = String(agent_id || "").toLowerCase();
  if (!AGENT_RE.test(agentId)) return { ok: false, error: "bad_agent_id" };
  const n = Math.floor(Number(credits));
  if (!Number.isSafeInteger(n) || n <= 0) return { ok: false, error: "bad_credits" };
  if (ref && !ORDER_RE.test(String(ref))) return { ok: false, error: "bad_ref" };
  const o = load(agentId);
  if (ref) {
    const prior = o.receipts.find((r) => r.kind === "debit" && r.ref === ref);
    if (prior) return { ok: true, duplicate: true, balance: o.balance, receipt: prior };
  }
  if (o.balance < n) {
    return { ok: false, error: "insufficient_agc", balance: o.balance, need: n };
  }
  o.balance -= n;
  o.spent_total += n;
  const r = receipt(o, "debit", n, ref || null, memo || null);
  save(o);
  return { ok: true, balance: o.balance, receipt: r };
}

export function balanceAgc(agent_id) {
  const agentId = String(agent_id || "").toLowerCase();
  if (!AGENT_RE.test(agentId)) return { ok: false, error: "bad_agent_id" };
  const o = load(agentId);
  return { ok: true, balance: o.balance, minted_total: o.minted_total, spent_total: o.spent_total };
}

/** Resolve purchase order -> agent: order_id recorded at mint time. */
export function agentForOrder(order_id) {
  if (!ORDER_RE.test(String(order_id || ""))) return null;
  let files;
  try {
    files = readdirSync(ledgerDir()).filter((f) => f.startsWith("agc_") && f.endsWith(".json"));
  } catch {
    return null;
  }
  for (const f of files) {
    try {
      const o = JSON.parse(readFileSync(join(ledgerDir(), f), "utf8"));
      if (o && o.orders && o.orders[order_id]) return o.agent_id;
    } catch {
      /* skip corrupt */
    }
  }
  return null;
}
