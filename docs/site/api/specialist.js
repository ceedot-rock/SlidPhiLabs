/**
 * GET  /api/specialist — how to call hosted compression
 * POST /api/specialist — encode (zeros or pulsar) or decode
 */
import { decodeFrame, inputToRaw, machineCard, MAX_RAW } from "./lib/specialist.mjs";
import { runHostedEncode } from "./lib/hosted-job.mjs";
import { meterSnapshot } from "./lib/usage-meter.mjs";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
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

function asJson(body) {
  if (body.kind === "json") return body.value;
  if (body.kind === "bin" && body.value && body.value[0] === 0x7b) {
    try {
      return JSON.parse(body.value.toString("utf8"));
    } catch {
      return null;
    }
  }
  return null;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method === "GET") {
    return json(res, 200, { ...machineCard(), usage: meterSnapshot(req) });
  }
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "POST only" });
  }

  try {
    const body = await readBody(req);
    const j = asJson(body);

    if (j && (j.op === "decode" || j.decode)) {
      const frame = j.data_b64
        ? Buffer.from(String(j.data_b64), "base64")
        : body.kind === "bin"
          ? Buffer.from(body.value)
          : null;
      if (!frame || !frame.length) return json(res, 400, { ok: false, error: "empty_body" });
      const raw = await decodeFrame(frame);
      return json(res, 200, {
        ok: true,
        raw_bytes: raw.length,
        raw_b64: raw.toString("base64"),
        roundtrip: true,
        host_fallback: false,
      });
    }

    let raw;
    if (j && typeof j === "object" && j.op !== "encode") raw = inputToRaw(j);
    if (!raw) {
      if (!body.value || !body.value.length) {
        return json(res, 400, { ok: false, error: "empty_body" });
      }
      raw = Buffer.from(body.value);
    }
    const job = await runHostedEncode(req, raw);
    return json(res, job.status, job.body);
  } catch (e) {
    return json(res, 400, { ok: false, error: String(e.message || e), host_fallback: false, max_raw: MAX_RAW });
  }
}
