/**
 * MCP tool catalog 0.1.0 — version-pinned registry for MCP tool discovery.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Deterministic, offline, in-memory: no disk, no network. Narrower than
 * tool-registry: every entry carries MCP transport fields
 * ({ protocol: "streamable-http" | "stdio", auth }) and every lookup is
 * version-pinned — a missing version, unknown name, or unknown version
 * fails closed ({ ok:false }), never null/throw.
 *
 * Process-ephemeral by default: the index lives in a Map and dies with
 * the process — restarts, redeploys, and serverless cold starts lose
 * every registration, which is the safe offline default (no prod paths
 * touched, no stale tools resurrected). Pass { path } for the file-backed
 * option: entries persist as JSONL (atomic appends) and reload on create;
 * the fs surface ({ readFile, appendFile }) is injectable so tests never
 * touch disk.
 */

import { readFileSync, appendFileSync } from "node:fs";

function defaultFileFs() {
  return {
    readFile: (p) => readFileSync(p, "utf8"),
    appendFile: (p, s) => appendFileSync(p, s, "utf8"),
  };
}

export const MCP_CATALOG_VERSION = "0.1.0";
export const MCP_PROTOCOLS = ["streamable-http", "stdio"];

function text(v) {
  return v == null ? "" : String(v).trim();
}

function cleanEntry(t) {
  if (!t || typeof t !== "object") return null;
  const name = text(t.name);
  const version = text(t.version);
  const endpoint = text(t.endpoint);
  if (!name || !version || !endpoint) return null;
  const price = Number(t.price_cents);
  if (!Number.isSafeInteger(price) || price < 0) return null;
  if (!MCP_PROTOCOLS.includes(t.protocol)) return null;
  const auth = text(t.auth);
  if (!auth) return null;
  return { name, version, endpoint, price_cents: price, protocol: t.protocol, auth };
}

/**
 * Create an isolated in-memory MCP tool catalog.
 * Adapters (all optional, offline defaults): { seed: entries[] } to
 * pre-register, { clock: () => isoString } stamp for registered_at,
 * { path, fs } for the file-backed option (JSONL persistence + reload).
 */
export function createMcpCatalog({ seed = [], clock = null, path = null, fs = null } = {}) {
  const tools = new Map(); // key: `${name}@${version}` -> entry
  const now = typeof clock === "function" ? clock : () => new Date().toISOString();
  const file = typeof path === "string" && path ? path : null;
  const io = file ? fs || defaultFileFs() : null;
  let fileError = null;
  if (file) {
    let raw = null;
    try {
      raw = io.readFile(file);
    } catch (err) {
      if (err && (err.code === "ENOENT" || /no such file/i.test(String(err && err.message)))) {
        raw = null; // fresh file: start empty
      } else {
        fileError = "read_error"; // fail-closed below, never half-loaded
      }
    }
    if (typeof raw === "string") {
      for (const line of raw.split("\n")) {
        const t = line.trim();
        if (!t) continue;
        try {
          const clean = cleanEntry(JSON.parse(t));
          if (clean) tools.set(`${clean.name}@${clean.version}`, { ...clean, registered_at: now() });
        } catch {
          /* skip corrupt lines: fail-closed lookups still hold */
        }
      }
    }
  }
  const catalog = {
    register(tool) {
      if (fileError) return { ok: false, reason: fileError };
      const clean = cleanEntry(tool);
      if (!clean) return { ok: false, reason: "bad_tool" };
      const key = `${clean.name}@${clean.version}`;
      if (tools.has(key)) return { ok: false, reason: "duplicate_tool" };
      if (file) {
        try {
          io.appendFile(file, `${JSON.stringify(clean)}\n`);
        } catch {
          return { ok: false, reason: "write_error" };
        }
      }
      tools.set(key, { ...clean, registered_at: now() });
      return { ok: true, tool: { ...tools.get(key) } };
    },
    get(name, version) {
      const toolName = text(name);
      if (!toolName) return { ok: false, reason: "unknown_tool" };
      const want = version == null ? "" : text(version);
      if (!want) return { ok: false, reason: "version_required" };
      const matches = [...tools.values()].filter((t) => t.name === toolName);
      if (!matches.length) return { ok: false, reason: "unknown_tool" };
      const hit = matches.find((t) => t.version === want);
      if (!hit) return { ok: false, reason: "unknown_version" };
      return { ok: true, tool: { ...hit } };
    },
    list() {
      return [...tools.values()]
        .map((t) => ({ ...t }))
        .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
    },
  };
  for (const entry of Array.isArray(seed) ? seed : []) catalog.register(entry);
  return catalog;
}
