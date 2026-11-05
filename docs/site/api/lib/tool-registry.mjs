/**
 * Tool registry 0.1.0 — version-pinned tool catalog for discovery.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Deterministic, offline, in-memory: no disk, no network. Unknown tool
 * or version lookups fail closed ({ ok:false }), never null/throw.
 */
export const TOOL_REGISTRY_VERSION = "0.1.0";

function text(v) {
  return v == null ? "" : String(v).trim();
}

function cleanTool(t) {
  if (!t || typeof t !== "object") return null;
  const id = text(t.id);
  const version = text(t.version);
  const endpoint = text(t.endpoint);
  if (!id || !version || !endpoint) return null;
  const price = Number(t.price_cents);
  if (!Number.isSafeInteger(price) || price < 0) return null;
  return {
    id,
    version,
    price_cents: price,
    endpoint,
    schema: t.schema !== undefined ? t.schema : null,
  };
}

/** Create an isolated in-memory tool registry. */
export function createToolRegistry() {
  const tools = new Map(); // key: `${id}@${version}` -> tool
  return {
    register(tool) {
      const clean = cleanTool(tool);
      if (!clean) return { ok: false, reason: "bad_tool" };
      const key = `${clean.id}@${clean.version}`;
      if (tools.has(key)) return { ok: false, reason: "duplicate_tool" };
      tools.set(key, clean);
      return { ok: true, tool: { ...clean } };
    },
    get(id, version) {
      const name = text(id);
      if (!name) return { ok: false, reason: "unknown_tool" };
      const want = version == null ? null : text(version);
      const matches = [...tools.values()].filter((t) => t.id === name);
      if (!matches.length) return { ok: false, reason: "unknown_tool" };
      if (want) {
        const hit = matches.find((t) => t.version === want);
        if (!hit) return { ok: false, reason: "unknown_version" };
        return { ok: true, tool: { ...hit } };
      }
      // Unpinned: deterministic latest = last registered wins.
      const hit = matches[matches.length - 1];
      return { ok: true, tool: { ...hit } };
    },
    list() {
      return [...tools.values()]
        .map((t) => ({ ...t }))
        .sort((a, b) => a.id.localeCompare(b.id) || a.version.localeCompare(b.version));
    },
  };
}
