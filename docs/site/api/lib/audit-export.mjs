/**
 * Audit export 0.1.0 — one JSON doc per rider/operator from ledger readers.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * buildAuditPack({ rider_id | operator }) assembles
 * { identity, runs, spend_cents, disputes, receipts_digests } purely from
 * injectable readers, so the exporter never touches a real ledger itself.
 * Deterministic offline defaults: empty ledgers (zero spend, no runs,
 * no disputes). Fail-closed envelopes: missing identity or any reader
 * fault returns { ok:false, error } and never a partial pack.
 */
import { createHash } from "node:crypto";

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function text(v) {
  return v == null ? "" : String(v);
}

function cents(n) {
  const v = Math.floor(Number(n));
  return Number.isSafeInteger(v) && v > 0 ? v : 0;
}

/** Stable stringify: sorted keys, so digests are deterministic. */
export function stableStringify(v) {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  if (isPlainObject(v)) {
    const keys = Object.keys(v).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

/** SHA-256 hex digest of one receipt's canonical form. */
export function digestReceipt(receipt) {
  return createHash("sha256").update(stableStringify(receipt)).digest("hex");
}

const DEFAULT_READERS = {
  readIdentity: (id) => ({ id }),
  listRuns: () => [],
  readSpend: () => ({ spend_cents: 0 }),
  listDisputes: () => [],
  listReceipts: () => [],
};

/**
 * Build a single-JSON-doc audit pack.
 * @param {object} [query] { rider_id } or { operator } (operator_id alias ok).
 * @param {object} [opts] { readers } injectable ledger readers (sync or async).
 */
export async function buildAuditPack(query = {}, opts = {}) {
  const q = isPlainObject(query) ? query : {};
  const id = text(q.rider_id || q.operator || q.operator_id);
  if (id === "") return { ok: false, error: "missing_identity" };
  const readers = { ...DEFAULT_READERS, ...(isPlainObject(opts.readers) ? opts.readers : {}) };

  let identity;
  let runs;
  let spend;
  let disputes;
  let receipts;
  try {
    identity = await readers.readIdentity(id);
    runs = await readers.listRuns(id);
    spend = await readers.readSpend(id);
    disputes = await readers.listDisputes(id);
    receipts = await readers.listReceipts(id);
  } catch {
    return { ok: false, error: "reader_failed" };
  }

  if (!isPlainObject(identity)) identity = { id };
  if (!Array.isArray(runs)) return { ok: false, error: "bad_runs" };
  if (!Array.isArray(disputes)) return { ok: false, error: "bad_disputes" };
  if (!Array.isArray(receipts)) return { ok: false, error: "bad_receipts" };
  const spendCents = isPlainObject(spend) ? cents(spend.spend_cents) : cents(spend);

  let digests;
  try {
    digests = receipts.map(digestReceipt);
  } catch {
    return { ok: false, error: "digest_failed" };
  }

  return {
    ok: true,
    pack: {
      identity: { ...identity, id: text(identity.id) || id },
      runs: JSON.parse(JSON.stringify(runs)),
      spend_cents: spendCents,
      disputes: JSON.parse(JSON.stringify(disputes)),
      receipts_digests: digests,
    },
  };
}
