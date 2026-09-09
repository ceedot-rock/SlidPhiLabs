/**
 * POST /api/compress — hosted compression. Same engine as /api/specialist.
 * Zeros → 8 B. Else min() of every own pathway on this host (or store).
 */
import { inputToRaw, machineCard, MAX_RAW } from "./lib/specialist.mjs";
import { runHostedEncode } from "./lib/hosted-job.mjs";
import { meterSnapshot } from "./lib/usage-meter.mjs";
import { codexStamp, codexHeaders } from "./lib/codex-key.js";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  for (const [k, v] of Object.entries(codexHeaders())) res.setHeader(k, v);
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body != null && !Buffer.isBuffer(req.body) && typeof req.body === "object") {
      resolve({ kind: "json", value: req.body });
      return;
    }
    if (Buffer.isBuffer(req.body)) {
      resolve({ kind: "bin", value: req.body });
      return;
    }
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve({ kind: "bin", value: Buffer.concat(chunks) }));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method === "GET") {
    return json(res, 200, {
      ok: true,
      path: "hosted-compression",
      ...machineCard(),
      pair: "POST /api/decompress · full loop POST /api/process",
      usage: meterSnapshot(req),
      ...codexStamp({ half: "compress" }),
    });
  }
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "POST only" });
  }

  try {
    const body = await readBody(req);
    let raw;
    if (body.kind === "json" || (body.kind === "bin" && body.value[0] === 0x7b)) {
      let j = body.kind === "json" ? body.value : null;
      if (!j) {
        try {
          j = JSON.parse(body.value.toString("utf8"));
        } catch {
          j = null;
        }
      }
      if (j && typeof j === "object") raw = inputToRaw(j);
    }
    if (!raw) {
      if (!body.value || !body.value.length) {
        return json(res, 400, { ok: false, error: "empty_body" });
      }
      raw = Buffer.from(body.value);
    }
    const job = await runHostedEncode(req, raw);
    return json(res, job.status, { ...job.body, ...codexStamp({ half: "compress", unlocked_pair: "/api/decompress" }) });
  } catch (e) {
    return json(res, 400, { ok: false, error: String(e.message || e), host_fallback: false, max_raw: MAX_RAW });
  }
}
