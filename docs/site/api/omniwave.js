/**
 * POST /api/omniwave — OmniWave decision engine (public API surface)
 *
 * One product: auto-route compress/decompress/profile/bench.
 * Private routing; public outcomes + path label.
 *
 * Body:
 *   { op: "compress"|"decompress"|"profile"|"bench"|"route",
 *     data: string|base64, encoding?: "utf8"|"base64",
 *     cascade?: boolean,
 *     route?: "zrw|delta" | string  // Creator force: structured-int assassin first
 *   }
 */
import { withProductBox } from "./lib/spl-box-gate.js";

import {
  profile,
  route,
  classifyForSuite,
  omniCompressLossless,
  omniDecompress,
  omniBench,
  isOmniFrame,
  barrelStatus,
  listPrints,
  getPrint,
} from "./lib/omniwave.js";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function toBuf(data, encoding) {
  if (encoding === "base64") return Buffer.from(String(data), "base64");
  return Buffer.from(String(data), "utf8");
}

async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method === "GET") {
    return json(res, 200, {
      service: "OmniWave",
      product: "SPL Codec (decision engine)",
      version: "1.4.0-barrel-cone",
      endpoint: "POST /api/omniwave",
      ops: [
        "compress",
        "decompress",
        "profile",
        "route",
        "bench",
        "barrel",
        "print",
        "prints",
      ],
      public: "One product face — barrel cone paths from entry apex",
      paths: ["zrw", "float", "text", "delta", "high_entropy", "general"],
      barrel: barrelStatus(),
      law: "cone outward · rotate · fire leaves fingerprint not data · encode via dataset_print_id",
      pricing: "https://www.slidphilabs.com/pps",
      discovery: "https://www.slidphilabs.com/api/agent",
      ip_guard: "Outcomes + route labels only. Process private.",
    });
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "method_not_allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return json(res, 400, { error: "invalid_json" });
    }
  }
  body = body || {};
  const op = String(body.op || "compress").toLowerCase();
  const encoding = String(body.encoding || "utf8").toLowerCase();

  try {
    if (op === "profile" || op === "route") {
      if (body.data == null && body.text == null) {
        return json(res, 400, { error: "missing_data" });
      }
      const buf = toBuf(body.data ?? body.text, encoding);
      if (buf.length > 8_000_000) {
        return json(res, 413, { error: "too_large", max: 8000000 });
      }
      const feats = profile(buf);
      const path = route(feats);
      const data_class = classifyForSuite(feats);
      return json(res, 200, {
        ok: true,
        op,
        path,
        data_class,
        feats,
        product: "SPL Codec",
        engine: "omniwave",
      });
    }

    if (op === "compress") {
      if (body.data == null && body.text == null) {
        return json(res, 400, { error: "missing_data" });
      }
      const buf = toBuf(body.data ?? body.text, encoding);
      if (buf.length > 8_000_000) {
        return json(res, 413, { error: "too_large", max: 8000000 });
      }
      const r = await omniCompressLossless(buf, {
        cascade: body.cascade !== false,
        route: body.route || body.force_route || body.path,
        dataset_print_id: body.dataset_print_id || body.print_id,
        require_print: body.require_print === true,
      });
      return json(res, 200, {
        ok: true,
        op: "compress",
        product: "SPL Codec",
        engine: "omniwave",
        path: r.meta.path,
        force_route: r.meta.force_route || null,
        force_hit: r.meta.force_hit || null,
        method: r.method || r.meta?.method,
        barrel: r.meta.barrel || null,
        dataset_print_id: r.meta.dataset_print_id || null,
        fire_print: r.meta.fire_print || null,
        sizes: r.meta.sizes || {
          raw: buf.length,
          packed: r.packed.length,
        },
        ratio: (r.meta.sizes && r.meta.sizes.ratio) || r.packed.length / Math.max(1, buf.length),
        ms: r.meta.ms,
        zrw: r.meta.zrw,
        data_base64: r.packed.toString("base64"),
        frame: isOmniFrame(r.packed) ? "OMWV" : "bare",
        decompress_hint: {
          op: "decompress",
          encoding: "base64",
          dataset_print_id: r.meta.dataset_print_id,
        },
      });
    }

    if (op === "decompress") {
      if (body.data == null) {
        return json(res, 400, { error: "missing_data" });
      }
      const buf = toBuf(body.data, encoding === "utf8" ? "base64" : encoding);
      if (buf.length > 12_000_000) {
        return json(res, 413, { error: "too_large" });
      }
      if (!isOmniFrame(buf) && encoding !== "base64") {
        // try base64 string in utf8 field
      }
      const out = await omniDecompress(buf);
      const asText = body.as_text !== false;
      return json(res, 200, {
        ok: true,
        op: "decompress",
        sizes: { packed: buf.length, raw: out.length },
        barrel: barrelStatus().decompress,
        data: asText ? out.toString("utf8") : undefined,
        data_base64: out.toString("base64"),
      });
    }

    if (op === "barrel") {
      return json(res, 200, {
        ok: true,
        op: "barrel",
        ...barrelStatus(),
        law: "cone outward · rotate · rest at most-used route",
      });
    }

    if (op === "prints") {
      return json(res, 200, {
        ok: true,
        op: "prints",
        prints: listPrints(Number(body.limit) || 20),
        law: "print set only · never the data",
      });
    }

    if (op === "print") {
      const id = body.dataset_print_id || body.print_id || body.id;
      const p = getPrint(id);
      if (!p) return json(res, 404, { error: "print_not_found", dataset_print_id: id });
      return json(res, 200, { ok: true, op: "print", ...p });
    }

    if (op === "bench") {
      if (body.data == null && body.text == null) {
        return json(res, 400, { error: "missing_data" });
      }
      const buf = toBuf(body.data ?? body.text, encoding);
      if (buf.length > 4_000_000) {
        return json(res, 413, { error: "too_large", max: 4000000 });
      }
      const b = await omniBench(buf);
      return json(res, 200, {
        ok: true,
        op: "bench",
        product: "SPL Codec",
        engine: "omniwave",
        ...b,
      });
    }

    return json(res, 400, {
      error: "unknown_op",
      ops: ["compress", "decompress", "profile", "route", "bench"],
    });
  } catch (e) {
    console.error("omniwave", e);
    return json(res, 500, {
      error: "omniwave_failed",
      message: String(e.message || e).slice(0, 200),
    });
  }
}

export default withProductBox(handler, 'gate');
