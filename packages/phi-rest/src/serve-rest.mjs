#!/usr/bin/env node
/**
 * Production φ-rest host for a built static dir (Vite dist, etc).
 *   node serve-rest.mjs <root> [--port 8080] [--host 0.0.0.0]
 */
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { bootRest, fromRest, walkCalled } from "./phi_rest.mjs";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
};

const args = process.argv.slice(2);
const root = path.resolve(args.find((a) => !a.startsWith("--")) || "dist");
const port = Number((args.find((a) => a.startsWith("--port=")) || "").split("=")[1] || process.env.PORT || 8080);
const host = (args.find((a) => a.startsWith("--host=")) || "").split("=")[1] || process.env.HOST || "0.0.0.0";

if (!fs.existsSync(root)) {
  console.error(`[phi-rest] missing root ${root}`);
  process.exit(1);
}

const called = walkCalled(root, root);
const stats = bootRest(root, called);
console.log(`[phi-rest] boot ${stats.n} files / ${stats.bytes} bytes from ${root}`);

function send(res, filePath, req) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  const rested = fromRest(filePath);
  const data = rested || fs.readFileSync(filePath);
  const via = rested ? "open" : "disk";
  res.writeHead(200, {
    "Content-Type": type,
    "Content-Length": data.length,
    "Cache-Control": ext === ".html" ? "public, max-age=60" : "public, max-age=3600",
    "X-Phi-Rest": via,
  });
  res.end(data);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "local"}`);
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith("/")) rel += "index.html";
  if (rel === "/") rel = "/index.html";
  const file = path.normalize(path.join(root, rel));
  if (!file.startsWith(root)) {
    res.writeHead(403);
    return res.end("forbidden");
  }
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return send(res, file, req);
  const html = file + ".html";
  if (fs.existsSync(html) && fs.statSync(html).isFile()) return send(res, html, req);
  const fallback = path.join(root, "index.html");
  if (fs.existsSync(fallback)) return send(res, fallback, req);
  res.writeHead(404, { "X-Phi-Rest": "disk" });
  res.end("not found");
});

server.listen(port, host, () => {
  console.log(`[phi-rest] http://${host}:${port} root=${root}`);
});

export { root, port };
