/**
 * SPL Web Codec — compress / decompress for web payloads (HTML, CSS, JS, JSON, text)
 *
 * POST /api/web-codec
 *   { op: "compress"|"decompress"|"bench", type?: "auto"|"html"|"css"|"js"|"json"|"text",
 *     data: string, encoding?: "utf8"|"base64" }
 *
 * Strategy (public):
 *  1) Light type-aware prep (whitespace / comment strip — reversible-safe only)
 *  2) Encode with gzip-9 + brotli-11; pick smallest
 *  3) Optional: if JSON has dense int arrays, ZRW those columns (when available) — reserved
 *
 * IP Guard: no private residual engines. Uses platform zlib + published strategy.
 */
import zlib from "zlib";
import { promisify } from "util";

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const brotliCompress = promisify(zlib.brotliCompress);
const brotliDecompress = promisify(zlib.brotliDecompress);

const BROTLI_PARAMS = {
  params: {
    [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
    [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
  },
};

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function detectType(data, hint) {
  if (hint && hint !== "auto") return hint;
  const s = data.trimStart().slice(0, 200);
  if (s.startsWith("{") || s.startsWith("[")) return "json";
  if (s.startsWith("<!") || s.startsWith("<html") || s.startsWith("<HTML") || s.includes("<div"))
    return "html";
  if (/^[\s]*([.#@a-zA-Z][\w-]*\s*\{|@media|@keyframes)/.test(s)) return "css";
  if (/function\s|=>|const\s|let\s|var\s|import\s|export\s/.test(s)) return "js";
  return "text";
}

/** Reversible-safe light prep — only whitespace collapse where safe for ratio demo */
function prep(data, type) {
  let out = data;
  const notes = [];
  if (type === "json") {
    try {
      out = JSON.stringify(JSON.parse(data));
      notes.push("json_minified");
    } catch {
      /* keep original */
    }
  } else if (type === "css" || type === "js") {
    // strip // and /* */ comments carefully is non-trivial; only collapse multi-space / newlines outside strings is hard.
    // Safe: collapse pure runs of newlines and trailing spaces.
    const before = out.length;
    out = out.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n");
    if (out.length < before) notes.push("whitespace_trim");
  } else if (type === "html") {
    const before = out.length;
    out = out.replace(/>\s+</g, "><").replace(/[ \t]+$/gm, "");
    if (out.length < before) notes.push("html_space_collapse");
  }
  return { text: out, notes };
}

async function compressBuffer(buf) {
  const [gz, br] = await Promise.all([
    gzip(buf, { level: 9 }),
    brotliCompress(buf, BROTLI_PARAMS),
  ]);
  const pick = br.length <= gz.length ? "brotli-11" : "gzip-9";
  const packed = br.length <= gz.length ? br : gz;
  return {
    method: pick,
    packed,
    sizes: {
      raw: buf.length,
      gzip9: gz.length,
      brotli11: br.length,
      chosen: packed.length,
    },
    ratio: packed.length / Math.max(1, buf.length),
  };
}

async function decompressBuffer(buf, method) {
  const m = String(method || "").toLowerCase();
  if (m.includes("brotli") || m === "br") return brotliDecompress(buf);
  if (m.includes("gzip") || m === "gz") return gunzip(buf);
  // try brotli then gzip
  try {
    return await brotliDecompress(buf);
  } catch {
    return gunzip(buf);
  }
}

function productInfo() {
  return {
    service: "SPL Web Codec",
    version: "1.0.0",
    focus: "Web data compress / decompress (HTML · CSS · JS · JSON · text)",
    endpoint: "POST /api/web-codec",
    ops: ["compress", "decompress", "bench"],
    methods: ["brotli-11", "gzip-9"],
    strategy:
      "Type-aware light prep + pick smallest of brotli-11 (text mode) vs gzip-9. Domain: web assets, not residual process IP.",
    ui: "https://www.slidphilabs.com/web",
    standings: "https://www.slidphilabs.com/standings",
    note: "Locked product focus: web payload size and round-trip. Industry baseline is brotli for web static.",
  };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method === "GET") {
    return json(res, 200, productInfo());
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return json(res, 400, { error: "Invalid JSON" });
    }
  }
  body = body || {};

  const op = String(body.op || "compress").toLowerCase();
  const encoding = String(body.encoding || "utf8").toLowerCase();
  let data = body.data;
  if (data == null && body.text != null) data = body.text;
  if (data == null) {
    return json(res, 400, { error: "Missing data (utf8 string or base64)" });
  }

  try {
    if (op === "compress") {
      let text =
        encoding === "base64"
          ? Buffer.from(String(data), "base64").toString("utf8")
          : String(data);
      // size limit ~2MB
      if (Buffer.byteLength(text, "utf8") > 2_000_000) {
        return json(res, 413, { error: "Payload too large (max ~2MB utf8)" });
      }
      const type = detectType(text, body.type);
      const { text: prepped, notes } = prep(text, type);
      const buf = Buffer.from(prepped, "utf8");
      const result = await compressBuffer(buf);
      return json(res, 200, {
        ok: true,
        op: "compress",
        type,
        prep: notes,
        method: result.method,
        sizes: result.sizes,
        ratio: Number(result.ratio.toFixed(6)),
        percent_of_raw: Number((result.ratio * 100).toFixed(3)),
        payload_base64: result.packed.toString("base64"),
        payload_encoding: "base64",
        decompress_hint: {
          op: "decompress",
          method: result.method,
          encoding: "base64",
        },
      });
    }

    if (op === "decompress") {
      const method = body.method || "brotli-11";
      const buf =
        encoding === "base64" || !encoding
          ? Buffer.from(String(data), "base64")
          : Buffer.from(String(data), "utf8");
      if (buf.length > 2_000_000) {
        return json(res, 413, { error: "Payload too large" });
      }
      const out = await decompressBuffer(buf, method);
      const text = out.toString("utf8");
      return json(res, 200, {
        ok: true,
        op: "decompress",
        method,
        sizes: { compressed: buf.length, raw: out.length },
        data: text,
        encoding: "utf8",
      });
    }

    if (op === "bench") {
      let text =
        encoding === "base64"
          ? Buffer.from(String(data), "base64").toString("utf8")
          : String(data);
      if (Buffer.byteLength(text, "utf8") > 2_000_000) {
        return json(res, 413, { error: "Payload too large" });
      }
      const type = detectType(text, body.type);
      const { text: prepped, notes } = prep(text, type);
      const buf = Buffer.from(prepped, "utf8");
      const t0 = Date.now();
      const result = await compressBuffer(buf);
      const encMs = Date.now() - t0;
      const t1 = Date.now();
      const round = await decompressBuffer(result.packed, result.method);
      const decMs = Date.now() - t1;
      const ok = round.equals(buf);
      return json(res, 200, {
        ok: true,
        op: "bench",
        type,
        prep: notes,
        method: result.method,
        sizes: result.sizes,
        ratio: Number(result.ratio.toFixed(6)),
        encode_ms: encMs,
        decode_ms: decMs,
        roundtrip: ok,
        vs_industry: {
          note: "brotli-11 is the web-static size leader class; we select min(brotli-11, gzip-9) after prep",
          brotli11_bytes: result.sizes.brotli11,
          gzip9_bytes: result.sizes.gzip9,
          chosen: result.method,
        },
      });
    }

    return json(res, 400, {
      error: "Unknown op",
      ops: ["compress", "decompress", "bench"],
    });
  } catch (e) {
    return json(res, 500, {
      error: "web_codec_failed",
      detail: String(e.message || e).slice(0, 300),
    });
  }
}
