/**
 * GET /api/suite-folder — list SPL Pay Per Suite on-site data folder
 * Static samples live under /suite-folder/ (served as static files).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST = path.join(__dirname, "..", "suite-folder", "manifest.json");

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=60");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: "method_not_allowed" }));
  }
  try {
    const raw = fs.readFileSync(MANIFEST, "utf8");
    const man = JSON.parse(raw);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        ok: true,
        product: "SPL Pay Per Suite",
        host: "site",
        path: "/pps#suiteFolder",
        law: "encode · decode · download · recompress — stays on the site",
        ...man,
      }),
    );
  } catch (e) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
  }
}
