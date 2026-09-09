import { verifyWarrant } from "../lib/warrant.mjs";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Agent-Warrant");
}

function json(res, code, body) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export default function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  body = body || {};
  const token = String(req.headers["x-agent-warrant"] || body.warrant || body.token || "").trim();
  const out = verifyWarrant(token, { host: body.host, action: body.action });
  return json(res, out.ok ? 200 : 401, out.ok ? { valid: true, warrant: out.warrant } : { valid: false, reason: out.reason, warrant: out.warrant || null });
}
