#!/usr/bin/env node
/**
 * Bench the live hosted compressor. gzip-9 / brotli-11 are opponents on the
 * same bytes, not occupants. Hosted cap is 4 MiB. Silesia rows are slices.
 */
import { readFile, writeFile } from "node:fs/promises";
import { gzipSync, brotliCompressSync, constants as zconst } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ORIGIN = process.env.SPL_HOST || "https://www.slidphilabs.com";
const MAX = 4 * 1024 * 1024;
const SILESIA = process.env.SILESIA || "/home/ceedotrock/data/silesia";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function publicMethod(m) {
  const x = String(m || "store").toLowerCase();
  if (x === "zeros" || x === "fill") return "zeros";
  if (x === "pulsar") return "pulsar";
  if (x === "lz") return "lz";
  if (x === "paq") return "paq";
  if (x === "store") return "store";
  return "hosted";
}

function gzip9(buf) {
  const t0 = performance.now();
  const packed = gzipSync(buf, { level: 9 });
  return { packed_bytes: packed.length, encode_ms: Math.round(performance.now() - t0) };
}

function brotli11(buf) {
  const t0 = performance.now();
  const packed = brotliCompressSync(buf, {
    params: { [zconst.BROTLI_PARAM_QUALITY]: 11 },
  });
  return { packed_bytes: packed.length, encode_ms: Math.round(performance.now() - t0) };
}

async function hosted(buf) {
  const t0 = performance.now();
  const r = await fetch(`${ORIGIN}/api/compress`, {
    method: "POST",
    headers: { "content-type": "application/octet-stream", accept: "application/json" },
    body: buf,
  });
  const encode_ms = Math.round(performance.now() - t0);
  const j = await r.json();
  if (!j.ok) {
    return { ok: false, error: j.error || j.plain || `HTTP ${r.status}`, encode_ms, status: r.status };
  }
  const packed = Buffer.from(j.packed_b64, "base64");
  const t1 = performance.now();
  const d = await fetch(`${ORIGIN}/api/decompress`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ packed_b64: j.packed_b64 }),
  });
  const decode_ms = Math.round(performance.now() - t1);
  const dj = await d.json();
  if (!dj.ok) {
    return { ok: false, error: dj.error || "decompress_fail", encode_ms, decode_ms, packed_bytes: packed.length };
  }
  const raw = Buffer.from(dj.raw_b64, "base64");
  const roundtrip = raw.equals(buf);
  return {
    ok: roundtrip,
    decode_ok: roundtrip,
    packed_bytes: packed.length,
    frame_bytes: j.frame_bytes || packed.length,
    encode_ms,
    decode_ms,
    method: publicMethod(j.method || j.occupant),
    error: roundtrip ? undefined : "roundtrip_mismatch",
  };
}

function zeros(n) {
  return Buffer.alloc(n);
}
function textRepeat(n) {
  const unit = Buffer.from("the cat sat on the mat. ");
  const out = Buffer.alloc(n);
  for (let i = 0; i < n; i++) out[i] = unit[i % unit.length];
  return out;
}
function jsonLike(n) {
  const row = '{"id":12345,"name":"sample-record","ok":true,"n":0}\n';
  return textRepeatFrom(row, n);
}
function textRepeatFrom(s, n) {
  const unit = Buffer.from(s);
  const out = Buffer.alloc(n);
  for (let i = 0; i < n; i++) out[i] = unit[i % unit.length];
  return out;
}
function ramp(n) {
  const out = Buffer.alloc(n);
  for (let i = 0; i + 4 <= n; i += 4) out.writeUInt32LE((i / 4) >>> 0, i);
  return out;
}
function rand(n, seed = 1) {
  const out = Buffer.alloc(n);
  let x = seed >>> 0;
  for (let i = 0; i < n; i++) {
    x = (Math.imul(1103515245, x) + 12345) >>> 0;
    out[i] = x >>> 24;
  }
  return out;
}
function mixed(n) {
  const a = zeros(Math.floor(n / 2));
  const b = textRepeat(n - a.length);
  return Buffer.concat([a, b]);
}

async function sliceFile(path, n) {
  const buf = await readFile(path);
  return buf.subarray(0, Math.min(n, buf.length, MAX));
}

const jobs = [
  { id: "zeros_40k", label: "40,000 zeros", kind: "zeros", note: "Flagship fill. Official whole file.", make: () => zeros(40_000) },
  { id: "zeros_1e6", label: "1,000,000 zeros", kind: "zeros", note: "Flagship fill. Official whole file.", make: () => zeros(1_000_000) },
  { id: "text_repeat_256k", label: "Repeating English 256 KiB", kind: "text", note: "Synthetic.", make: () => textRepeat(256 * 1024) },
  { id: "json_128k", label: "Repeating JSON 128 KiB", kind: "text", note: "Synthetic.", make: () => jsonLike(128 * 1024) },
  { id: "int_ramp_256k", label: "uint32 ramp 256 KiB", kind: "ints", note: "Synthetic.", make: () => ramp(256 * 1024) },
  { id: "mixed_256k", label: "Zeros then text 256 KiB", kind: "mixed", note: "Synthetic.", make: () => mixed(256 * 1024) },
  { id: "rand_64k", label: "Incompressible 64 KiB", kind: "random", note: "Should store, not grow.", make: () => rand(64 * 1024) },
  { id: "silesia_dickens_1m", label: "dickens first 1 MiB", kind: "silesia-slice", note: "Slice. Not official Silesia.", file: "dickens", n: 1024 * 1024 },
  { id: "silesia_xml_1m", label: "xml first 1 MiB", kind: "silesia-slice", note: "Slice. Not official Silesia.", file: "xml", n: 1024 * 1024 },
  { id: "silesia_ooffice_1m", label: "ooffice first 1 MiB", kind: "silesia-slice", note: "Slice. Not official Silesia.", file: "ooffice", n: 1024 * 1024 },
  { id: "silesia_mr_1m", label: "mr first 1 MiB", kind: "silesia-slice", note: "Slice. Not official Silesia.", file: "mr", n: 1024 * 1024 },
  { id: "silesia_dickens_4m", label: "dickens first 4 MiB", kind: "silesia-slice", note: "Hosted cap. Slice. Not official Silesia.", file: "dickens", n: MAX },
];

const rows = [];
for (const job of jobs) {
  process.stderr.write(`bench ${job.id}...\n`);
  let raw;
  try {
    raw = job.make ? job.make() : await sliceFile(join(SILESIA, job.file), job.n);
  } catch (e) {
    rows.push({ id: job.id, label: job.label, kind: job.kind, note: job.note, ok: false, error: String(e.message || e) });
    continue;
  }
  if (raw.length > MAX) raw = raw.subarray(0, MAX);
  const g = gzip9(raw);
  const b = brotli11(raw);
  let h;
  try {
    h = await hosted(raw);
  } catch (e) {
    h = { ok: false, error: String(e.message || e) };
  }
  rows.push({
    id: job.id,
    label: job.label,
    kind: job.kind,
    note: job.note,
    raw_bytes: raw.length,
    hosted: h,
    gzip9: g,
    brotli11: b,
    ratio_hosted: h.ok ? +(h.packed_bytes / raw.length).toFixed(4) : null,
    ratio_gzip9: +(g.packed_bytes / raw.length).toFixed(4),
    ratio_brotli11: +(b.packed_bytes / raw.length).toFixed(4),
  });
}

const keep = rows.filter((r) => r.hosted && r.hosted.decode_ok);
const report = {
  ok: true,
  service: "AWARE hosted lossless compression",
  origin: ORIGIN,
  at: new Date().toISOString(),
  cap_bytes: MAX,
  plain: "Live POST /api/compress then POST /api/decompress. gzip-9 and brotli-11 ran on the same bytes as opponents, not as occupants. Hosted cap 4 MiB. Silesia rows are slices, not the official 12-file total. Not a #1 claim.",
  decode_ok: keep.length,
  n: rows.length,
  rows,
};

const outJson = join(ROOT, "bench.json");
const outLab = join(ROOT, "lab/hosted_bench_LATEST.json");
await writeFile(outJson, JSON.stringify(report, null, 2));
await writeFile(outLab, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ wrote: [outJson, outLab], decode_ok: keep.length, n: rows.length }, null, 2));
for (const r of rows) {
  const h = r.hosted || {};
  console.log(
    [r.id, r.raw_bytes, h.ok ? h.packed_bytes : "FAIL", h.method || h.error, h.encode_ms, r.gzip9?.packed_bytes, r.brotli11?.packed_bytes].join("\t"),
  );
}
