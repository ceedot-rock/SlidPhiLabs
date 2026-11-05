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

/**
 * Compare version strings as dot-separated numeric semver. Numeric parts
 * compare numerically; a version with more parts wins on a shared prefix;
 * non-numeric remainders fall back to localeCompare. Deterministic pure.
 */
export function compareVersions(a, b) {
  const pa = String(a ?? "").split(".");
  const pb = String(b ?? "").split(".");
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const xa = pa[i] ?? "";
    const ya = pb[i] ?? "";
    const na = /^\d+$/.test(xa) ? Number(xa) : null;
    const nb = /^\d+$/.test(ya) ? Number(ya) : null;
    if (na !== null && nb !== null) {
      if (na !== nb) return na < nb ? -1 : 1;
    } else if (xa !== ya) {
      return xa < ya ? -1 : 1;
    }
  }
  return 0;
}

/** Highest version in a non-empty tool list (top semver, never registration order). */
export function latestOf(matches) {
  let best = matches[0];
  for (let i = 1; i < matches.length; i++) {
    if (compareVersions(matches[i].version, best.version) > 0) best = matches[i];
  }
  return best;
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
      // Unpinned: deterministic latest = top semver, never registration order.
      const hit = latestOf(matches);
      return { ok: true, tool: { ...hit } };
    },
    list() {
      return [...tools.values()]
        .map((t) => ({ ...t }))
        .sort((a, b) => a.id.localeCompare(b.id) || a.version.localeCompare(b.version));
    },
  };
}
