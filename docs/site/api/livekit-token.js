/**
 * POST /api/livekit-token
 * Voice-agent join tokens for the LiveKit room backing the TRU8 guide.
 * Env (server-side only): LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET.
 * Until those exist the endpoint reports stub status (503 livekit_unconfigured)
 * instead of inventing credentials. Tokens are dependency-free HS256 JWTs in
 * the LiveKit AccessToken shape: join+publish+subscribe on one room, 6h TTL.
 * Public surface only — no keys, no guide internals.
 */

import crypto from "node:crypto";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;
const TOKEN_TTL_S = 6 * 3600;
const MAX_NAME = 64;

const hits = new Map(); // ip -> { n, t0 }

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

function cleanName(v, fallback) {
  const s = String(v || fallback || "")
    .trim()
    .slice(0, MAX_NAME);
  if (!s) return fallback;
  // LiveKit-safe: letters, digits, dash, underscore, dot, @.
  if (!/^[\w.@-]+$/.test(s)) return null;
  return s;
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function mintToken({ apiKey, apiSecret, identity, room, ttlS }) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      iss: apiKey,
      sub: identity,
      iat: now,
      nbf: now,
      exp: now + ttlS,
      video: {
        roomJoin: true,
        room,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
    })
  );
  const sig = b64url(
    crypto.createHmac("sha256", apiSecret).update(`${header}.${payload}`).digest()
  );
  return `${header}.${payload}.${sig}`;
}

async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const livekitUrl = process.env.LIVEKIT_URL || "";
  const apiKey = process.env.LIVEKIT_API_KEY || "";
  const apiSecret = process.env.LIVEKIT_API_SECRET || "";
  const configured = Boolean(livekitUrl && apiKey && apiSecret);

  if (req.method === "GET") {
    return json(res, 200, {
      ok: true,
      service: "livekit-token",
      endpoint: "POST /api/livekit-token",
      body: { identity: "string", room: "string optional" },
      status: configured ? "live" : "unconfigured",
      note: configured
        ? "Mints voice-agent join tokens."
        : "LiveKit not claimed yet — stub status until LIVEKIT_* env is set.",
    });
  }

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "method_not_allowed" });
  }

  if (!configured) {
    return json(res, 503, {
      ok: false,
      error: "livekit_unconfigured",
      message: "LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET not set on server",
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

  const identity = cleanName(body.identity, `guest-${ip.replace(/[^0-9a-z]/gi, "").slice(0, 8) || "anon"}`);
  const room = cleanName(body.room, "tru8-guide");
  if (!identity || !room) {
    return json(res, 400, { ok: false, error: "bad_name" });
  }

  const token = mintToken({ apiKey, apiSecret, identity, room, ttlS: TOKEN_TTL_S });
  return json(res, 200, {
    ok: true,
    token,
    url: livekitUrl,
    identity,
    room,
    expires_in_s: TOKEN_TTL_S,
  });
}

export default handler;
