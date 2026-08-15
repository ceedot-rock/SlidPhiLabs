/**
 * Vite / preview plugin — rest public + index, stamp X-Phi-Rest.
 */
import fs from "fs";
import path from "path";
import { createRest, walkCalled } from "./phi_rest.mjs";

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

function collectCalled(root, extra = []) {
  const publicDir = path.join(root, "public");
  const called = [...extra];
  if (fs.existsSync(path.join(root, "index.html"))) called.push("index.html");
  if (fs.existsSync(publicDir)) {
    for (const rel of walkCalled(publicDir, publicDir)) called.push(path.join("public", rel));
  }
  return [...new Set(called)];
}

function attach(server, root, extra = []) {
  const called = collectCalled(root, extra);
  const rest = createRest({ root, called });
  const stats = rest.boot();
  console.log(`[phi-rest] ${stats.n} files / ${stats.bytes} bytes`);
  server.middlewares.use((req, res, next) => {
    const url = String(req.url || "/").split("?")[0];
    const rel = url === "/" ? "index.html" : url.replace(/^\//, "");
    const candidates = [path.join(root, "public", rel), path.join(root, rel)];
    for (const file of candidates) {
      const buf = rest.from(file);
      if (!buf) continue;
      // Let Vite transform index.html (HMR inject). Still mark rest.
      if (rel === "index.html" || rel.endsWith(".html")) {
        res.setHeader("X-Phi-Rest", "open");
        return next();
      }
      const ext = path.extname(file).toLowerCase();
      res.statusCode = 200;
      res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
      res.setHeader("Content-Length", buf.length);
      res.setHeader("X-Phi-Rest", "open");
      res.setHeader("Cache-Control", "public, max-age=120");
      res.end(buf);
      return;
    }
    res.setHeader("X-Phi-Rest", "disk");
    next();
  });
}

export function phiRestPlugin(opts = {}) {
  const extra = opts.called || [];
  return {
    name: "phi-rest",
    configureServer(server) {
      attach(server, server.config.root, extra);
    },
    configurePreviewServer(server) {
      attach(server, server.config.root, extra);
    },
  };
}
