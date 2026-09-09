import { fileReceipt } from "../lib/warrant.mjs";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Agent-Rider, X-Agent-Warrant, X-Spl-Seat");
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
  const paid = String(req.headers["x-spl-seat"] || "").startsWith("warrant");
  const out = fileReceipt({
    token,
    action: body.action,
    host: body.host,
    usd: body.usd,
    request_sha256: body.request_sha256,
    result_sha256: body.result_sha256,
    note: body.note,
    paid,
  });
  if (!out.ok) {
    const code = out.reason === "free_receipt_cap" ? 402 : out.reason === "missing_warrant" || out.reason === "bad_signature" ? 401 : 400;
    return json(res, code, { error: out.reason, ...out });
  }
  return json(res, 201, { ok: true, receipt: out.receipt, warrant: out.warrant });
}
