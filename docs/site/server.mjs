#!/usr/bin/env node
/**
 * Fly.io host for Slid Phi Labs public site
 * Static files + Vercel-style /api/*.js handlers (default export).
 * Replaces Vercel when that account is DEPLOYMENT_DISABLED.
 */
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { attachNca, ncaBindApp, ncaHeaders, ncaReport } from "./lib/nca_infra.mjs";
import { bootRest, fromRest, fromRestGzip } from "./lib/phi_rest.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "0.0.0.0";
ncaBindApp(process.env.FLY_APP_NAME || "slidphilabs");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".yaml": "text/yaml; charset=utf-8",
  ".yml": "text/yaml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".map": "application/json",
  ".woff2": "font/woff2",
};

/** Clean URL / rewrite map (mirrors vercel.json essentials) */
const REWRITES = {
  "/": "/index.html",
  "/phone": "/phone.html",
  "/phone/": "/phone.html",
  "/join": "/join.html",
  "/join/": "/join.html",
  "/join-the-work": "/join.html",
  "/join-the-work/": "/join.html",
  "/humans": "/humans/index.html",
  "/humans/": "/humans/index.html",
  "/agents": "/agents/index.html",
  "/agents/": "/agents/index.html",
  "/access": "/access/index.html",
  "/access/": "/access/index.html",
  "/demos": "/demos.html",
  "/demos/": "/demos.html",
  "/license": "/license.html",
  "/license/": "/license.html",
  "/about": "/about.html",
  "/about/": "/about.html",
  "/chamber": "/chamber.html",
  "/chamber/": "/chamber.html",
  "/sios": "/sios.html",
  "/sios/": "/sios.html",
  "/si-os": "/sios.html",
  "/si-os/": "/sios.html",
  "/synthetic": "/sios.html",
  "/synthetic/": "/sios.html",
  "/tru8": "/index.html",
  "/tru8/": "/index.html",
  "/bench": "/bench/index.html",
  "/bench/": "/bench/index.html",
  "/bench.html": "/bench/index.html",
  "/duos": "/duos.html",
  "/duos/": "/duos.html",
  "/duosurface": "/duos.html",
  "/duosurface/": "/duos.html",
  "/pps": "/pps/index.html",
  "/pps/": "/pps/index.html",
  "/games": "/games/index.html",
  "/games/": "/games/index.html",
  "/products": "/products.html",
  "/products/": "/products.html",
  "/olympiad": "/olympiad.html",
  "/olympiad/": "/olympiad.html",
  "/toys": "/toys.html",
  "/toys/": "/toys.html",
  "/updates": "/updates/index.html",
  "/updates/": "/updates/index.html",
  "/blog": "/blog/index.html",
  "/blog/": "/blog/index.html",
  "/standings": "/standings.html",
  "/standings/": "/standings.html",
  "/stand": "/standings.html",
  "/stand/": "/standings.html",
  "/stand.html": "/standings.html",
  "/codex": "/codex.html",
  "/codex/": "/codex.html",
  "/codex.json": "/lab/DIVINE_CODEX.json",
  "/divine-codex": "/codex.html",
  "/divine-codex/": "/codex.html",
  "/codex/history": "/lab/CODEX_KEY_HISTORY.json",
  "/codex/key": "/lab/CODEX_KEY_HISTORY.json",
  "/codex/release": "/lab/CODEX_RELEASE.md",
  "/the-word": "/lab/THE_CODEX_IS_THE_WORD.md",
  "/essence": "/lab/ESSENCE_EIGHTH_FOREVER.json",
  "/essence/": "/lab/ESSENCE_EIGHTH_FOREVER.json",
  "/essence/eighth": "/lab/ESSENCE_EIGHTH_FOREVER.json",
  "/grace": "/lab/ESSENCE_GUIDE_HUMANITY.json",
  "/web": "/web.html",
  "/web/": "/web.html",
  "/truth": "/truth.html",
  "/truth/": "/truth.html",
  "/ideas": "/ideas.html",
  "/ideas/": "/ideas.html",
  "/datacenters": "/datacenters.html",
  "/datacenters/": "/datacenters.html",
  "/try": "/pps/index.html",
  "/try/": "/pps/index.html",
  "/pay": "/pay.html",
  "/pay/": "/pay.html",
  "/payments": "/pay.html",
  "/payments/": "/pay.html",
};

function safeJoin(root, rel) {
  const p = path.normalize(path.join(root, rel));
  if (!p.startsWith(root)) return null;
  return p;
}

function sendFile(res, filePath, req) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  const rested = fromRest(filePath);
  const wantsGz = /\bgzip\b/.test(String(req?.headers?.["accept-encoding"] || ""));
  const gz = wantsGz && !String(req?.headers?.range || "") ? fromRestGzip(filePath) : null;
  const data = gz || rested || fs.readFileSync(filePath);
  const total = data.length;
  const cache = ext === ".html" ? "public, max-age=60" : "public, max-age=3600";
  const via = gz ? "open-gzip" : rested ? "open" : "disk";
  const range = String(req?.headers?.range || "");
  const m = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (m && (m[1] !== "" || m[2] !== "")) {
    const start = m[1] === "" ? Math.max(0, total - Number(m[2])) : Math.min(Number(m[1]), total);
    const end = m[2] === "" ? total - 1 : Math.min(Number(m[2]), total - 1);
    if (start <= end && start < total) {
      const slice = data.subarray(start, end + 1);
      res.writeHead(206, {
        "Content-Type": type,
        "Content-Length": slice.length,
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": cache,
        "X-Host": "fly-slidphilabs",
        "X-Phi-Rest": via,
      });
      res.end(slice);
      return;
    }
  }
  const headers = {
    "Content-Type": type,
    "Content-Length": total,
    "Accept-Ranges": "bytes",
    "Cache-Control": cache,
    "X-Host": "fly-slidphilabs",
    "X-Phi-Rest": via,
    Vary: "Accept-Encoding",
  };
  if (gz) headers["Content-Encoding"] = "gzip";
  res.writeHead(200, headers);
  res.end(data);
}

function notFound(res, msg = "not found") {
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: msg }));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

function makeRes(nodeRes) {
  const r = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
      try { nodeRes.setHeader(k, v); } catch { /* */ }
    },
    getHeader(k) {
      return this.headers[k] || nodeRes.getHeader(k);
    },
    end(body) {
      if (!nodeRes.headersSent) {
        nodeRes.statusCode = this.statusCode || 200;
        for (const [k, v] of Object.entries(this.headers)) {
          try { nodeRes.setHeader(k, v); } catch { /* */ }
        }
      }
      if (body === undefined || body === null) nodeRes.end();
      else if (Buffer.isBuffer(body)) nodeRes.end(body);
      else if (typeof body === "object") {
        if (!nodeRes.getHeader("Content-Type")) {
          nodeRes.setHeader("Content-Type", "application/json; charset=utf-8");
        }
        nodeRes.end(JSON.stringify(body));
      } else nodeRes.end(String(body));
    },
    status(code) {
      this.statusCode = code;
      nodeRes.statusCode = code;
      return this;
    },
    json(obj) {
      this.setHeader("Content-Type", "application/json; charset=utf-8");
      this.end(JSON.stringify(obj));
    },
  };
  return r;
}

const handlerCache = new Map();

async function loadApiHandler(apiPath) {
  let rel = apiPath.replace(/^\/api\/?/, "");
  if (!rel) return null;
  const candidates = [
    path.join(ROOT, "api", rel + ".js"),
    path.join(ROOT, "api", rel, "index.js"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && c.startsWith(path.join(ROOT, "api"))) {
      const key = c;
      if (!handlerCache.has(key)) {
        const mod = await import(pathToFileURL(c).href + `?t=${Date.now()}`);
        handlerCache.set(key, mod.default || mod.handler);
      }
      return handlerCache.get(key);
    }
  }
  return null;
}

async function handleApi(req, res, url) {
  const handler = await loadApiHandler(url.pathname);
  if (!handler) {
    notFound(res, "api_not_found");
    return;
  }
  const raw = await readBody(req);
  let body = undefined;
  const ct = String(req.headers["content-type"] || "");
  if (raw.length && ct.includes("application/json")) {
    try { body = JSON.parse(raw.toString("utf8") || "{}"); } catch { body = {}; }
  } else if (raw.length) {
    body = raw;
  }
  const query = Object.fromEntries(url.searchParams.entries());
  const vercelReq = Object.assign(req, { query, body, url: url.pathname + url.search });
  const vercelRes = makeRes(res);
  try {
    await handler(vercelReq, vercelRes);
    if (!res.writableEnded && !res.headersSent) vercelRes.end();
  } catch (e) {
    console.error("[api]", url.pathname, e);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
    }
  }
}

function resolveStatic(pathname) {
  let p = pathname.split("?")[0];
  if (REWRITES[p]) p = REWRITES[p];
  let file = safeJoin(ROOT, p === "/" ? "index.html" : p.replace(/^\//, ""));
  if (file && fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  if (file && fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    const idx = path.join(file, "index.html");
    if (fs.existsSync(idx)) return idx;
  }
  if (!p.endsWith(".html") && !p.includes(".")) {
    const html = safeJoin(ROOT, p.replace(/^\//, "") + ".html");
    if (html && fs.existsSync(html)) return html;
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname === "/healthz" || url.pathname === "/api/healthz") {
      const body = attachNca(
        { ok: true, host: "fly", app: process.env.FLY_APP_NAME || "slidphilabs", at: new Date().toISOString() },
        "health", { ok: true }
      );
      res.writeHead(200, { "Content-Type": "application/json", ...ncaHeaders() });
      res.end(JSON.stringify(body));
      return;
    }
    if (url.pathname === "/api/nca" || url.pathname === "/nca") {
      res.writeHead(200, { "Content-Type": "application/json", ...ncaHeaders() });
      res.end(JSON.stringify(ncaReport({ point: "status", app: "slidphilabs" })));
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    if (
      url.pathname.includes("..") ||
      url.pathname.startsWith("/server.mjs") ||
      url.pathname.startsWith("/Dockerfile") ||
      url.pathname.startsWith("/fly.toml")
    ) {
      notFound(res);
      return;
    }
    const file = resolveStatic(url.pathname);
    if (!file) {
      notFound(res, "not_found");
      return;
    }
    sendFile(res, file, req);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("error");
    }
  }
});

const rest = bootRest(ROOT);
server.listen(PORT, HOST, () => {
  console.log(`[slidphilabs] fly host http://${HOST}:${PORT} root=${ROOT} phi-rest=${rest.n}/${rest.bytes}`);
});
