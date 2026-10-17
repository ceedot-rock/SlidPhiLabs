/**
 * Tool gate: hosted compression runs only when called through a tool.
 *
 * A call counts as tool-called when it carries a machine credential:
 * - a valid x402 claim (spl1.…) -> via "claim" (verified, seat stamped)
 * - any other Authorization Bearer token or X-API-Key value -> via "key"
 *   (marks a machine caller: CLI apiKey, SDK, script, agent key; only
 *   claims are cryptographically verified)
 * - MCP tool calls run in-process and never reach this HTTP check; they
 *   are tools by construction.
 *
 * No credential -> { ok:false }; the endpoint answers 402 (pay or key),
 * never silent free-tier. A malformed/expired spl1 claim keeps its
 * existing 401 via claim-seat (checked first by the caller), and
 * spl1-looking Bearers are refused here so they cannot launder
 * into via-key.
 */
import { seatFromClaimHeader } from "./claim-seat.mjs";

const KEY_RE = /^(Bearer\s+\S{8,}|[\w\-.~+/=]{8,})$/;

export function toolGate(req, seat) {
  const s = seat || seatFromClaimHeader(req);
  if (s.ok) return { ok: true, via: "claim", sku: s.sku, seatId: s.seatId };
  const h = (req && req.headers) || {};
  const auth = String(h.authorization || h.Authorization || "").trim();
  const apiKey = String(h["x-api-key"] || h["X-API-Key"] || "").trim();
  // spl1-looking tokens always stay on the claim path (401 there on failure);
  // they must never launder into via-key here.
  if (/^Bearer\s+spl1\./i.test(auth)) return { ok: false, reason: "claim_path" };
  if ((auth && KEY_RE.test(auth)) || (apiKey && KEY_RE.test(apiKey))) {
    return { ok: true, via: "key" };
  }
  return { ok: false, reason: "no_tool_credential" };
}

/** 402 body for anonymous (non-tool) calls to hosted compression. */
export function toolOnly402() {
  return {
    ok: false,
    error: "tool_called_only",
    message:
      "Hosted compression runs through tools, not browser uploads. " +
      "Call via MCP (POST /mcp, spl_compress), the API with a key " +
      "(Authorization: Bearer <key> or X-API-Key, CLI: apiKey), or buy a " +
      "seat: POST /api/x402-products {\"sku\":\"gc-day\"}.",
  };
}
