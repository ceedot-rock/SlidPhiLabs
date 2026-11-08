/**
 * Tavily web search — the lab's default search provider for agentic surfaces.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Every customer-facing agent (MCP spl_research, hired runners, research
 * jobs) searches through here: one default, keyed by the TAVILY_API_KEY
 * environment secret, fail-closed when the key is absent. No key is ever
 * committed — set it in Fly secrets or Vercel project env.
 * Pure except through the injectable fetchFn (global fetch by default).
 */

export const TAVILY_VERSION = "0.1.0";
export const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
export const DEFAULT_MAX_RESULTS = 5;
export const MAX_MAX_RESULTS = 10;
export const DEFAULT_TIMEOUT_MS = 20000;
export const CONTEXT_CHARS = 4000;

function cleanString(v) {
  return v == null ? "" : String(v);
}

/** Resolve the key: explicit argument wins, then TAVILY_API_KEY. */
export function tavilyKey(explicit) {
  const e = cleanString(explicit).trim();
  if (e) return e;
  const env =
    typeof process !== "undefined" && process.env
      ? cleanString(process.env.TAVILY_API_KEY).trim()
      : "";
  return env || "";
}

function clampResults(v) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return DEFAULT_MAX_RESULTS;
  return Math.min(MAX_MAX_RESULTS, Math.max(1, n));
}

/**
 * Search the web. Returns { ok:true, query, depth, results[] } where each
 * result is { title, url, content, score?, published_date? }, or
 * { ok:false, error } with error one of: bad_query, tavily_unset,
 * network_failed, tavily_error (with status), bad_response.
 * Cost control: basic depth and no answer unless asked; max_results caps
 * at 10. Never throws on bad input.
 */
export async function searchTavily(opts = {}) {
  const query = cleanString(opts.query).trim();
  if (!query) return { ok: false, error: "bad_query" };
  const key = tavilyKey(opts.apiKey);
  if (!key) {
    return {
      ok: false,
      error: "tavily_unset",
      hint: "Set TAVILY_API_KEY in Fly secrets or Vercel project env. Tavily is the lab default — no fallback provider.",
    };
  }
  const depth = opts.search_depth === "advanced" ? "advanced" : "basic";
  const body = {
    query,
    search_depth: depth,
    max_results: clampResults(opts.max_results),
    ...(opts.include_answer === true ? { include_answer: true } : {}),
  };
  const fetchFn =
    typeof opts.fetchFn === "function"
      ? opts.fetchFn
      : typeof fetch === "function"
        ? fetch.bind(globalThis)
        : null;
  if (!fetchFn) return { ok: false, error: "network_failed" };
  const timeoutMs =
    Number.isFinite(Number(opts.timeoutMs)) && Number(opts.timeoutMs) > 0
      ? Math.floor(Number(opts.timeoutMs))
      : DEFAULT_TIMEOUT_MS;
  let res;
  try {
    res = await fetchFn(TAVILY_SEARCH_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { ok: false, error: "network_failed" };
  }
  if (!res.ok) return { ok: false, error: "tavily_error", status: res.status };
  let data = null;
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: "bad_response", status: res.status };
  }
  const raw = data && Array.isArray(data.results) ? data.results : null;
  if (!raw) return { ok: false, error: "bad_response", status: res.status };
  const results = raw.slice(0, clampResults(opts.max_results)).map((r) => ({
    title: cleanString(r && r.title).slice(0, 200),
    url: cleanString(r && r.url).slice(0, 500),
    content: cleanString(r && r.content).slice(0, 1500),
    ...(r && typeof r.score === "number" ? { score: r.score } : {}),
    ...(r && r.published_date ? { published_date: cleanString(r.published_date).slice(0, 40) } : {}),
  }));
  return {
    ok: true,
    query,
    depth,
    results,
    ...(data && typeof data.answer === "string" && data.answer ? { answer: data.answer.slice(0, 2000) } : {}),
  };
}

/**
 * One prompt-ready context block from a searchTavily success.
 * Numbered title + URL + excerpt lines, hard-capped at CONTEXT_CHARS
 * so model context stays bounded. Pass only ok:true results.
 */
export function formatContext(searched, maxChars = CONTEXT_CHARS) {
  if (!searched || searched.ok !== true || !Array.isArray(searched.results)) return "";
  const lines = ["Fresh web sources (Tavily default search):"];
  searched.results.forEach((r, i) => {
    lines.push(`${i + 1}. ${r.title || "untitled"} — ${r.url || "no url"}`);
    if (r.content) lines.push(`   ${r.content.slice(0, 400)}`);
  });
  const cap = Number.isFinite(Number(maxChars)) && Number(maxChars) > 0 ? Math.floor(Number(maxChars)) : CONTEXT_CHARS;
  return lines.join("\n").slice(0, cap);
}
