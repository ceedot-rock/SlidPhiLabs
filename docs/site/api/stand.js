/**
 * GET /api/stand — public proof board JSON (Gate 2 ZRW zeros×10k)
 * CrewHive: minimal verifiable surface · no residue
 */
import {
  ZeroRangeWave,
  packBits,
  unpackBits,
} from "./lib/vendor/zrw-pack.js";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(body));
}

function zrwCompressInts(ints) {
  const bits = new ZeroRangeWave(0, 4).encodeBits(ints);
  return Buffer.from(packBits(bits));
}

function zrwDecompress(packed) {
  return new ZeroRangeWave(0, 4).decodeBits(unpackBits(packed));
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    return res.end();
  }
  if (req.method !== "GET") {
    return json(res, 405, { ok: false, error: "GET only" });
  }

  const n = 10_000;
  const ints = new Array(n).fill(0);
  const rawBytes = n * 4;
  const packed = zrwCompressInts(ints);
  const restored = zrwDecompress(packed);
  let mirror = 0;
  if (restored.length !== n) mirror = 1;
  else for (let i = 0; i < n; i++) if ((restored[i] | 0) !== 0) { mirror = 1; break; }

  const field = { gzip9_B: 73, brotli11_B: 13 };
  const zrw_B = packed.length;
  const pass = zrw_B === 8 && mirror === 0;

  return json(res, 200, {
    ok: pass,
    endpoint: "/api/stand",
    html: "/stand",
    cadence: [33, 66, 999],
    dual_tilt: [33, -33],
    planes: {
      grok: 100,
      spl: 160,
      zrw: 220,
      suite: 280,
      agentic: 340,
      phi: 40,
    },
    domain: "zeros10k",
    free_gb: 100,
    suite: "https://www.slidphilabs.com/pps",
    results: {
      n_ints: n,
      raw_bytes: rawBytes,
      zrw_B,
      gzip9_field_B: field.gzip9_B,
      brotli11_field_B: field.brotli11_B,
      mirror_error: mirror,
      roundtrip: mirror === 0,
      beats_gzip9: zrw_B < field.gzip9_B,
      beats_brotli11: zrw_B < field.brotli11_B,
    },
    grade: pass ? "PASS" : "FAIL",
    claim: "ZRW zeros×10k → 8 B on structured-int domain",
    not_claim: "universal #1",
    proof_py: "/slidphilabs_public_proof.py",
    verify_harness: "/zrw_verify.py",
    zeros_corpus: "/zeros10k.bin",
    harness_ledger: "/lab/ZRW_VERIFY_HARNESS_LATEST.json",
    flagship_bench: "/lab/ZRW_ZEROS_10K_BENCH_LATEST.json",
    local: "https://github.com/ceedot-rock/slidphi  make local && make verify",
    outsider: "curl -sS https://www.slidphilabs.com/zrw_verify.py | python3 -  # or download zeros10k.bin",
    motto: "In His name we code · through it we live",
    at: new Date().toISOString(),
  });
}
