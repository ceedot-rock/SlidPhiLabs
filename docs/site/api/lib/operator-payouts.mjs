/**
 * Operator payouts 0.1.0 — unsigned USDC payout intents + operator claim flow.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Receive/quote side only: quotePayout() builds an UNSIGNED payout
 * instruction { to, amount, asset, chain } and records the intent to a
 * local ledger file. Payouts are EXECUTED by operator signature — this
 * module never holds keys, never signs, and never broadcasts. The claim
 * flow (claimPayout / recordExecuted) tracks intent status
 * quoted -> claimed -> executed without touching signing material.
 *
 * USDC-only, $1.00 minimum (100 cents). Integer cents in, base-unit raw
 * string out (USDC has 6 decimals: raw = cents * 10^4, BigInt math).
 *
 * Deterministic offline defaults: no network, no models. I/O is injectable
 * via adapters ({ dir, now, id }) so tests run hermetic. Every public
 * function returns a fail-closed envelope { ok, ... } / { ok:false, error }.
 */
import { existsSync, mkdirSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { loadJson, CorruptStoreError, isCorruptStoreError } from "./failclosed-store.mjs";

export const PAYOUTS_VERSION = "0.1.0";
export const MIN_PAYOUT_CENTS = 100; // $1.00 minimum
export const USDC_DECIMALS = 6;
export const USDC_BASE_MAINNET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const USDC_SOLANA_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const CHAIN_BASE = "eip155:8453";
export const CHAIN_SOLANA = "solana-mainnet-beta";

export const RAILS = {
  base_evm: { chain: CHAIN_BASE, asset: USDC_BASE_MAINNET, decimals: USDC_DECIMALS },
  solana: { chain: CHAIN_SOLANA, asset: USDC_SOLANA_MAINNET, decimals: USDC_DECIMALS },
};

export const RIDER_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const EVM_ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
const SOL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const INTENT_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

function payoutsDir(adapterDir) {
  if (adapterDir || process.env.PAYOUTS_DIR) {
    const dir = String(adapterDir || process.env.PAYOUTS_DIR);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
    return dir;
  }
  const base =
    process.env.AUTH_DIR ||
    (existsSync("/data") ? "/data" : null) ||
    join(tmpdir(), "spl-payouts");
  const dir = join(String(base), "payouts");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

function ledgerFile(dir) {
  return join(dir, "payouts.json");
}

function blank() {
  return { version: PAYOUTS_VERSION, intents: {} };
}

function load(dir) {
  const f = ledgerFile(dir);
  const o = loadJson(f, blank);
  if (!o || typeof o !== "object" || !o.intents || typeof o.intents !== "object") {
    throw new CorruptStoreError(f, new Error("bad_shape"));
  }
  return o;
}

/**
 * Load, mapping a corrupt store to a fail-closed envelope.
 * Callers return early on !ok and NEVER save over the corrupt file.
 */
function loadOrCorrupt(dir) {
  try {
    return { ok: true, store: load(dir) };
  } catch (e) {
    if (isCorruptStoreError(e)) return { ok: false, error: "corrupt_store" };
    throw e;
  }
}

function save(dir, o) {
  const f = ledgerFile(dir);
  const tmp = `${f}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(o), { mode: 0o600 });
  renameSync(tmp, f);
}

/** USDC base units for integer cents (6 decimals): cents * 10^4, exact. */
export function centsToRaw(cents, decimals = USDC_DECIMALS) {
  const n = BigInt(Math.floor(Number(cents)));
  return (n * 10n ** BigInt(decimals - 2)).toString();
}

function defaultId() {
  return `po_${randomBytes(8).toString("hex")}`;
}

function fail(error, extra = {}) {
  return { ok: false, error, ...extra };
}

/**
 * Quote an unsigned USDC payout. Records intent (status "quoted") and
 * returns the unsigned instruction for the operator to sign elsewhere.
 * Never holds keys. Adapters: { dir, now: () => ISO string, id: () => string }.
 *
 * Idempotency: the intent id is the idempotency key. Re-quoting the same
 * key with identical (rider_id, amount_cents, rail, to) returns
 * { ok:true, duplicate:true, intent } without writing. Re-quoting the
 * same key with DIFFERENT terms fails closed with idempotency_conflict —
 * a retried request is safe, a recycled key is not silently honored.
 */
export function quotePayout({ rider_id, amount_cents, rail, to }, adapters = {}) {
  const riderId = String(rider_id || "");
  if (!RIDER_RE.test(riderId)) return fail("bad_rider_id");
  const cents = Math.floor(Number(amount_cents));
  if (!Number.isSafeInteger(cents) || cents <= 0) return fail("bad_amount");
  if (cents < MIN_PAYOUT_CENTS) return fail("below_minimum", { minimum_cents: MIN_PAYOUT_CENTS });
  const cfg = RAILS[rail];
  if (!cfg) return fail("bad_rail", { rails: Object.keys(RAILS) });
  const dest = String(to || "");
  const addrOk = rail === "base_evm" ? EVM_ADDR_RE.test(dest) : SOL_ADDR_RE.test(dest);
  if (!addrOk) return fail("bad_destination");
  const dir = payoutsDir(adapters.dir);
  const loaded = loadOrCorrupt(dir);
  if (!loaded.ok) return loaded;
  const store = loaded.store;
  const now = adapters.now ? adapters.now() : new Date().toISOString();
  const id = adapters.id ? adapters.id() : defaultId();
  if (!INTENT_RE.test(String(id))) return fail("bad_intent_id");
  const prior = store.intents[id];
  if (prior) {
    const sameTerms =
      prior.rider_id === riderId &&
      prior.amount_cents === cents &&
      prior.rail === rail &&
      prior.to === dest;
    if (sameTerms) return { ok: true, duplicate: true, intent: prior };
    return fail("idempotency_conflict", { intent_id: String(id) });
  }
  const intent = {
    id,
    rider_id: riderId,
    amount_cents: cents,
    amount_raw: centsToRaw(cents, cfg.decimals),
    rail,
    chain: cfg.chain,
    asset: cfg.asset, // USDC-only: asset is fixed per rail, never caller-supplied
    decimals: cfg.decimals,
    to: dest,
    instruction: { to: dest, amount: centsToRaw(cents, cfg.decimals), asset: cfg.asset, chain: cfg.chain },
    status: "quoted",
    claim: null,
    execution: null,
    t_created: now,
    t_updated: now,
  };
  store.intents[id] = intent;
  try {
    save(dir, store);
  } catch (e) {
    return fail("ledger_write_failed", { detail: String((e && e.message) || e) });
  }
  return { ok: true, intent };
}

/**
 * Claim an intent for operator execution. Returns a claim envelope the
 * operator signs OUT OF BAND — no keys here, no signature produced.
 */
export function claimPayout({ intent_id }, adapters = {}) {
  if (!INTENT_RE.test(String(intent_id || ""))) return fail("bad_intent_id");
  const dir = payoutsDir(adapters.dir);
  const loaded = loadOrCorrupt(dir);
  if (!loaded.ok) return loaded;
  const store = loaded.store;
  const intent = store.intents[intent_id];
  if (!intent) return fail("unknown_intent");
  if (intent.status === "claimed") return { ok: true, duplicate: true, claim: intent.claim };
  if (intent.status === "executed") return fail("already_executed");
  const now = adapters.now ? adapters.now() : new Date().toISOString();
  intent.status = "claimed";
  intent.t_updated = now;
  intent.claim = {
    intent_id: intent.id,
    instruction: { ...intent.instruction },
    requires: "operator_signature",
    t_claimed: now,
  };
  try {
    save(dir, store);
  } catch (e) {
    return fail("ledger_write_failed", { detail: String((e && e.message) || e) });
  }
  return { ok: true, claim: intent.claim };
}

/**
 * Record an operator-signed execution (tx hash + signer) against a
 * claimed intent. Does not broadcast anything — bookkeeping only.
 */
export function recordExecuted({ intent_id, tx, signer }, adapters = {}) {
  if (!INTENT_RE.test(String(intent_id || ""))) return fail("bad_intent_id");
  if (!String(tx || "").trim()) return fail("bad_tx");
  if (!String(signer || "").trim()) return fail("bad_signer");
  const dir = payoutsDir(adapters.dir);
  const loaded = loadOrCorrupt(dir);
  if (!loaded.ok) return loaded;
  const store = loaded.store;
  const intent = store.intents[intent_id];
  if (!intent) return fail("unknown_intent");
  if (intent.status === "executed") return { ok: true, duplicate: true, intent };
  if (intent.status !== "claimed") return fail("not_claimed");
  const now = adapters.now ? adapters.now() : new Date().toISOString();
  intent.status = "executed";
  intent.t_updated = now;
  intent.execution = { tx: String(tx), signer: String(signer), t_executed: now };
  try {
    save(dir, store);
  } catch (e) {
    return fail("ledger_write_failed", { detail: String((e && e.message) || e) });
  }
  return { ok: true, intent };
}

/** Read one intent. Fail-closed null envelope on miss. */
export function getIntent(intent_id, adapters = {}) {
  if (!INTENT_RE.test(String(intent_id || ""))) return { ok: false, error: "bad_intent_id" };
  const loaded = loadOrCorrupt(payoutsDir(adapters.dir));
  if (!loaded.ok) return loaded;
  const store = loaded.store;
  const intent = store.intents[intent_id];
  if (!intent) return { ok: false, error: "unknown_intent" };
  return { ok: true, intent };
}

/** List all recorded intents, oldest first. */
export function listIntents(adapters = {}) {
  const loaded = loadOrCorrupt(payoutsDir(adapters.dir));
  if (!loaded.ok) return loaded;
  const store = loaded.store;
  const intents = Object.values(store.intents).sort((a, b) =>
    String(a.t_created).localeCompare(String(b.t_created)),
  );
  return { ok: true, intents };
}
