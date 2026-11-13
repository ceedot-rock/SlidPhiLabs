/**
 * POST /v1/research and POST /api/research. Same search as spl_research.
 * No per-call SKU. Refuses when TAVILY_API_KEY is unset.
 */
import { searchTavily } from "./lib/tavily.mjs";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "POST only" });
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  body = body && typeof body === "object" ? body : {};
  const out = await searchTavily({
    query: body.query,
    max_results: body.max_results,
    search_depth: body.search_depth,
    include_answer: body.include_answer,
  });
  const status = out.ok ? 200 : out.error === "bad_query" ? 400 : out.error === "tavily_error" ? 502 : 503;
  return json(res, status, out);
}
