/**
 * GET /api/duos — latest dual-surface secret-shopper report
 * POST /api/duos — re-run shopper (optional DUOS_TOKEN)
 * Also: GET /api/duos?surface=web|agent
 */
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { attachNca, ncaHeaders } from "./lib/nca_infra.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const LATEST = path.join(ROOT, "data", "duos-latest.json");
const PUB = path.join(ROOT, "duos-latest.json");

function loadLatest() {
  for (const p of [LATEST, PUB]) {
    try {
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
    } catch {
      /* */
    }
  }
  return null;
}

function send(res, code, obj, point = "duos") {
  const payload =
    obj && typeof obj === "object"
      ? attachNca(
          { ...obj },
          point,
          {
            ok: obj.ok !== false,
            score: obj.overall?.score ?? obj.grade?.score,
            soft: obj.overall?.soft,
            fail: obj.overall?.fail,
          }
        )
      : obj;
  const body = JSON.stringify(payload, null, 2);
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  for (const [k, v] of Object.entries(ncaHeaders())) res.setHeader(k, v);
  res.end(body);
}

export default async function handler(req, res) {
  const url = new URL(req.url || "/", "http://x");
  const method = (req.method || "GET").toUpperCase();

  if (method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Duos-Token");
    return res.end();
  }

  if (method === "GET") {
    const report = loadLatest();
    if (!report) {
      return send(res, 404, {
        ok: false,
        error: "no report yet — POST /api/duos to run shopper or run scripts/duos-shopper.mjs",
        path: "/duos",
      });
    }
    const surface = url.searchParams.get("surface");
    if (surface === "web" || surface === "agent") {
      return send(res, 200, {
        ok: true,
        surface,
        at: report.at,
        base: report.base,
        grade: report.surfaces?.[surface],
        summary: report.summary?.[surface],
        findings: report.surfaces?.[surface]?.findings || [],
      });
    }
    if (url.searchParams.get("summary") === "1") {
      return send(res, 200, {
        ok: true,
        at: report.at,
        base: report.base,
        overall: report.overall,
        summary: report.summary,
        top_issues: report.top_issues?.slice(0, 20) || [],
        next_moves: report.next_moves || [],
      });
    }
    return send(res, 200, report);
  }

  if (method === "POST") {
    const token = process.env.DUOS_TOKEN || "";
    const got = req.headers["x-duos-token"] || url.searchParams.get("token") || "";
    if (token && got !== token) {
      return send(res, 401, { ok: false, error: "unauthorized" });
    }
    try {
      const modPath = path.join(ROOT, "scripts", "duos-shopper.mjs");
      const mod = await import(pathToFileURL(modPath).href + "?t=" + Date.now());
      const base =
        process.env.DUOS_BASE ||
        process.env.BASE ||
        `${url.protocol}//${req.headers.host || "www.slidphilabs.com"}`.replace(
          /\/$/,
          ""
        );
      // Prefer public host when behind fly
      const runBase =
        process.env.DUOS_BASE ||
        process.env.PUBLIC_BASE ||
        "https://www.slidphilabs.com";
      const report = await mod.runDuos({ base: runBase });
      fs.mkdirSync(path.dirname(LATEST), { recursive: true });
      fs.writeFileSync(LATEST, JSON.stringify(report, null, 2) + "\n");
      fs.writeFileSync(PUB, JSON.stringify(report, null, 2) + "\n");
      return send(res, 200, {
        ok: true,
        ran: true,
        summary: report.summary,
        overall: report.overall,
        top_issues: report.top_issues?.slice(0, 15),
        report_path: "/duos-latest.json",
        ui: "/duos",
      });
    } catch (e) {
      return send(res, 500, { ok: false, error: String(e.message || e) });
    }
  }

  return send(res, 405, { ok: false, error: "method not allowed" });
}
