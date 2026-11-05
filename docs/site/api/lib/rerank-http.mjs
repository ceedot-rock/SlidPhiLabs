/**
 * Production HTTP rerank adapter — compressor 0.2 default second stage.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Endpoint (Modal app `rerank-svc`, weights /hf-cache/minilm-ft):
 *   https://cortasz86--rerank-svc-fastapi-app.us-east.modal.run
 *   POST { query, docs: [{ id, text }], top_k } -> [{ id, score }] desc.
 *   Auth: `Authorization: Bearer <token>` (Modal Secret `rerank-auth`).
 *
 * Operator env (read at call time, never at import):
 *   RERANK_ENDPOINT   Full endpoint URL. UNSET by default: the offline
 *                     BM25-only default is unchanged, unit tests never touch
 *                     the network. Set it in production to enable reranking.
 *   RERANK_TOKEN      Bearer token (matches Modal Secret `rerank-auth` key
 *                     RERANK_TOKEN). Missing token degrades to BM25 fallback.
 *   RERANK_TIMEOUT_MS Per-request timeout, default 8000. Any timeout, network
 *                     error, non-2xx status, or malformed body falls back to
 *                     the stage-1 BM25 scores — the adapter never throws and
 *                     never returns malformed scores.
 *
 * Wiring: agentic-platform run/dispatch use defaultProductionRerankFn() as
 * the lowest-priority rerankFn (explicit spec/adapters injection still wins;
 * plan previews stay offline). Tests inject mock adapters or a mock
 * fetchImpl here — never the network.
 */

/** Deployed production endpoint. Set RERANK_ENDPOINT to this URL to enable. */
export const RERANK_ENDPOINT_URL =
  "https://cortasz86--rerank-svc-fastapi-app.us-east.modal.run";
export const RERANK_ENV_ENDPOINT = "RERANK_ENDPOINT";
export const RERANK_ENV_TOKEN = "RERANK_TOKEN";
export const RERANK_ENV_TIMEOUT_MS = "RERANK_TIMEOUT_MS";
export const RERANK_TIMEOUT_MS_DEFAULT = 8000;

/** Read operator config from env (defaults to process.env). Pure. */
export function rerankEnv({ env = process.env } = {}) {
  const src = env || {};
  const endpoint = String(src[RERANK_ENV_ENDPOINT] || "").trim();
  const token = String(src[RERANK_ENV_TOKEN] || "");
  const rawMs = Number(src[RERANK_ENV_TIMEOUT_MS]);
  const timeoutMs =
    Number.isFinite(rawMs) && rawMs > 0 ? Math.floor(rawMs) : RERANK_TIMEOUT_MS_DEFAULT;
  return { endpoint, token, timeoutMs };
}

/**
 * Build an async rerankFn adapter ({ query, chunks, scores } => scores).
 * Sends every candidate (top_k = chunks.length) so the endpoint scores the
 * full second-stage set; returned scores are aligned back to chunk order by
 * id, missing ids keep their BM25 score, unknown ids are ignored. ANY
 * failure resolves to a copy of the input BM25 scores.
 */
export function createHttpRerankFn({
  endpoint = "",
  token = "",
  timeoutMs = RERANK_TIMEOUT_MS_DEFAULT,
  fetchImpl = globalThis.fetch,
} = {}) {
  const url = String(endpoint || "").trim();
  const ms = Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0
    ? Math.floor(Number(timeoutMs))
    : RERANK_TIMEOUT_MS_DEFAULT;
  return async function httpRerankFn({ query, chunks, scores } = {}) {
    const list = Array.isArray(chunks) ? chunks : [];
    const base = Array.isArray(scores) ? [...scores] : list.map(() => 0);
    const fallback = () => [...base];
    try {
      if (!url || list.length === 0 || typeof fetchImpl !== "function") return fallback();
      const docs = list.map((c) => ({ id: c?.id ?? c?.i, text: String(c?.text ?? "") }));
      const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      let timer = null;
      const timeoutP = new Promise((_, reject) => {
        timer = setTimeout(() => {
          try { ctrl?.abort(); } catch { /* ignore */ }
          reject(new Error("rerank_timeout"));
        }, ms);
        if (timer && typeof timer.unref === "function") timer.unref();
      });
      let res = null;
      try {
        res = await Promise.race([
          fetchImpl(url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(token ? { authorization: "Bearer " + token } : {}),
            },
            body: JSON.stringify({ query: String(query ?? ""), docs, top_k: docs.length }),
            ...(ctrl ? { signal: ctrl.signal } : {}),
          }),
          timeoutP,
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
      if (!res || res.ok === false) return fallback();
      if (typeof res.status === "number" && (res.status < 200 || res.status >= 300)) {
        return fallback();
      }
      if (!res || typeof res.json !== "function") return fallback();
      const data = await res.json();
      if (!Array.isArray(data)) return fallback();
      const byId = new Map();
      for (const e of data) {
        if (!e || typeof e !== "object") continue;
        if ((typeof e.id !== "string" && typeof e.id !== "number") ||
          typeof e.score !== "number" || !Number.isFinite(e.score)) continue;
        byId.set(String(e.id), e.score);
      }
      return list.map((c, k) => {
        const v = byId.get(String(c?.id ?? c?.i));
        return typeof v === "number" ? v : base[k];
      });
    } catch {
      return fallback();
    }
  };
}

/**
 * Default production adapter: an HTTP rerankFn when RERANK_ENDPOINT is set,
 * else null (offline BM25-only default — plan/tests stay network-free).
 * fetchImpl override exists for tests; production omits it (global fetch).
 */
export function defaultProductionRerankFn({ env = process.env, fetchImpl } = {}) {
  const { endpoint, token, timeoutMs } = rerankEnv({ env });
  if (!endpoint) return null;
  return createHttpRerankFn({
    endpoint,
    token,
    timeoutMs,
    ...(fetchImpl ? { fetchImpl } : {}),
  });
}
