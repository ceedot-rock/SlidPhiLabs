/**
 * Registry search 0.1.0 — substring + tag search over tools/agents.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Deterministic, offline, pure: no disk, no network. Tools and agents
 * arrive via injectable readers (arrays or () => array thunks); the
 * default is the empty catalog. Relevance is ranked name hits (3) >
 * tag hits (2) > description hits (1); ties break by id. Bad queries
 * fail closed ({ ok:false }), never an unranked dump.
 */
export const REGISTRY_SEARCH_VERSION = "0.1.0";

export const SCORE_NAME = 3;
export const SCORE_TAG = 2;
export const SCORE_DESCRIPTION = 1;

function text(v) {
  return v == null ? "" : String(v).toLowerCase();
}

function resolveReader(reader) {
  if (typeof reader === "function") {
    try {
      const out = reader();
      return Array.isArray(out) ? out : null;
    } catch {
      return null;
    }
  }
  return Array.isArray(reader) ? reader : null;
}

function tagsOf(entry) {
  const t = entry.tags ?? entry.labels ?? [];
  return Array.isArray(t) ? t.map((x) => text(x)) : [];
}

function scoreEntry(entry, q) {
  const name = text(entry.id ?? entry.name);
  const desc = text(entry.description ?? entry.blurb ?? "");
  const tags = tagsOf(entry);
  let score = 0;
  if (name && name.includes(q)) score += SCORE_NAME;
  if (tags.some((t) => t && t.includes(q))) score += SCORE_TAG;
  if (desc && desc.includes(q)) score += SCORE_DESCRIPTION;
  return score;
}

/**
 * Search tools + agents. opts: { query, tools, agents, limit } where
 * tools/agents are arrays or () => array thunks. Returns
 * { ok:true, results:[{ kind, id, score, entry }] } ranked best-first.
 */
export function searchRegistry(opts = {}) {
  const q = typeof opts.query === "string" ? opts.query.trim().toLowerCase() : "";
  if (!q) return { ok: false, reason: "bad_query" };
  const tools = resolveReader(opts.tools);
  const agents = resolveReader(opts.agents);
  if (!tools || !agents) return { ok: false, reason: "bad_reader" };
  let limit = opts.limit == null ? 25 : Number(opts.limit);
  if (!Number.isSafeInteger(limit) || limit < 1) return { ok: false, reason: "bad_limit" };
  limit = Math.min(limit, 100);

  const out = [];
  for (const entry of tools) {
    if (!entry || typeof entry !== "object") continue;
    const score = scoreEntry(entry, q);
    if (score > 0) {
      const id = String(entry.id ?? entry.name ?? "").trim();
      if (id) out.push({ kind: "tool", id, score, entry: { ...entry } });
    }
  }
  for (const entry of agents) {
    if (!entry || typeof entry !== "object") continue;
    const score = scoreEntry(entry, q);
    if (score > 0) {
      const id = String(entry.id ?? entry.name ?? "").trim();
      if (id) out.push({ kind: "agent", id, score, entry: { ...entry } });
    }
  }
  out.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { ok: true, results: out.slice(0, limit) };
}
