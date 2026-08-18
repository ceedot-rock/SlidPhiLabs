/**
 * Proxy /api/sios and /api/sios/* to the Fly SiOS runtime.
 */
import { withProductBox } from "./lib/spl-box-gate.js";

const UP = (process.env.SIOS_URL || "https://slidphi-sios.fly.dev").replace(/\/+$/, "");

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
}

function destOf(req) {
  const raw = String(req.url || "/api/sios");
  let pathname = raw;
  let search = "";
  const q = raw.indexOf("?");
  if (q >= 0) {
    pathname = raw.slice(0, q);
    search = raw.slice(q);
  }
  if (pathname === "/api/sios" || pathname === "/api/sios/") {
    return `${UP}/api/sios${search}`;
  }
  const tail = pathname.replace(/^\/api\/sios/, "") || "/";
  return `${UP}${tail}${search}`;
}

async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  try {
    const dest = destOf(req);
    const init = {
      method: req.method,
      headers: { Accept: req.headers.accept || "*/*", "User-Agent": "slidphilabs-proxy" },
    };
    if (req.method === "POST" && req.body != null) {
      init.headers["Content-Type"] = "application/json";
      init.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    }
    const r = await fetch(dest, init);
    const buf = Buffer.from(await r.arrayBuffer());
    res.statusCode = r.status;
    res.setHeader("Content-Type", r.headers.get("content-type") || "application/json; charset=utf-8");
    res.setHeader("X-SiOS-Upstream", dest);
    return res.end(buf);
  } catch (e) {
    const { report, tick, headers } = await import("../lib/sios.mjs");
    for (const [k, v] of Object.entries(headers())) res.setHeader(k, v);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    if (req.method === "POST") return res.end(JSON.stringify(tick({ ok: true, path: "api" })));
    return res.end(JSON.stringify(report()));
  }
}

export default withProductBox(handler, 'lab');
