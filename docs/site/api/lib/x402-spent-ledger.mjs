/**
 * Global x402 spent-tx ledger (consume-once).
 *
 * Same Solana signature / Base txHash cannot mint a second order or suite job
 * across /api/x402-products and /api/x402-suite. Durable on the Fly volume
 * (AUTH_DIR=/data) via exclusive-create files — one file per spent proof.
 *
 * Skip keys: empty, "dev-bypass" (X402_DEV_BYPASS rail).
 */
import { existsSync, mkdirSync, openSync, closeSync, writeSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";

const SKIP = new Set(["", "dev-bypass"]);

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
  const fallback = join(tmpdir(), "spl-x402-spent");
  if (!existsSync(fallback)) mkdirSync(fallback, { recursive: true, mode: 0o700 });
  return fallback;
}

function spentDir() {
  const d = join(rootDir(), "x402-spent");
  if (!existsSync(d)) mkdirSync(d, { recursive: true, mode: 0o700 });
  return d;
}

/**
 * Normalize a payment proof id for ledger keys.
 * - EVM: lowercase 0x + 64 hex
 * - Solana base58: as-is (case-sensitive)
 * - namespaced keys (eip155:8453:0x… / sol:…) preserved with lowercased hash part
 */
export function normalizeTxKey(raw) {
  if (raw == null) return "";
  let s = String(raw).trim();
  if (!s || SKIP.has(s)) return s === "dev-bypass" ? "dev-bypass" : "";

  // already namespaced
  const ns = s.match(/^(eip155:\d+|sol):(.*)$/i);
  if (ns) {
    const net = ns[1].toLowerCase().startsWith("eip") ? ns[1].toLowerCase() : "sol";
    const rest = ns[2].trim();
    if (net.startsWith("eip") && /^0x[0-9a-fA-F]{64}$/.test(rest)) {
      return `${net}:${rest.toLowerCase()}`;
    }
    if (net === "sol" && rest) return `sol:${rest}`;
    return `${net}:${rest}`;
  }

  if (/^0x[0-9a-fA-F]{64}$/.test(s)) return s.toLowerCase();
  // Solana sig ~87-88 base58
  if (/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(s)) return s;
  // anything else: keep trimmed lowercase for EVM-ish, else as-is
  if (s.startsWith("0x")) return s.toLowerCase();
  return s;
}

function fileFor(key) {
  // filesystem-safe name; keep short + collision-proof via sha256 of full key
  const digest = createHash("sha256").update(key).digest("hex");
  const hint = key
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return join(spentDir(), `${hint || "tx"}_${digest.slice(0, 24)}.json`);
}

export function lookupSpent(raw) {
  const key = normalizeTxKey(raw);
  if (!key || key === "dev-bypass") return null;
  const file = fileFor(key);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return { tx: key, at: null, corrupt: true };
  }
}

/**
 * Atomically consume a txHash/signature once.
 * @returns {{ ok: true, first: true, skipped?: boolean, record?: object }
 *         | { ok: false, reason: 'already_used', prior: object|null }}
 */
export function consumePaymentTx(raw, meta = {}) {
  const key = normalizeTxKey(raw);
  if (!key || key === "dev-bypass") {
    return { ok: true, first: true, skipped: true, reason: key === "dev-bypass" ? "dev_bypass" : "empty" };
  }

  const prior = lookupSpent(key);
  if (prior && !prior.corrupt) {
    return { ok: false, reason: "already_used", prior };
  }

  const record = {
    schema: "spl.x402.spent.v1",
    tx: key,
    at: new Date().toISOString(),
    endpoint: meta.endpoint || null,
    ref: meta.ref || null,
    network: meta.network || null,
    sku: meta.sku || null,
  };

  const file = fileFor(key);
  try {
    const fd = openSync(file, "wx", 0o600);
    try {
      writeSync(fd, JSON.stringify(record) + "\n");
    } finally {
      closeSync(fd);
    }
    return { ok: true, first: true, record };
  } catch (e) {
    if (e && e.code === "EEXIST") {
      return { ok: false, reason: "already_used", prior: lookupSpent(key) };
    }
    throw e;
  }
}

export function alreadyUsedResponse(prior, requirements = null) {
  const body = {
    error: "Payment already used",
    reason: "already_used",
    detail:
      "This txHash/signature was already consumed on an earlier x402 call (global ledger across /api/x402-products and /api/x402-suite).",
    prior: prior
      ? {
          endpoint: prior.endpoint || null,
          at: prior.at || null,
          ref: prior.ref || null,
          network: prior.network || null,
          sku: prior.sku || null,
        }
      : null,
  };
  if (requirements) {
    return { ...requirements, ...body };
  }
  return body;
}

export default {
  normalizeTxKey,
  lookupSpent,
  consumePaymentTx,
  alreadyUsedResponse,
};
