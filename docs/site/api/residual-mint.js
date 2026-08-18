/**
 * POST /api/residual-mint
 * Dual door. Suite meters 100 GB then 5¢/4¢. Chamber 24h then $9/$49/$490.
 */
import { withProductBox } from "./lib/spl-box-gate.js";

import { gateSuite, gateChamber, FREE_GB, CHAMBER, LICENSE, SUITE } from "./lib/residual_mint.js";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method === "GET") {
    return json(res, 200, {
      service: "residual_mint",
      doors: {
        suite: { free_gb: FREE_GB, then: "5¢ then 4¢", path: SUITE, not: "Not Chamber" },
        chamber: { trial_h: 24, plans: CHAMBER, path: LICENSE, not: "Not $199. Not Suite." },
      },
      post: { door: "suite|chamber", gb_used: 120.5, user_id: "…", plan: "year" },
    });
  }
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "POST" });
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  body = body && typeof body === "object" ? body : {};
  const door = String(body.door || "suite").toLowerCase();
  const userId = String(body.user_id || body.user || "anon").slice(0, 80);
  if (door === "chamber") {
    return json(res, 200, { ok: true, ...gateChamber(userId, body.trial_started_at, body.plan) });
  }
  return json(res, 200, { ok: true, ...gateSuite(body.gb_used ?? body.gb, userId) });
}

export default withProductBox(handler, 'tru8');
