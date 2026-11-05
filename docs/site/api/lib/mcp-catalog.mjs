/**
 * MCP tool catalog 0.1.0 — version-pinned registry for MCP tool discovery.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Deterministic, offline, in-memory: no disk, no network. Narrower than
 * tool-registry: every entry carries MCP transport fields
 * ({ protocol: "streamable-http" | "stdio", auth }) and every lookup is
 * version-pinned — a missing version, unknown name, or unknown version
 * fails closed ({ ok:false }), never null/throw.
 */

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
 * pre-register, { clock: () => isoString } stamp for registered_at.
 */
export function createMcpCatalog({ seed = [], clock = null } = {}) {
  const tools = new Map(); // key: `${name}@${version}` -> entry
  const now = typeof clock === "function" ? clock : () => new Date().toISOString();
  const catalog = {
    register(tool) {
      const clean = cleanEntry(tool);
      if (!clean) return { ok: false, reason: "bad_tool" };
      const key = `${clean.name}@${clean.version}`;
      if (tools.has(key)) return { ok: false, reason: "duplicate_tool" };
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
