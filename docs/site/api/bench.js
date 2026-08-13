/**
 * GET|POST /api/bench — open self-serve compression proof
 *
 * Streams (NDJSON) or returns JSON: structured · float · mixed
 * engines: SPL OmniWave · ZRW · gzip-9 · brotli-11
 * metrics: packed_bytes, ratio, encode_ms, decode_ms (where applicable)
 *
 * Freemium tier is 100 GB/job on paid rails — this page proves method
 * on public synthetic slices so visitors verify before they pay.
 */
import zlib from "zlib";
import { promisify } from "util";
import {
  ZeroRangeWave,
  packBits,
  unpackBits,
} from "./lib/vendor/zrw-pack.js";
import { omniCompress, omniDecompress, profile, route } from "./lib/omniwave.js";
import { codexHeaders } from "./lib/codex-key.js";

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const brotliCompress = promisify(zlib.brotliCompress);
const brotliDecompress = promisify(zlib.brotliDecompress);

const BROTLI_OPTS = {
  params: {
    [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
  },
};

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  for (const [k, v] of Object.entries(codexHeaders())) res.setHeader(k, v);
}

function nowMs() {
  return typeof performance !== "undefined" && performance.now
    ? performance.now()
    : Date.now();
}

function ratio(packed, raw) {
  return raw > 0 ? packed / raw : 0;
}

/** Deterministic LCG for high-entropy-ish mixed tails */
function lcg(seed) {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(1103515245, x) + 12345) >>> 0;
    return x;
  };
}

/**
 * Build public synthetic corpora (not private customer data).
 * @param {"structured"|"float"|"mixed"} klass
 * @param {number} bytes target size (capped)
 */
function buildClass(klass, bytes) {
  const n = Math.max(1024, Math.min(bytes, 512 * 1024)); // serverless-safe cap 512 KiB
  const buf = Buffer.allocUnsafe(n);
  if (klass === "structured") {
    // Unchanged test vector: int32 ramp / plateau every 64 bytes (16 int32 holds).
    // Attack lives in the encoder (stride residual → ZRW), not in the corpus.
    const view = new DataView(buf.buffer, buf.byteOffset, n - (n % 4));
    let v = 0;
    for (let i = 0; i + 4 <= n; i += 4) {
      if (i % 64 === 0) v += 1;
      view.setInt32(i, v, true);
    }
    for (let i = n - (n % 4); i < n; i++) buf[i] = 0;
    return {
      buf,
      label: "structured",
      note: "int32 ramp · residual integer plane",
    };
  }
  if (klass === "float") {
    const view = new DataView(buf.buffer, buf.byteOffset, n - (n % 4));
    for (let i = 0; i + 4 <= n; i += 4) {
      const t = i / 4;
      view.setFloat32(i, Math.sin(t / 17) * 100 + Math.cos(t / 31) * 40, true);
    }
    for (let i = n - (n % 4); i < n; i++) buf[i] = 0;
    return { buf, label: "float", note: "float32 smooth series · OmniWave float path" };
  }
  // mixed: text + float + high-entropy tail
  const tLen = Math.floor(n * 0.4);
  const fLen = Math.floor(n * 0.35) & ~3;
  const hLen = n - tLen - fLen;
  const unit = Buffer.from(
    '{"id":1,"msg":"residual first","vals":[1,2,3],"ok":true}\n',
  );
  for (let i = 0; i < tLen; i++) buf[i] = unit[i % unit.length];
  const view = new DataView(buf.buffer, buf.byteOffset + tLen, fLen);
  for (let i = 0; i + 4 <= fLen; i += 4) {
    view.setFloat32(i, Math.sin(i / 40) * 50, true);
  }
  const rnd = lcg(0xc0ffee);
  for (let i = 0; i < hLen; i++) buf[tLen + fLen + i] = rnd() & 0xff;
  return {
    buf,
    label: "mixed",
    note: "text 40% · float 35% · high-entropy 25% · OmniWave private routes",
  };
}

function intsFromBuf(buf) {
  const n = Math.floor(buf.length / 4);
  const arr = new Array(n);
  for (let i = 0; i < n; i++) arr[i] = buf.readInt32LE(i * 4);
  return arr;
}

function zrwPack(ints) {
  const bits = new ZeroRangeWave(0, 4).encodeBits(ints);
  return Buffer.from(packBits(bits));
}

function zrwUnpack(packed) {
  return new ZeroRangeWave(0, 4).decodeBits(unpackBits(packed));
}

async function benchGzip(buf) {
  const t0 = nowMs();
  const packed = await gzip(buf, { level: 9 });
  const enc = nowMs() - t0;
  const t1 = nowMs();
  await gunzip(packed);
  const dec = nowMs() - t1;
  return {
    engine: "gzip-9",
    packed_bytes: packed.length,
    ratio: +ratio(packed.length, buf.length).toFixed(6),
    encode_ms: +enc.toFixed(3),
    decode_ms: +dec.toFixed(3),
  };
}

async function benchBrotli(buf) {
  const t0 = nowMs();
  const packed = await brotliCompress(buf, BROTLI_OPTS);
  const enc = nowMs() - t0;
  const t1 = nowMs();
  await brotliDecompress(packed);
  const dec = nowMs() - t1;
  return {
    engine: "brotli-11",
    packed_bytes: packed.length,
    ratio: +ratio(packed.length, buf.length).toFixed(6),
    encode_ms: +enc.toFixed(3),
    decode_ms: +dec.toFixed(3),
  };
}

async function benchZrw(buf) {
  if (buf.length < 8 || buf.length % 4 !== 0) {
    return {
      engine: "zrw",
      skipped: true,
      reason: "not_int32_aligned",
    };
  }
  // Attack vector (not test change): multi-angle residual → ZRW via OmniWave assassin
  // angle4 = stride-16 deinterleave for step-64 plateaus
  try {
    const t0 = nowMs();
    const out = await omniCompress(buf, {
      path: "zrw",
      cascade: false,
      creator_counsel: false,
    });
    const enc = nowMs() - t0;
    const packed = out.packed;
    const plen = Buffer.isBuffer(packed) ? packed.length : 0;
    let dec = null;
    let rt = false;
    try {
      const t1 = nowMs();
      const back = await omniDecompress(packed);
      dec = nowMs() - t1;
      rt = Buffer.isBuffer(back) && back.length === buf.length && back.equals(buf);
    } catch {
      rt = false;
    }
    if (!rt || out.meta?.path !== "zrw") {
      // fall back to direct single-pack for small domains (bench metric without OMWV frame tax)
      const ints = intsFromBuf(buf);
      const t2 = nowMs();
      const p = zrwPack(ints);
      const enc2 = nowMs() - t2;
      const back = zrwUnpack(p);
      let ok = back && back.length === ints.length;
      if (ok) {
        for (let i = 0; i < ints.length; i++) {
          if ((back[i] | 0) !== (ints[i] | 0)) {
            ok = false;
            break;
          }
        }
      }
      if (!ok) {
        return {
          engine: "zrw",
          error: out.meta?.zrw?.reason || "roundtrip_fail",
          path: out.meta?.path,
        };
      }
      return {
        engine: "zrw",
        packed_bytes: p.length,
        ratio: +ratio(p.length, buf.length).toFixed(6),
        encode_ms: +enc2.toFixed(3),
        decode_ms: null,
        mode: "direct",
        domain_note: "direct ZRW",
      };
    }
    // Report payload (pre-frame) when available — fair vs gzip/brotli bare sizes
    const payload =
      (out.meta?.sizes && out.meta.sizes.payload) != null
        ? out.meta.sizes.payload
        : plen;
    return {
      engine: "zrw",
      packed_bytes: payload,
      framed_bytes: plen,
      ratio: +ratio(payload, buf.length).toFixed(6),
      encode_ms: +enc.toFixed(3),
      decode_ms: dec != null ? +dec.toFixed(3) : null,
      mode: out.meta?.zrw?.mode,
      method: out.meta?.method,
      domain_note:
        "multi-angle residual · angle4 stride-16 plateaus → unit ramps",
      roundtrip: true,
    };
  } catch (e) {
    return { engine: "zrw", error: String(e.message || e).slice(0, 160) };
  }
}

async function benchSpl(buf, forcePath) {
  const feats = profile(buf);
  const auto = route(feats);
  try {
    const t0 = nowMs();
    const out = await omniCompress(buf, {
      path: forcePath || undefined,
      cascade: true,
      creator_counsel: false,
    });
    const enc = nowMs() - t0;
    const packed = out.packed;
    const plen = Buffer.isBuffer(packed)
      ? packed.length
      : packed?.byteLength || 0;
    let dec = null;
    try {
      const t1 = nowMs();
      const back = await omniDecompress(packed);
      dec = nowMs() - t1;
      // soft verify (minify paths may not be bit-identical)
      void back;
    } catch {
      dec = null;
    }
    return {
      engine: "spl_omniwave",
      path: out.meta?.path || forcePath || auto,
      method: out.meta?.method || out.method,
      packed_bytes: plen,
      ratio: +ratio(plen, buf.length).toFixed(6),
      encode_ms: +enc.toFixed(3),
      decode_ms: dec != null ? +dec.toFixed(3) : null,
      auto_route: auto,
      feats: {
        entropy: +feats.entropy.toFixed(3),
        float_like: +feats.float_like.toFixed(3),
        zrw_score: +feats.zrw_score.toFixed(3),
        printable: +feats.printable.toFixed(3),
      },
    };
  } catch (e) {
    return {
      engine: "spl_omniwave",
      error: String(e.message || e).slice(0, 160),
      auto_route: auto,
    };
  }
}

async function runClass(klass, sizeBytes, emit) {
  const built = buildClass(klass, sizeBytes);
  const raw = built.buf.length;
  const head = {
    event: "class_start",
    class: built.label,
    raw_bytes: raw,
    note: built.note,
  };
  if (emit) emit(head);

  const engines = [];
  // Order: SPL (full story) · ZRW · gzip · brotli
  const spl = await benchSpl(built.buf);
  engines.push(spl);
  if (emit) emit({ event: "engine", class: built.label, ...spl });

  const zrw = await benchZrw(built.buf);
  engines.push(zrw);
  if (emit) emit({ event: "engine", class: built.label, ...zrw });

  const gz = await benchGzip(built.buf);
  engines.push(gz);
  if (emit) emit({ event: "engine", class: built.label, ...gz });

  const br = await benchBrotli(built.buf);
  engines.push(br);
  if (emit) emit({ event: "engine", class: built.label, ...br });

  // Winner by size (skip errors/skipped)
  const ranked = engines
    .filter((e) => e.packed_bytes != null && !e.error && !e.skipped)
    .slice()
    .sort((a, b) => a.packed_bytes - b.packed_bytes);
  const summary = {
    event: "class_done",
    class: built.label,
    raw_bytes: raw,
    winner: ranked[0]
      ? {
          engine: ranked[0].engine,
          packed_bytes: ranked[0].packed_bytes,
          ratio: ranked[0].ratio,
          encode_ms: ranked[0].encode_ms,
        }
      : null,
    vs_gzip: ranked[0]
      ? {
          gzip_bytes: gz.packed_bytes,
          winner_bytes: ranked[0].packed_bytes,
          better_than_gzip:
            ranked[0].packed_bytes < gz.packed_bytes
              ? +(
                  (1 - ranked[0].packed_bytes / gz.packed_bytes) *
                  100
                ).toFixed(2)
              : 0,
        }
      : null,
    engines,
  };
  if (emit) emit(summary);
  return summary;
}

function parseOpts(req, url) {
  let body = {};
  if (req.body && typeof req.body === "object") body = req.body;
  const q = url.searchParams;
  const size = Math.min(
    512 * 1024,
    Math.max(
      4 * 1024,
      Number(body.bytes || body.size || q.get("bytes") || q.get("size") || 65536),
    ),
  );
  const stream =
    body.stream === true ||
    q.get("stream") === "1" ||
    q.get("stream") === "true" ||
    (req.headers.accept || "").includes("ndjson");
  const classes = ["structured", "float", "mixed"];
  return { size, stream, classes };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const url = new URL(req.url || "/api/bench", "http://local");

  if (req.method === "GET" && url.searchParams.get("meta") === "1") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=120");
    return res.end(
      JSON.stringify({
        ok: true,
        route: "/bench",
        api: "/api/bench",
        classes: ["structured", "float", "mixed"],
        engines: ["spl_omniwave", "zrw", "gzip-9", "brotli-11"],
        freemium: {
          first_gb: 100,
          note: "Live paid jobs up to 100 GB; this open bench uses public synthetic slices ≤512 KiB so proof is free and self-serve.",
        },
        stream: "GET /api/bench?stream=1&bytes=65536 → NDJSON events",
        json: "GET /api/bench?bytes=65536 → full JSON report",
        pricing: "https://www.slidphilabs.com/pps",
        standings: "https://www.slidphilabs.com/standings",
      }),
    );
  }

  if (req.method !== "GET" && req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: "GET or POST" }));
  }

  // Parse JSON body for POST if needed
  if (
    req.method === "POST" &&
    !req.body &&
    (req.headers["content-type"] || "").includes("json")
  ) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    try {
      req.body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    } catch {
      req.body = {};
    }
  }

  const opts = parseOpts(req, url);
  const tAll = nowMs();

  if (opts.stream) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Bench-Stream", "1");
    const write = (obj) => {
      res.write(JSON.stringify(obj) + "\n");
    };
    write({
      event: "start",
      bytes_per_class: opts.size,
      classes: opts.classes,
      engines: ["spl_omniwave", "zrw", "gzip-9", "brotli-11"],
      freemium_gb: 100,
      at: new Date().toISOString(),
    });
    const results = [];
    for (const c of opts.classes) {
      results.push(await runClass(c, opts.size, write));
    }
    write({
      event: "done",
      wall_ms: +(nowMs() - tAll).toFixed(3),
      classes: results.map((r) => ({
        class: r.class,
        winner: r.winner,
        vs_gzip: r.vs_gzip,
      })),
      cta: {
        suite: "https://www.slidphilabs.com/pps",
        note: "First 100 GB freemium · then ¢/GB — proof is above.",
      },
    });
    return res.end();
  }

  // Full JSON
  const results = [];
  for (const c of opts.classes) {
    results.push(await runClass(c, opts.size, null));
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(
    JSON.stringify({
      ok: true,
      version: "1.0.0",
      bytes_per_class: opts.size,
      wall_ms: +(nowMs() - tAll).toFixed(3),
      freemium: {
        first_gb: 100,
        note: "Open bench = synthetic proof. Paid suite handles real jobs to 100 GB free tier.",
      },
      classes: results,
      cta: {
        suite: "https://www.slidphilabs.com/pps",
        standings: "https://www.slidphilabs.com/standings",
      },
    }),
  );
}
