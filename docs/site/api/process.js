/**
 * POST /api/process — compress then decompress in one call.
 */
import { withProductBox } from "./lib/spl-box-gate.js";
import {
  encode as splEncode,
  decode as splDecode,
  inputToRaw,
  publicResult,
  MAX_RAW,
  MAX_VECTOR,
} from "./lib/spl-codec.mjs";
import { codexStamp, codexHeaders, CODEX_NAME, CODEX_SEAL_DAY } from "./lib/codex-key.js";
import { attachNca, ncaHeaders } from "./lib/nca_infra.mjs";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  const h = { ...codexHeaders(), ...ncaHeaders() };
  for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
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

async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method === "GET") {
    return json(
      res,
      200,
      attachNca(
        {
          ok: true,
          ...codexStamp({
            how: "POST same body as /api/compress — encode then decode, report RT",
          }),
        },
        "process",
        { ok: true },
      ),
    );
  }
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "POST only", ...codexStamp() });
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
        return json(res, 400, { ok: false, error: "empty_body", ...codexStamp() });
      }
      raw = Buffer.from(body.value);
    }
    const cap = raw.length % 4 === 0 && raw.length <= MAX_VECTOR ? MAX_VECTOR : MAX_RAW;
    if (raw.length > cap) {
      return json(res, 413, { ok: false, error: "too_large", ...codexStamp() });
    }
    const enc = splEncode(raw);
    const restored = splDecode(enc.frame);
    const roundtrip = Buffer.isBuffer(restored) && restored.equals(raw);
    const pub = publicResult(enc);
    return json(
      res,
      200,
      attachNca(
        {
          ok: true,
          ...codexStamp(),
          unlocked: true,
          key: CODEX_NAME,
          seal_day: CODEX_SEAL_DAY,
          ...pub,
          process: {
            compress: true,
            decompress: true,
            closed_loop: roundtrip,
          },
          restored_bytes: restored.length,
          restored_b64: restored.toString("base64"),
          roundtrip,
          mirror_error: roundtrip ? 0 : 1,
          at: new Date().toISOString(),
        },
        "process",
        { ok: true, roundtrip, path: pub.path },
      ),
    );
  } catch (e) {
    return json(
      res,
      400,
      attachNca(
        { ok: false, error: String(e.message || e), ...codexStamp() },
        "process",
        { ok: false },
      ),
    );
  }
}

export default withProductBox(handler, "gate");
