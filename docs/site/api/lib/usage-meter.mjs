/**
 * Byte counter for the hosted compressor.
 * Paid seats reset monthly. Everyone else draws a 1 GB lifetime allowance
 * keyed by IP (no monthly reset). Stored on the Fly volume (AUTH_DIR) so it survives restarts.
 */
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

export function identityFromReq(req) {
  const h = req.headers || {};
  const sku = String(h["x-spl-seat"] || h["x-spl-sku"] || "").toLowerCase();
  const id = String(h["x-spl-seat-id"] || "");
  if (sku && id) return { key: `seat:${sku}:${id}`, sku, via: "seat" };
  const box = parseCookies(req).spl_box || String(h["x-spl-box"] || "");
  const hasBox = String(box).length > 0;
  const ip = String(h["x-forwarded-for"] || h["x-real-ip"] || "").split(",")[0].trim() || "anon";
  return { key: `ip:${ip}`, sku: "", via: hasBox ? "box" : "ip" };
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
  const included = owner ? OWNER_INCLUDED_BYTES : includedBytesForSku(id.sku);
  const projected = used.bytes + Math.max(0, Number(extraBytes) || 0);
  const remaining = Math.max(0, included - used.bytes);
  const quote = computeQuote({ bytes: extraBytes, used_bytes: used.bytes, sku: id.sku });
  return {
    identity: owner ? "owner" : id.key.startsWith("seat:") ? "paid" : id.via === "box" ? "try" : "anon",
    sku: id.sku || null,
    month: used.month,
    window: id.key.startsWith("seat:") ? "calendar_month" : FREE_WINDOW,
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
