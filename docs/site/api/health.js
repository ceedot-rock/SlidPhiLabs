/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * GET /api/health — the authoritative health surface (LAB50 step 8).
 *
 * Contract: 200 { ok:true, at, stages:[...] } when every stage passes,
 * 503 { ok:false, at, stages:[...] } otherwise. Stages come from the shared
 * network-health checker (ledger-volume writable + digest fixture). Monitors
 * and pages must read this route, not hand-edited badges.
 */
import { createHealthChecker } from "./lib/network-health.mjs";

export function statusForHealth(result) {
  return result && result.ok === true ? 200 : 503;
}

const checker = createHealthChecker();

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "get_only" });
  const snap = await checker.check();
  return json(res, statusForHealth(snap), {
    ok: snap.ok === true,
    at: new Date().toISOString(),
    stages: snap.stages || [],
  });
}
