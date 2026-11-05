/**
 * Registry search 0.1.0 — substring + token-prefix + tag search over tools/agents.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Deterministic, offline, pure: no disk, no network. Tools and agents
 * arrive via injectable readers (arrays or () => array thunks); the
 * default is the empty catalog. The query is tokenized on non-alphanumeric
 * runs; each token scores a word-prefix hit first (name 3 > tag 2 >
 * description 1, as before) with a whole-field substring fallback — so
 * "shrink, windows!" finds "shrink context windows" even though the raw
 * string never occurs. Raw-query substring scoring is kept as the
 * fallback, so single-token queries behave exactly as before. Ties break
 * by id. Bad queries fail closed ({ ok:false }), never an unranked dump.
 */
export const REGISTRY_SEARCH_VERSION = "0.1.0";

export const SCORE_NAME = 3;
export const SCORE_TAG = 2;
export const SCORE_DESCRIPTION = 1;

function text(v) {
  return v == null ? "" : String(v).toLowerCase();
}

/** Split on non-alphanumeric runs; lowercase; drop empties. */
export function tokenize(query) {
  return String(query ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
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

/** Words of a field for prefix matching (same non-alnum split as the query). */
function wordsOf(field) {
  return tokenize(field);
}

/**
 * Score one token against one field: word-prefix hit first, whole-field
 * substring as the fallback. Both carry the full field weight.
 */
function scoreTokenField(field, token, weight) {
  if (!field || !token) return 0;
  if (wordsOf(field).some((w) => w.startsWith(token))) return weight;
  if (field.includes(token)) return weight;
  return 0;
}

function scoreTokenTags(tags, token) {
  let best = 0;
  for (const t of tags) best = Math.max(best, scoreTokenField(t, token, SCORE_TAG));
  return best;
}

function scoreEntry(entry, q, tokens) {
  const name = text(entry.id ?? entry.name);
  const desc = text(entry.description ?? entry.blurb ?? "");
  const tags = tagsOf(entry);
  let score = 0;
  // Raw-substring fallback (pre-tokenization behavior, kept verbatim:
  // covers cross-boundary spans like "l_co" that token words never catch).
  if (name && name.includes(q)) score += SCORE_NAME;
  if (tags.some((t) => t && t.includes(q))) score += SCORE_TAG;
  if (desc && desc.includes(q)) score += SCORE_DESCRIPTION;
  // Per-token path: skipped only when the query IS one token that already
  // matched raw, so legacy single-token scores are bit-identical.
  const singleHit = tokens.length === 1 && tokens[0] === q && score > 0;
  if (!singleHit) {
    for (const token of tokens) {
      score += scoreTokenField(name, token, SCORE_NAME);
      score += scoreTokenTags(tags, token);
      score += scoreTokenField(desc, token, SCORE_DESCRIPTION);
    }
  }
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
  const tokens = tokenize(q);
  if (!tokens.length) return { ok: false, reason: "bad_query" };
  const tools = resolveReader(opts.tools);
  const agents = resolveReader(opts.agents);
  if (!tools || !agents) return { ok: false, reason: "bad_reader" };
  let limit = opts.limit == null ? 25 : Number(opts.limit);
  if (!Number.isSafeInteger(limit) || limit < 1) return { ok: false, reason: "bad_limit" };
  limit = Math.min(limit, 100);

  const out = [];
  for (const entry of tools) {
    if (!entry || typeof entry !== "object") continue;
    const score = scoreEntry(entry, q, tokens);
    if (score > 0) {
      const id = String(entry.id ?? entry.name ?? "").trim();
      if (id) out.push({ kind: "tool", id, score, entry: { ...entry } });
    }
  }
  for (const entry of agents) {
    if (!entry || typeof entry !== "object") continue;
    const score = scoreEntry(entry, q, tokens);
    if (score > 0) {
      const id = String(entry.id ?? entry.name ?? "").trim();
      if (id) out.push({ kind: "agent", id, score, entry: { ...entry } });
    }
  }
  out.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { ok: true, results: out.slice(0, limit) };
}
