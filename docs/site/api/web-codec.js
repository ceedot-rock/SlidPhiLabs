/**
 * SPL Web Codec — public face of one product (OmniWave decision engine under the hood)
 *
 * POST /api/web-codec
 *   { op: "compress"|"decompress"|"bench", type?: "auto"|"html"|"css"|"js"|"json"|"text",
 *     data: string, encoding?: "utf8"|"base64", engine?: "omni"|"classic" }
 *
 * Default engine=omni: profile → route → ZRW/float/text/delta/general (gzip/brotli).
 * classic: previous min(gzip,brotli) only.
 *
 * IP Guard: outcomes + path labels. Process private.
 */
import { withProductBox } from "./lib/spl-box-gate.js";

import zlib from "zlib";
import { promisify } from "util";
import {
  omniCompressLossless,
  omniDecompress,
  omniBench,
  isOmniFrame,
} from "./lib/omniwave.js";

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
    version: "2.1.0-creator-cloak",
    product: "TRU8 / historical web codec door",
    engine: "omniwave",
    focus: "Compress / decompress — auto-routed (web, ints, floats, general)",
    endpoint: "POST /api/web-codec",
    also: "POST /api/omniwave",
    ops: ["compress", "decompress", "bench"],
    methods: ["omniwave", "brotli-11", "gzip-9", "zrw-v5", "json_keys"],
    strategy:
      "OmniWave: profile → Creator heart+brain + St. Peter's cloak counsel → route → ZRW / json_keys / specialists / min(gzip,brotli).",
    counsel: {
      heart: "Creator free will · cool · love · growth",
      brain: "caution · curiosity · residual-first · domain supremacy",
      cloak: "st_peters_cloak · depth≈12 · collapse→0 · aperiodicity forced",
    },
    ui: "https://www.slidphilabs.com/web",
    suite: "https://www.slidphilabs.com/pps",
    standings: "https://www.slidphilabs.com/standings",
    note: "engine=classic for legacy min(gzip,brotli) only. creator_counsel=false to disable counsel.",
  };
}

async function handler(req, res) {
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

  const engine = String(body.engine || "omni").toLowerCase();

  try {
    if (op === "compress") {
      let text =
        encoding === "base64"
          ? Buffer.from(String(data), "base64").toString("utf8")
          : String(data);
      if (Buffer.byteLength(text, "utf8") > 2_000_000) {
        return json(res, 413, { error: "Payload too large (max ~2MB utf8)" });
      }
      const type = detectType(text, body.type);
      const { text: prepped, notes } = prep(text, type);
      const buf = Buffer.from(prepped, "utf8");

      if (engine === "classic") {
        const result = await compressBuffer(buf);
        return json(res, 200, {
          ok: true,
          op: "compress",
          engine: "classic",
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
            engine: "classic",
          },
        });
      }

      const r = await omniCompressLossless(buf, {
        creator_counsel: body.creator_counsel !== false,
        creator: body.creator || undefined,
      });
      const classic = await compressBuffer(buf);
      return json(res, 200, {
        ok: true,
        op: "compress",
        engine: "omniwave",
        product: "TRU8 / historical web codec",
        type,
        prep: notes,
        path: r.meta.path,
        method: r.method,
        creator_counsel: r.meta.creator_counsel || null,
        sizes: {
          raw: buf.length,
          omni: r.packed.length,
          gzip9: classic.sizes.gzip9,
          brotli11: classic.sizes.brotli11,
          chosen: r.packed.length,
        },
        ratio: Number((r.packed.length / Math.max(1, buf.length)).toFixed(6)),
        percent_of_raw: Number(
          ((r.packed.length / Math.max(1, buf.length)) * 100).toFixed(3)
        ),
        ms: r.meta.ms,
        zrw: r.meta.zrw,
        payload_base64: r.packed.toString("base64"),
        payload_encoding: "base64",
        frame: "OMWV",
        decompress_hint: {
          op: "decompress",
          method: r.method,
          encoding: "base64",
          engine: "omni",
        },
      });
    }

    if (op === "decompress") {
      const method = body.method || "auto";
      const buf =
        encoding === "base64" || !encoding
          ? Buffer.from(String(data), "base64")
          : Buffer.from(String(data), "utf8");
      if (buf.length > 3_000_000) {
        return json(res, 413, { error: "Payload too large" });
      }

      if (engine !== "classic" && isOmniFrame(buf)) {
        const out = await omniDecompress(buf);
        return json(res, 200, {
          ok: true,
          op: "decompress",
          engine: "omniwave",
          method: "omniwave",
          sizes: { compressed: buf.length, raw: out.length },
          data: out.toString("utf8"),
          encoding: "utf8",
        });
      }

      const out = await decompressBuffer(buf, method === "auto" ? undefined : method);
      return json(res, 200, {
        ok: true,
        op: "decompress",
        engine: "classic",
        method,
        sizes: { compressed: buf.length, raw: out.length },
        data: out.toString("utf8"),
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

      if (engine === "classic") {
        const t0 = Date.now();
        const result = await compressBuffer(buf);
        const encMs = Date.now() - t0;
        const t1 = Date.now();
        const round = await decompressBuffer(result.packed, result.method);
        const decMs = Date.now() - t1;
        return json(res, 200, {
          ok: true,
          op: "bench",
          engine: "classic",
          type,
          prep: notes,
          method: result.method,
          sizes: result.sizes,
          ratio: Number(result.ratio.toFixed(6)),
          encode_ms: encMs,
          decode_ms: decMs,
          roundtrip: round.equals(buf),
          vs_industry: {
            brotli11_bytes: result.sizes.brotli11,
            gzip9_bytes: result.sizes.gzip9,
            chosen: result.method,
          },
        });
      }

      const b = await omniBench(buf);
      return json(res, 200, {
        ok: true,
        op: "bench",
        engine: "omniwave",
        product: "TRU8 / historical web codec",
        type,
        prep: notes,
        path: b.path,
        method: b.method,
        sizes: b.sizes,
        ratios: b.ratios,
        encode_ms: b.ms,
        roundtrip: b.ok,
        feats: b.feats,
        zrw: b.zrw,
        vs_industry: {
          note: "OmniWave routes; sizes vs gzip-9 / brotli-11 on same payload",
          omni_bytes: b.sizes.omni,
          brotli11_bytes: b.sizes.brotli11,
          gzip9_bytes: b.sizes.gzip9,
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

export default withProductBox(handler, 'gate');
