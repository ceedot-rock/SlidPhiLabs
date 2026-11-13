/**
 * POST /v1/seal and POST /api/seal. Chamber library seal.
 * No per-seal price. Anonymous callers get 402 until a key or claim.
 * Seats stay chamber-month and chamber-year. Open stays free.
 */
import { sealEnvelope } from "./lib/chamber-seal.mjs";
import { applyClaimSeat, claimAuthError } from "./lib/claim-seat.mjs";
import { toolGate } from "./lib/tool-gate.mjs";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
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

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method === "GET") {
    return json(res, 200, {
      ok: true,
      product: "chamber",
      verb: "seal",
      open: "POST /v1/open",
      metered: "POST /v1/chamber-seal",
      seats: ["chamber-month", "chamber-year"],
      note: "This door adds no per-seal price. Open is free. Anonymous HTTP gets 402 until a key or claim.",
    });
  }
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "POST only" });

  const seat = applyClaimSeat(req);
  if (!seat.ok && seat.tokenPresent) return json(res, 401, claimAuthError(seat.reason));
  if (!toolGate(req, seat).ok) {
    return json(res, 402, {
      ok: false,
      error: "tool_called_only",
      seats: ["chamber-month", "chamber-year"],
      metered: "POST /v1/chamber-seal",
      message: "Chamber seal runs through a tool or a seat key. Open stays free. This door adds no per-seal price.",
    });
  }

  const body = bodyOf(req);
  let obj = body.obj != null ? body.obj : body.payload;
  if (typeof obj === "string") {
    try {
      obj = JSON.parse(obj);
    } catch {
      return json(res, 400, { ok: false, error: "seal_refused" });
    }
  }
  const keyHex = String(body.key_hex || body.keyHex || "");
  const envelope = sealEnvelope(obj, { keyHex });
  if (!envelope) return json(res, 400, { ok: false, error: "seal_refused" });
  return json(res, 200, { ok: true, envelope });
}
