/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * Byte counter for the hosted compressor.
 * Paid seats reset monthly. Everyone else draws a 1 GB lifetime allowance
 * keyed by IP (no monthly reset). Stored on the Fly volume (AUTH_DIR) so it survives restarts.
 *
 * Identity binding (anti-spoofing): the X-Forwarded-For / X-Real-IP header
 * is client-controlled, so the raw IP is NEVER used as a storage key or
 * filename. The IP identity is HMAC-SHA256(server_secret, "<day>|<ip>")
 * truncated to 32 hex chars, scoped to the current UTC day:
 *   key = `iph:<YYYY-MM-DD>:<hmac32>`
 * The raw IP never touches disk (no PII in usage filenames) and bucket
 * names are unguessable without the secret, so one tenant cannot read or
 * pollute another tenant's bucket by guessing filenames.
 *
 * Server secret: USAGE_IDENTITY_SECRET env. When unset, the fallback is a
 * deterministic per-process salt (`weak-process:<pid>:<ppid>`) — DOCUMENTED
 * WEAK: it is predictable to local observers and changes on every restart,
 * which rotates ALL IP buckets (quota state resets). Set
 * USAGE_IDENTITY_SECRET in production.
 *
 * Day-scoping means IP buckets are per-day: abuse of a bucket expires with
 * the day. Requests with no IP at all share a single low "anon" bucket
 * (ANON_INCLUDED_BYTES) so headerless abuse cannot draw the full free tier.
 */
import { createHmac } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseCookies } from "./spl-box-gate.js";
import { includedBytesForSku, FREE_GB, FREE_WINDOW, CENTS_PER_GB, computeQuote } from "../suite-pricing.js";
import { seatFromClaimHeader } from "./claim-seat.mjs";
import { isOwnerEmail } from "./owner-gratis.mjs";

/** Owner quota: effectively unlimited, but usage is still COUNTED so the
 *  ledger shows what the owner took for free (gratis recorded, never silent). */
export const OWNER_INCLUDED_BYTES = Number.MAX_SAFE_INTEGER;

/** Shared headerless bucket: low on purpose (fail-closed for anon abuse). */
export const ANON_INCLUDED_BYTES = 10 * 1024 * 1024; // 10 MiB
export const ANON_KEY = "anon";
/** Prefix for HMAC-bound per-day IP identities. */
export const IPHM_PREFIX = "iph:";

/** Current UTC day `YYYY-MM-DD` (the rotation scope for IP identities). */
export function identityDay(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/** Where the identity secret comes from: "env" or the weak process fallback. */
export function identitySecretKind() {
  return process.env.USAGE_IDENTITY_SECRET ? "env" : "weak-process";
}

function identitySecretOf(opts = {}) {
  if (opts && typeof opts.secret === "string" && opts.secret.length > 0) return opts.secret;
  if (process.env.USAGE_IDENTITY_SECRET) return process.env.USAGE_IDENTITY_SECRET;
  // WEAK fallback (see header): predictable + restarts rotate every bucket.
  return `weak-process:${process.pid}:${process.ppid}`;
}

function hmac32(secret, text) {
  return createHmac("sha256", String(secret)).update(String(text), "utf8").digest("hex").slice(0, 32);
}

/** Normalize a client-supplied IP for hashing (never stored raw). */
export function cleanIp(req) {
  const h = (req && req.headers) || {};
  const raw = String(h["x-forwarded-for"] || h["x-real-ip"] || "").split(",")[0].trim();
  if (!raw) return null;
  if (raw.length > 100) return null;
  return raw.toLowerCase();
}

export function ownerFromReq(req) {
  try {
    const s = seatFromClaimHeader(req);
    if (s.ok && isOwnerEmail(s.payload && s.payload.email)) return true;
  } catch {
    /* fall through */
  }
  return false;
}

function rootDir() {
  const d = process.env.AUTH_DIR || "/data";
  try {
    if (!existsSync(d)) mkdirSync(d, { recursive: true, mode: 0o700 });
    return d;
  } catch {
    const fallback = join(tmpdir(), "spl-usage");
    if (!existsSync(fallback)) mkdirSync(fallback, { recursive: true, mode: 0o700 });
    return fallback;
  }
}

export function monthKey(d = new Date()) {
  return d.toISOString().slice(0, 7);
}

/**
 * Identity for a request. opts (all optional, for tests):
 * { day: "YYYY-MM-DD", secret }.
 * - paid seat header  -> { key: `seat:<sku>:<id>`, via: "seat" }
 * - verifiable IP     -> { key: `iph:<day>:<hmac32>`, via: "box"|"ip" }
 * - no IP at all      -> { key: "anon", via: "anon" }
 */
export function identityFromReq(req, opts = {}) {
  const h = (req && req.headers) || {};
  const sku = String(h["x-spl-seat"] || h["x-spl-sku"] || "").toLowerCase();
  const id = String(h["x-spl-seat-id"] || "");
  if (sku && id) return { key: `seat:${sku}:${id}`, sku, via: "seat" };
  const box = parseCookies(req).spl_box || String(h["x-spl-box"] || "");
  const hasBox = String(box).length > 0;
  const ip = cleanIp(req);
  if (!ip) return { key: ANON_KEY, sku: "", via: "anon" };
  const day =
    opts && typeof opts.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(opts.day)
      ? opts.day
      : identityDay(opts && opts.now instanceof Date ? opts.now : new Date());
  const tag = hmac32(identitySecretOf(opts), `${day}|${ip}`);
  return { key: `${IPHM_PREFIX}${day}:${tag}`, sku: "", via: hasBox ? "box" : "ip", day };
}

function pathFor(key, month) {
  const lifetime = !String(key).startsWith("seat:");
  const safe = lifetime
    ? String(key).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120)
    : String(key).replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 120);
  const dir = join(rootDir(), "usage", lifetime ? "lifetime" : month);
  return { dir, file: join(dir, `${safe}.json`) };
}

export function readUsage(key, month = monthKey()) {
  const bucket = String(key).startsWith("seat:") ? month : "lifetime";
  const { file } = pathFor(key, bucket);
  if (!existsSync(file)) return { key, month: bucket, bytes: 0, jobs: 0 };
  try {
    const j = JSON.parse(readFileSync(file, "utf8"));
    return { key, month: bucket, bytes: Number(j.bytes) || 0, jobs: Number(j.jobs) || 0 };
  } catch {
    return { key, month: bucket, bytes: 0, jobs: 0 };
  }
}

export function addUsage(key, n, month = monthKey()) {
  const add = Math.max(0, Number(n) || 0);
  const { dir, file } = pathFor(key, month);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  const cur = readUsage(key, month);
  const next = { key, month: cur.month, bytes: cur.bytes + add, jobs: cur.jobs + (add ? 1 : 0) };
  writeFileSync(file, JSON.stringify(next), { mode: 0o600 });
  return next;
}

export function meterSnapshot(req, extraBytes = 0) {
  const id = identityFromReq(req);
  const used = readUsage(id.key);
  const owner = ownerFromReq(req);
  const included = owner
    ? OWNER_INCLUDED_BYTES
    : id.key === ANON_KEY
      ? ANON_INCLUDED_BYTES
      : includedBytesForSku(id.sku);
  const projected = used.bytes + Math.max(0, Number(extraBytes) || 0);
  const remaining = Math.max(0, included - used.bytes);
  const quote = computeQuote({ bytes: extraBytes, used_bytes: used.bytes, sku: id.sku });
  return {
    identity: owner ? "owner" : id.key.startsWith("seat:") ? "paid" : id.via === "box" ? "try" : "anon",
    sku: id.sku || null,
    month: used.month,
    window: id.key.startsWith("seat:") ? "calendar_month" : id.key === ANON_KEY ? FREE_WINDOW : "daily",
    used_bytes: used.bytes,
    jobs: used.jobs,
    included_bytes: included,
    remaining_bytes: remaining,
    remaining_gb: +(remaining / (1024 * 1024 * 1024)).toFixed(3),
    free_gb: FREE_GB,
    usd_per_gb: CENTS_PER_GB / 100,
    would_charge: extraBytes ? quote : null,
    over: projected > included,
  };
}
