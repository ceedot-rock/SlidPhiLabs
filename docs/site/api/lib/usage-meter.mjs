/**
 * Monthly byte counter for the hosted compressor.
 * Identity: paid seat, else the 24h box cookie, else IP.
 * Stored on the Fly volume (AUTH_DIR) so it survives restarts.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseCookies } from "./spl-box-gate.js";
import { includedBytesForSku, FREE_GB, CENTS_PER_GB, computeQuote } from "../suite-pricing.js";

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
  if (sku && id) return { key: `seat:${sku}:${id}`, sku };
  const box = parseCookies(req).spl_box || String(h["x-spl-box"] || "");
  if (box) return { key: `box:${box.split(".")[0]}`, sku: "" };
  const ip = String(h["x-forwarded-for"] || h["x-real-ip"] || "").split(",")[0].trim() || "anon";
  return { key: `ip:${ip}`, sku: "" };
}

function pathFor(key, month) {
  const safe = String(key).replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 120);
  const dir = join(rootDir(), "usage", month);
  return { dir, file: join(dir, `${safe}.json`) };
}

export function readUsage(key, month = monthKey()) {
  const { file } = pathFor(key, month);
  if (!existsSync(file)) return { key, month, bytes: 0, jobs: 0 };
  try {
    const j = JSON.parse(readFileSync(file, "utf8"));
    return { key, month, bytes: Number(j.bytes) || 0, jobs: Number(j.jobs) || 0 };
  } catch {
    return { key, month, bytes: 0, jobs: 0 };
  }
}

export function addUsage(key, n, month = monthKey()) {
  const add = Math.max(0, Number(n) || 0);
  const { dir, file } = pathFor(key, month);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  const cur = readUsage(key, month);
  const next = { key, month, bytes: cur.bytes + add, jobs: cur.jobs + (add ? 1 : 0) };
  writeFileSync(file, JSON.stringify(next), { mode: 0o600 });
  return next;
}

export function meterSnapshot(req, extraBytes = 0) {
  const id = identityFromReq(req);
  const used = readUsage(id.key);
  const included = includedBytesForSku(id.sku);
  const projected = used.bytes + Math.max(0, Number(extraBytes) || 0);
  const remaining = Math.max(0, included - used.bytes);
  const quote = computeQuote({ bytes: extraBytes, used_bytes: used.bytes, sku: id.sku });
  return {
    identity: id.key.startsWith("seat:") ? "paid" : id.key.startsWith("box:") ? "try" : "anon",
    sku: id.sku || null,
    month: used.month,
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
