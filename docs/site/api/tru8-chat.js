/**
 * POST /api/tru8-chat
 * TRU8 product guide — SpaceXAI / xAI (OpenAI-compatible).
 * Env: XAI_API_KEY (server-side only). Model: grok-4.6
 * Public product facts only — no residual / production IP.
 */
import { withProductBox } from "./lib/spl-box-gate.js";

const XAI_BASE = "https://api.x.ai/v1";
const MODEL = process.env.XAI_MODEL || "grok-4.6";
const MAX_MSG = 1200;
const MAX_HISTORY = 8;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;

const hits = new Map(); // ip -> { n, t0 }

const SYSTEM = `You are the TRU8 product guide for Slid Phi Labs.
Product line: "Less is more. We dropped the E."
TRU8 is the only public compression product face for slidphilabs.com.

Public facts you MAY discuss:
- T_ZERO (0x00): dormant runs → 8 B unit. Example: 1_000_000 zeros → 8 B (125_000×). Frame hex 0040420f00000000.
- T_DICT (0x01): exact 1 KB block pointer → 8 B. 100 × 1 KB → 800 B (128×). Pointer stream, not compress().
- T_TRISUM_HOT (0x10): hot trigrams → 2 B definition + 1 B per hit. "the"×1000 = 1002 B from 3000 B (66.6% off). Token stream, not one byte total.
- ZRW / OmniWave / Silesia numbers are lab series on /standings, not TRU8 product claims. OmniWave does not beat brotli-11 on Silesia.
- T_SPARSE (0x03): residual path — licensed, do not invent coefficients.
- Public demos free with required credit: "Powered by TRU8 · Slid Phi Labs"
- Commercial residual / Continuous-1088 Strong: licensed. Contact corey@slidphilabs.com
- GitHub public demo: https://github.com/ceedot-rock/TRU8
- Site: https://www.slidphilabs.com/ · /demos · /license · /about
- Agents: GET https://www.slidphilabs.com/api/agent

Hard rules:
- Never invent private residual coefficients, packer internals, or production secrets.
- Never claim universal #1 compression. Domain-scoped outcomes only.
- Keep answers short, clear, number-forward. One idea at a time.
- If asked for production code/secrets: refuse and point to commercial license.
- You are powered by SpaceXAI (xAI Grok) — if asked about the AI stack, say SpaceXAI via xAI API.
- Tone: confident, minimal, residual-honest. No hype stacks.`;

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function clientIp(req) {
  const xf = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return xf || req.socket?.remoteAddress || "unknown";
}

function rateLimit(ip) {
  const now = Date.now();
  let row = hits.get(ip);
  if (!row || now - row.t0 > RATE_WINDOW_MS) {
    row = { n: 0, t0: now };
    hits.set(ip, row);
  }
  row.n += 1;
  return row.n <= RATE_MAX;
}

function cleanMsg(m) {
  if (!m || typeof m !== "object") return null;
  const role = m.role === "assistant" ? "assistant" : m.role === "user" ? "user" : null;
  if (!role) return null;
  const content = String(m.content || "")
    .trim()
    .slice(0, MAX_MSG);
  if (!content) return null;
  return { role, content };
}

async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method === "GET") {
    return json(res, 200, {
      ok: true,
      service: "tru8-chat",
      provider: "SpaceXAI",
      api: "xAI OpenAI-compatible",
      model: MODEL,
      base: XAI_BASE,
      endpoint: "POST /api/tru8-chat",
      body: { message: "string", history: "[{role,content}] optional" },
      note: "Public TRU8 product guide. Server-side XAI_API_KEY required.",
    });
  }

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "method_not_allowed" });
  }

  const key = process.env.XAI_API_KEY;
  if (!key) {
    return json(res, 503, {
      ok: false,
      error: "xai_unconfigured",
      message: "XAI_API_KEY not set on server",
    });
  }

  const ip = clientIp(req);
  if (!rateLimit(ip)) {
    return json(res, 429, { ok: false, error: "rate_limited", retry_after_s: 60 });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return json(res, 400, { ok: false, error: "invalid_json" });
    }
  }
  body = body || {};

  const message = String(body.message || body.prompt || "")
    .trim()
    .slice(0, MAX_MSG);
  if (!message) {
    return json(res, 400, { ok: false, error: "missing_message" });
  }

  const history = Array.isArray(body.history)
    ? body.history.map(cleanMsg).filter(Boolean).slice(-MAX_HISTORY)
    : [];

  const messages = [
    { role: "system", content: SYSTEM },
    ...history,
    { role: "user", content: message },
  ];

  try {
    // Chat Completions (OpenAI-compatible). Responses API available as fallback.
    let reply = null;
    let modelUsed = MODEL;
    let via = "chat.completions";

    const chatRes = await fetch(`${XAI_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.4,
        max_tokens: 700,
      }),
    });

    if (chatRes.ok) {
      const data = await chatRes.json();
      reply = data.choices?.[0]?.message?.content || null;
      modelUsed = data.model || MODEL;
    } else {
      via = "responses";
      const respRes = await fetch(`${XAI_BASE}/responses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          input: message,
          instructions: SYSTEM,
        }),
      });
      if (!respRes.ok) {
        const errText = await respRes.text();
        console.error("[tru8-chat] xai error", chatRes.status, errText.slice(0, 400));
        return json(res, 502, {
          ok: false,
          error: "xai_upstream",
          status: respRes.status || chatRes.status,
        });
      }
      const data = await respRes.json();
      reply =
        data.output_text ||
        (Array.isArray(data.output)
          ? data.output
              .flatMap((o) => o.content || [])
              .map((c) => c.text || c)
              .filter(Boolean)
              .join("")
          : null);
    }

    if (!reply) {
      return json(res, 502, { ok: false, error: "empty_reply" });
    }

    return json(res, 200, {
      ok: true,
      reply: String(reply).trim(),
      model: modelUsed,
      provider: "SpaceXAI",
      via,
      product: "TRU8",
    });
  } catch (e) {
    console.error("[tru8-chat]", e);
    return json(res, 500, { ok: false, error: "chat_failed", message: String(e.message || e) });
  }
}

export default withProductBox(handler, 'tru8');
