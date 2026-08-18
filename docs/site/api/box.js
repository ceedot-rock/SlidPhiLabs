/**
 * GET /api/box — black-box status for every product door.
 */
import { inspect, admit, PROTOCOL, BUY } from "./lib/spl-box-gate.js";

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-spl-box, x-spl-seat, x-spl-seat-id, x-spl-seat-sig");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method === "POST") {
    const g = admit(req, res, "lab");
    if (!g.ok) return;
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ ok: true, ...g, buy: BUY }));
  }
  const g = inspect(req);
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("x-spl-protocol", PROTOCOL);
  res.end(JSON.stringify({ ok: g.ok, ...g, buy: BUY }));
}
