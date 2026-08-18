/**
 * POST /api/trugame/:cell
 * OFA is ready. Other cells: 503 no_tg8 (agents stay in GAO).
 */
import { withProductBox } from "./lib/spl-box-gate.js";

import ofa from "./trugame/ofa.js";

const CELLS = new Set(["ofa", "ofl", "arl", "phl", "blb", "pbl", "earth", "boxing", "gao"]);
const TG8_READY = new Set(["ofa"]);

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
}

function json(res, code, body) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function cellOf(req) {
  const p = String(req.url || "").split("?")[0];
  const parts = p.replace(/\/$/, "").split("/").filter(Boolean);
  return (parts[parts.length - 1] || "").toLowerCase();
}

async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  const cell = cellOf(req);
  if (cell === "trugame" || !cell) {
    return json(res, 200, {
      ok: true,
      door: "/api/trugame/:cell",
      ready: [...TG8_READY],
      known: [...CELLS],
      ofa: "https://www.slidphilabs.com/api/trugame/ofa",
      gao: "https://www.slidphilabs.com/api/olympiad",
    });
  }
  if (!CELLS.has(cell)) {
    return json(res, 404, { ok: false, error: "unknown_cell", cell });
  }
  if (cell === "ofa") return ofa(req, res);
  if (cell === "gao") {
    return json(res, 200, {
      ok: true,
      cell: "gao",
      engine: "gao",
      format: "trugame-tg8",
      identity: true,
      play: "https://www.slidphilabs.com/api/olympiad",
    });
  }
  return json(res, 503, {
    ok: false,
    error: "no_tg8",
    cell,
    hint: "agents stay in GAO until this cell seals TG8",
    gao: "https://www.slidphilabs.com/api/olympiad",
    ofa: "https://www.slidphilabs.com/api/trugame/ofa",
  });
}

export default withProductBox(handler, 'trugame');
