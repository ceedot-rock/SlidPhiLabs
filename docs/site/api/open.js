/**
 * POST /v1/open and POST /api/open. Chamber open. Free once both keys meet.
 */
import { openEnvelope } from "./lib/chamber-seal.mjs";

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

function bodyOf(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body && typeof body === "object" && !Buffer.isBuffer(body) ? body : {};
}

export default function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method === "GET") {
    return json(res, 200, {
      ok: true,
      product: "chamber",
      verb: "open",
      price: "0",
      seal: "POST /v1/seal",
      note: "Open is free once both keys meet.",
    });
  }
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "POST only" });
  const body = bodyOf(req);
  const keyHex = String(body.key_hex || body.keyHex || "");
  const out = openEnvelope(body.envelope, { keyHex });
  return json(res, out.ok ? 200 : 400, out);
}
