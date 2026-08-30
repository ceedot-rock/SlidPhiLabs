/**
 * POST { action: "signup"|"login", email, password, name? }
 * GET  Authorization: Bearer  → { user }
 */
import { cors, signup, login, meFromAuth } from "./lib/lab-auth.mjs";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method === "GET") {
    const user = meFromAuth(req.headers.authorization);
    if (!user) return json(res, 401, { ok: false, error: "need_login" });
    return json(res, 200, { ok: true, user });
  }
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "method" });
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  body = body || {};
  const action = String(body.action || "login");
  try {
    if (action === "signup") {
      const out = signup(body);
      if (out.error) return json(res, out.status || 400, { ok: false, error: out.error });
      return json(res, 201, { ok: true, ...out });
    }
    const out = login(body);
    if (out.error) return json(res, out.status || 401, { ok: false, error: out.error });
    return json(res, 200, { ok: true, ...out });
  } catch (e) {
    return json(res, 500, { ok: false, error: "auth_failed" });
  }
}
