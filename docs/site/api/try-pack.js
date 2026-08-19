/**
 * GET/POST /api/try-pack?product=chamber|tru8|gate|lab
 * Opens the 24h box (POST) and downloads a runnable try pack.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { admit, inspect, BUY } from "./lib/spl-box-gate.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "packs");
const MAP = {
  chamber: "chamber-24h",
  tru8: "tru8-24h",
  gate: "gate-24h",
  lab: "tru8-24h",
};

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-spl-box");
}

function packOf(product) {
  const dir = join(ROOT, MAP[product] || "");
  if (!existsSync(dir)) return null;
  const files = {};
  for (const name of readdirSync(dir)) {
    files[name] = readFileSync(join(dir, name), "utf8");
  }
  return files;
}

export default function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  const url = new URL(req.url || "/", "http://localhost");
  let product = String(url.searchParams.get("product") || "tru8").toLowerCase();
  if (req.method === "POST" && req.body && typeof req.body === "object") {
    product = String(req.body.product || product).toLowerCase();
  }
  if (!MAP[product]) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: "unknown_product", products: Object.keys(MAP) }));
  }

  const g = req.method === "GET" ? inspect(req) : admit(req, res, product);
  if (req.method !== "GET" && !g.ok) return;
  if (req.method === "GET" && !g.ok) {
    res.statusCode = 402;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, ...g, buy: BUY, hint: "POST /api/try-pack?product=" + product + " to open the 24h box, then download." }));
  }

  const files = packOf(product);
  const body = {
    protocol: "splb-ed25519-24h",
    product,
    box_open: g.ok !== false,
    hours_left: g.hours_left,
    credit: "Powered by TRU8 · Slid Phi Labs",
    expires_note: "24 hours from first open. Then buy the seat.",
    buy: BUY,
    files,
  };
  const name = `spl-${product}-24h.json`;
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
  res.end(JSON.stringify(body, null, 2));
}
